import { db, getKV } from '../db.js';
import { computeStatuses } from '../maint.js';
import { PHASES, currentPhaseIndex } from '../content.js';
import { primaryContact, userName, userById } from '../state.js';
import { esc, badge, callButton, fmtDate, fmtDateTime, fmtMin, fmtKpa, lockBanner, icon, DAY } from '../ui.js';
import { markDone } from './upkeep.js';

const RANK = { overdue: 3, due: 2, unset: 1, ok: 0 };

export async function render(root, app) {
  const s = app.settings;
  const [sessions, log, active, lock] = await Promise.all([db.all('sessions'), db.all('maint'), getKV('active'), getKV('lock')]);
  const statuses = computeStatuses(s, sessions, log);
  // The tablet backup countdown is always shown; everything else only when it needs attention.
  const due = statuses.filter((t) => t.status !== 'ok' || t.id === 'tabletBackup').sort((a, b) => RANK[b.status] - RANK[a.status]);
  const last = [...sessions].sort((a, b) => b.at - a.at)[0];
  const locked = lock && lock.until > Date.now();
  const needsBackup = sessions.length > 0 && Date.now() - (s.lastBackupAt || 0) > 30 * DAY;

  root.innerHTML = `
    <section class="hero">
      <img class="hero-media" src="media/hero.jpg" alt="The HPO Tech chamber, three-quarter view">
      <div class="hero-overlay">
        <div class="hero-kicker">HPO Tech chamber</div>
        <div class="hero-title">Zeugma</div>
      </div>
    </section>
    ${locked ? lockBanner(lock) : ''}
    ${
      active
        ? resumeCard(active, s)
        : `<a class="btn btn-hero btn-primary${locked ? ' disabled' : ''}" ${locked ? 'aria-disabled="true"' : 'href="#/session"'}>${icon(
            'play',
          )} Start session</a>`
    }
    <section class="section">
      <div class="section-head"><h2>Maintenance</h2><a href="#/upkeep" class="link">All tasks →</a></div>
      ${due.some((t) => t.status !== 'ok') ? '' : '<div class="card muted">All caught up. Nothing is due.</div>'}
      ${due.map((t) => dueRow(t, s)).join('')}
    </section>
    <section class="section">
      <div class="section-head"><h2>Last session</h2><a href="#/log" class="link">Log →</a></div>
      ${last ? lastCard(last, s) : '<div class="card muted">No sessions logged yet.</div>'}
    </section>
    ${
      needsBackup
        ? `<a class="banner banner-info" href="#/settings">${icon('info')}<div><strong>Back up your data</strong>
           <div class="small">Last backup: ${s.lastBackupAt ? fmtDate(s.lastBackupAt) : 'never'}. Tap to open Settings.</div></div></a>`
        : ''
    }
    <div class="grid2">
      <a class="btn" href="#/safety">${icon('safety')} Safety</a>
      <a class="btn" href="#/protocols">${icon('protocols')} Protocols</a>
    </div>`;

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act="done"]');
    if (!b) return;
    if (await markDone(statuses.find((t) => t.id === b.dataset.id), app)) app.rerender();
  };
}

function resumeCard(a, s) {
  const i = currentPhaseIndex(a, s);
  const where = i < PHASES.length ? PHASES[i].title : 'Ready to log';
  return `<a class="card resume" href="#/session"><span class="pulse"></span>
    <div class="grow"><div class="strong">Session in progress</div>
    <div class="muted small">${esc(userName(s, a.userId))} · ${esc(where)} · tap to resume</div></div>${icon('play')}</a>`;
}

function dueRow(t, s) {
  return `<div class="card task task-${t.status}">
    <div class="task-row">
      <div class="grow"><div class="task-name">${esc(t.name)} ${badge(t.status)}</div>
      <div class="muted small">${esc(t.progress)}</div></div>
      <button class="btn btn-sm" data-act="done" data-id="${t.id}">${t.status === 'unset' ? 'Set date' : 'Done'}</button>
    </div>
    ${t.id === 'annual' && t.status !== 'unset' ? callButton(primaryContact(s), { small: true, label: `Book with ${primaryContact(s).name}` }) : ''}
  </div>`;
}

function lastCard(x, s) {
  const u = userById(s, x.userId);
  return `<a class="card entry" href="#/log/edit/${x.id}">
    <div class="entry-top"><span class="strong">${esc(fmtDateTime(x.at))}</span>
    <span class="chip" style="--c:${u?.color || '#999'}">${esc(u?.name || '—')}</span></div>
    <div>${esc(x.protocol || 'Unnamed protocol')}${x.maxPressure != null ? ` · ${fmtKpa(x.maxPressure)}` : ''}</div>
    <div class="muted small">${fmtMin(x.actualMin)}${x.outcome === 'stopped' ? ' · stopped early' : ' · completed'} · feeling ${
      x.feeling ? `${x.feeling}/5` : '—'
    }${x.uvcRun ? ' · UVC run' : ''}</div>
  </a>`;
}
