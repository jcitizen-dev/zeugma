// Maintenance engine: each task is due after N sessions and/or D days since it was last done.
import { COMPRESSOR_STEPS, wipeSteps, UVC_MINUTES } from './content.js';
import { userName } from './state.js';
import { DAY, fmtDate } from './ui.js';

export function taskList(s) {
  const iv = s.intervals;
  const tasks = [
    { id: 'compressorDrain', name: 'Drain air compressor', iv: iv.compressorDrain, steps: COMPRESSOR_STEPS },
    {
      id: 'dryerEmpty',
      name: 'Empty air dryer water container',
      iv: iv.dryerEmpty,
      auto: 'Also recorded when you tick "I emptied the air dryer container" after a session.',
    },
    {
      id: 'uvc',
      name: 'UVC clean cycle',
      iv: { sessions: s.uvcEvery, days: 0 },
      steps: ['Leave the chamber and electrical boxes on, door closed.', `Run UVC for ${UVC_MINUTES} minutes.`, 'Turn off UVC, chamber and electrical boxes.'],
      auto: 'Recorded automatically when a logged session had UVC run.',
    },
    {
      id: 'chillerLevel',
      name: 'Chiller water level',
      iv: iv.chillerLevel,
      steps: ['Check the level is at H.', 'Top up with distilled water if not.'],
      auto: 'Recorded automatically by the pre-session checklist.',
    },
    { id: 'wipeDown', name: 'Wipe down chamber', iv: iv.wipeDown, steps: wipeSteps(s), lysol: true },
  ];
  s.masks.forEach((m, i) => {
    if (m.userId) {
      tasks.push({
        id: `mask:${i + 1}`,
        name: `Clean mask #${i + 1} (${userName(s, m.userId)})`,
        userId: m.userId,
        iv: { sessions: s.maskCleanSessions, days: s.maskCleanDays },
      });
    }
  });
  return tasks;
}

export function computeStatuses(s, sessions, log, now = Date.now()) {
  const out = taskList(s).map((t) => {
    const history = log.filter((e) => e.taskId === t.id).sort((a, b) => b.at - a.at);
    const last = history[0];
    const since = last ? last.at : s.installedAt;
    const n = sessions.filter((x) => x.at > since && (!t.userId || x.userId === t.userId)).length;
    const days = Math.max(0, Math.floor((now - since) / DAY));
    const S = Number(t.iv?.sessions) || 0;
    const D = Number(t.iv?.days) || 0;
    let status = 'ok';
    if ((S && n >= S) || (D && days >= D)) status = 'due';
    if ((S && n > S) || (D && days > D)) status = 'overdue';
    const parts = [];
    if (S) parts.push(`${n} of ${S} session${S === 1 ? '' : 's'}`);
    if (D) parts.push(`${days} of ${D} days`);
    return { ...t, history, last, status, progress: parts.join(' · ') || 'No interval set' };
  });
  out.push(annualStatus(s, log, now));
  return out;
}

function annualStatus(s, log, now) {
  const history = log.filter((e) => e.taskId === 'annual').sort((a, b) => b.at - a.at);
  const t = {
    id: 'annual',
    name: 'Annual professional service',
    steps: ['Filters', 'Oxygen membrane', 'Demand regulator', 'Call the installer to book it.'],
    history,
    last: history[0],
  };
  if (!s.serviceLastDate) return { ...t, status: 'unset', progress: 'Enter the last service date.' };
  const due = new Date(`${s.serviceLastDate}T12:00`);
  due.setMonth(due.getMonth() + (Number(s.serviceMonths) || 12));
  const left = Math.ceil((due - now) / DAY);
  const status = left < 0 ? 'overdue' : left <= (Number(s.serviceRemindDays) || 0) ? 'due' : 'ok';
  const progress = left < 0 ? `${-left} days overdue (was due ${fmtDate(due)})` : `Due ${fmtDate(due)} · in ${left} days`;
  return { ...t, status, progress };
}
