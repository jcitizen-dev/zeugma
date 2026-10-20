import { db, getKV, setKV } from '../db.js';
import { computeStatuses } from '../maint.js';
import { primaryContact, userName } from '../state.js';
import { esc, uid, badge, callButton, fmtDateTime, toLocalInput, fromLocalInput, todayISO, lockBanner, modal, toast, userPicker } from '../ui.js';

export async function render(root, app) {
  const s = app.settings;
  const [sessions, log, lock] = await Promise.all([db.all('sessions'), db.all('maint'), getKV('lock')]);
  const statuses = computeStatuses(s, sessions, log);
  const locked = lock && lock.until > Date.now();
  const assigned = s.masks.map((m, i) => `#${i + 1}: ${m.userId ? esc(userName(s, m.userId)) : 'spare'}`).join(' · ');

  root.innerHTML = `
    ${locked ? lockBanner(lock) : ''}
    <p class="muted small">Intervals can be changed in <a href="#/settings">Settings</a>.</p>
    ${statuses.map((t) => taskCard(t, s)).join('')}
    <section class="card stack"><h3>Masks (6)</h3><p class="small">${assigned}</p>
      <p class="muted small">Assign masks in Settings. Each assigned mask gets its own cleaning reminder.</p></section>`;

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act="done"]');
    if (b && (await markDone(statuses.find((t) => t.id === b.dataset.id), app))) app.rerender();
  };
}

function taskCard(t, s) {
  const lastLine = t.last
    ? `Last done ${esc(fmtDateTime(t.last.at))} by ${esc(userName(s, t.last.userId))}`
    : t.id === 'annual'
      ? ''
      : 'Not done yet in Zeugma';
  return `<article class="card task task-${t.status}">
    <div class="task-head"><h3>${esc(t.name)}</h3>${badge(t.status)}</div>
    <div class="small">${esc(t.progress)}</div>
    ${lastLine ? `<div class="muted small">${lastLine}</div>` : ''}
    ${t.auto ? `<div class="muted small">${esc(t.auto)}</div>` : ''}
    ${t.steps?.length ? `<details class="more"><summary>Steps</summary><ol class="steps">${t.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>` : ''}
    ${
      t.history.length
        ? `<details class="more"><summary>History (${t.history.length})</summary><ul class="history">${t.history
            .slice(0, 12)
            .map((h) => `<li>${esc(fmtDateTime(h.at))} · ${esc(userName(s, h.userId))}${h.lysol ? ' · Lysol' : ''}${h.note ? ` · ${esc(h.note)}` : ''}</li>`)
            .join('')}</ul></details>`
        : ''
    }
    <div class="row">${t.id === 'annual' ? callButton(primaryContact(s)) : ''}
      <button class="btn btn-primary" data-act="done" data-id="${t.id}">${t.status === 'unset' ? 'Set last service date' : 'Mark done'}</button></div>
  </article>`;
}

// Opens the "mark done" sheet. Resolves true when an entry was saved.
export function markDone(task, app) {
  const s = app.settings;
  const isAnnual = task.id === 'annual';
  return new Promise((resolve) => {
    let saved = false;
    const m = modal(
      `<h2>${esc(task.name)}</h2>
      ${task.steps?.length ? `<ol class="steps small">${task.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
      <form class="stack" id="md">
        <div class="field"><span>Done by</span>${userPicker('userId', s, task.userId)}</div>
        ${
          isAnnual
            ? `<label class="field"><span>Service date</span><input type="date" name="date" value="${todayISO()}" required></label>`
            : `<label class="field"><span>When</span><input type="datetime-local" name="at" value="${toLocalInput(Date.now())}" required></label>`
        }
        ${
          task.lysol
            ? `<fieldset class="field"><span>What was wiped?</span>
                <label class="checkline"><input type="checkbox" name="surf" value="acrylic"> Acrylic windows</label>
                <label class="checkline"><input type="checkbox" name="surf" value="metal"> Metal</label>
                <label class="checkline"><input type="checkbox" name="surf" value="leather"> Leather</label></fieldset>
              <label class="checkline danger-line"><input type="checkbox" name="lysol"> Used Lysol wipes (locks the chamber for ${s.lysolHours} h)</label>`
            : ''
        }
        <label class="field"><span>Note (optional)</span><input name="note" autocomplete="off"></label>
        <div class="row"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Save</button></div>
      </form>`,
      { onClose: () => resolve(saved) },
    );
    const form = m.el.querySelector('#md');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const f = form.elements;
      const at = isAnnual ? new Date(`${f.date.value}T12:00`).getTime() : fromLocalInput(f.at.value);
      const entry = { id: uid(), taskId: task.id, at, userId: f.userId.value, note: f.note.value.trim() };
      if (task.lysol) {
        entry.surfaces = [...form.querySelectorAll('[name=surf]:checked')].map((x) => x.value);
        entry.lysol = f.lysol.checked;
      }
      await db.put('maint', entry);
      if (entry.lysol) {
        const until = at + s.lysolHours * 3600000;
        if (until > Date.now()) await setKV('lock', { until, at });
      }
      if (isAnnual) {
        s.serviceLastDate = f.date.value;
        await app.save();
      }
      saved = true;
      toast(entry.lysol ? `Logged. Chamber locked for ${s.lysolHours} h.` : 'Marked done');
      m.close();
    };
  });
}
