import { db, getKV, delKV } from '../db.js';
import { VERSION, primaryContact } from '../state.js';
import { buildBackup, restoreBackup, resetAll, sessionsToCsv } from '../data.js';
import { esc, uid, cToF, fmtTemp, fmtDate, fmtDateTime, todayISO, toast, confirmBox, shareOrDownload, callButton } from '../ui.js';
import { computeStatuses } from '../maint.js';

const INTERVALS = [
  ['compressorDrain', 'Drain air compressor'],
  ['dryerEmpty', 'Empty air dryer container'],
  ['chillerLevel', 'Chiller water level check'],
  ['wipeDown', 'Wipe-down'],
];

const getPath = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
function setPath(o, p, v) {
  const keys = p.split('.');
  const last = keys.pop();
  keys.reduce((a, k) => a[k], o)[last] = v;
}

export async function render(root, app) {
  const s = app.settings;
  const lock = await getKV('lock');
  const locked = lock && lock.until > Date.now();
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  const annual = computeStatuses(s, [], []).find((t) => t.id === 'annual');
  const userOptions = s.users.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('');

  root.innerHTML = `
    <section class="card stack"><h3>People</h3>
      ${s.users.map((u, i) => `<label class="field"><span>Person ${i + 1}</span><input data-set="users.${i}.name" autocomplete="off"></label>`).join('')}
    </section>

    <section class="card stack"><h3>Installer contacts</h3>
      <p class="muted small">Every "Call installer" button dials the primary contact.</p>
      ${s.contacts
        .map(
          (c, i) => `<div class="contact-edit stack">
            <div class="row between"><label class="checkline"><input type="radio" name="primary" value="${i}"${c.primary ? ' checked' : ''}> Primary</label>
              <button type="button" class="btn btn-sm btn-ghost btn-danger-text" data-act="del-contact" data-i="${i}">Remove</button></div>
            <div class="grid2">
              <label class="field"><span>Name</span><input data-set="contacts.${i}.name" autocomplete="off"></label>
              <label class="field"><span>Phone</span><input type="tel" data-set="contacts.${i}.phone" placeholder="No number yet"></label>
            </div>
            <div class="grid2">
              <label class="field"><span>Company</span><input data-set="contacts.${i}.org"></label>
              <label class="field"><span>Role</span><input data-set="contacts.${i}.role"></label>
            </div></div>`,
        )
        .join('')}
      <button type="button" class="btn" data-act="add-contact">+ Add contact</button>
    </section>

    <section class="card stack"><h3>Maintenance intervals</h3>
      <p class="muted small">0 means "not used". A task is due when either limit is reached.</p>
      ${INTERVALS.map(
        ([key, label]) => `<div class="field"><span>${label}</span><div class="grid2">
          <label class="inline-num"><input type="number" inputmode="numeric" min="0" data-set="intervals.${key}.sessions"> sessions</label>
          <label class="inline-num"><input type="number" inputmode="numeric" min="0" data-set="intervals.${key}.days"> days</label></div></div>`,
      ).join('')}
      <label class="field"><span>UVC clean cycle</span>
        <select data-set="uvcEvery" data-type="num"><option value="1">After every session</option><option value="2">Every other session</option></select></label>
    </section>

    <section class="card stack"><h3>Masks</h3>
      ${s.masks.map((m, i) => `<label class="inline-field"><span>Mask #${i + 1}</span><select data-set="masks.${i}.userId" data-rerender><option value="">Spare</option>${userOptions}</select></label>`).join('')}
      <div class="field"><span>Clean each assigned mask every</span><div class="grid2">
        <label class="inline-num"><input type="number" inputmode="numeric" min="0" data-set="maskCleanSessions"> sessions</label>
        <label class="inline-num"><input type="number" inputmode="numeric" min="0" data-set="maskCleanDays"> days</label></div></div>
    </section>

    <section class="card stack"><h3>Wipe-down</h3>
      <div class="grid2">
        <label class="field"><span>Acrylic cloth colour</span><input data-set="clothAcrylic" placeholder="e.g. blue"></label>
        <label class="field"><span>Metal cloth colour</span><input data-set="clothMetal" placeholder="e.g. grey"></label>
      </div>
      <label class="inline-field"><span>Lysol lockout (hours)</span><input type="number" inputmode="numeric" min="0" data-set="lysolHours"></label>
      ${locked ? `<div class="banner banner-danger"><div class="grow">Locked until ${esc(fmtDateTime(lock.until))}</div><button type="button" class="btn btn-sm" data-act="clear-lock">Clear lock</button></div>` : ''}
    </section>

    <section class="card stack"><h3>Annual professional service</h3>
      <label class="field"><span>Last service date</span><input type="date" data-set="serviceLastDate" data-rerender></label>
      <div class="grid2">
        <label class="field"><span>Every (months)</span><input type="number" inputmode="numeric" min="1" data-set="serviceMonths" data-rerender></label>
        <label class="field"><span>Remind (days before)</span><input type="number" inputmode="numeric" min="0" data-set="serviceRemindDays" data-rerender></label>
      </div>
      <p class="small">${esc(annual.progress)}</p>
      ${callButton(primaryContact(s), { label: `Book with ${primaryContact(s).name}` })}
    </section>

    <section class="card stack"><h3>Water chiller</h3>
      <label class="field"><span>Setpoint (°C)</span><input type="number" inputmode="decimal" step="0.5" data-set="chillerSetpoint" data-rerender></label>
      <p class="muted small">${fmtTemp(s.chillerSetpoint)}. Never below ${fmtTemp(s.chillerMin)}.</p>
    </section>

    <section class="card stack"><h3>Backup & data</h3>
      <p class="small">Everything is stored only on this device. Back up regularly: if the browser clears its storage, the data is gone.</p>
      <button type="button" class="btn btn-primary" data-act="backup">Back up everything (JSON)</button>
      <label class="btn">Restore from a backup…<input type="file" name="restore" accept="application/json,.json" class="vh"></label>
      <button type="button" class="btn" data-act="csv">Export sessions (CSV)</button>
      <p class="muted small">Last backup: ${s.lastBackupAt ? esc(fmtDate(s.lastBackupAt)) : 'never'}. Attached video files are not included in backups.
        ${persisted === true ? 'Storage is marked persistent.' : persisted === false ? 'Storage is not marked persistent yet. Installing to the home screen helps.' : ''}</p>
      <button type="button" class="btn btn-ghost btn-danger-text" data-act="reset">Erase all data…</button>
    </section>
    <p class="muted small center">Zeugma v${VERSION} · works offline · no account, no server</p>`;

  root.querySelectorAll('[data-set]').forEach((el) => {
    el.value = getPath(s, el.dataset.set) ?? '';
  });

  root.onchange = async (e) => {
    const el = e.target;
    if (el.dataset.set) {
      let v = el.value;
      if (el.type === 'number' || el.dataset.type === 'num') v = v === '' ? 0 : Number(v);
      if (el.dataset.set === 'chillerSetpoint' && v < s.chillerMin) {
        toast(`The setpoint can't be below ${fmtTemp(s.chillerMin)}`);
        el.value = s.chillerSetpoint;
        return;
      }
      setPath(s, el.dataset.set, v);
      await app.save();
      toast('Saved');
      if ('rerender' in el.dataset) app.rerender();
    } else if (el.name === 'primary') {
      s.contacts.forEach((c, i) => (c.primary = i === Number(el.value)));
      await app.save();
      toast('Primary contact updated');
    } else if (el.name === 'restore' && el.files[0]) {
      try {
        const data = JSON.parse(await el.files[0].text());
        if (!(await confirmBox('Replace all data on this device with this backup?', { ok: 'Restore', danger: true }))) return;
        await restoreBackup(data);
        await app.reloadSettings();
        toast('Backup restored');
        app.rerender();
      } catch (err) {
        toast(err.message || 'Could not read that file');
      } finally {
        el.value = '';
      }
    }
  };

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'add-contact') {
      s.contacts.push({ id: uid(), name: '', org: '', role: '', phone: '', primary: false });
      await app.save();
      app.rerender();
    } else if (act === 'del-contact') {
      if (s.contacts.length === 1) return toast('Keep at least one contact');
      const c = s.contacts[Number(b.dataset.i)];
      if (!(await confirmBox(`Remove ${c.name || 'this contact'}?`, { ok: 'Remove', danger: true }))) return;
      s.contacts.splice(Number(b.dataset.i), 1);
      if (!s.contacts.some((x) => x.primary)) s.contacts[0].primary = true;
      await app.save();
      app.rerender();
    } else if (act === 'clear-lock') {
      await delKV('lock');
      toast('Lock cleared');
      app.rerender();
    } else if (act === 'backup') {
      const data = await buildBackup(s);
      await shareOrDownload(`zeugma-backup-${todayISO()}.json`, 'application/json', JSON.stringify(data, null, 2));
      s.lastBackupAt = Date.now();
      await app.save();
      app.rerender();
    } else if (act === 'csv') {
      await shareOrDownload(`zeugma-sessions-${todayISO()}.csv`, 'text/csv', sessionsToCsv(await db.all('sessions'), s));
    } else if (act === 'reset') {
      if (!(await confirmBox('Erase ALL sessions, maintenance history, protocols, videos and settings on this device?', { ok: 'Erase', danger: true }))) return;
      if (!(await confirmBox('Are you sure? This cannot be undone unless you have a backup.', { ok: 'Yes, erase everything', danger: true }))) return;
      await resetAll();
      await app.reloadSettings();
      toast('All data erased');
      location.hash = '#/home';
    }
  };
}
