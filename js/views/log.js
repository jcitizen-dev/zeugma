import { db, getKV, delKV } from '../db.js';
import { userById } from '../state.js';
import { sessionsToCsv } from '../data.js';
import {
  esc, uid, num, sum, segmented, userPicker, fmtDateTime, fmtMin, toLocalInput, fromLocalInput, todayISO,
  toast, confirmBox, shareOrDownload, icon,
} from '../ui.js';

let filter = 'all';
const charts = [];

export async function renderList(root, app) {
  const s = app.settings;
  const all = (await db.all('sessions')).sort((a, b) => b.at - a.at);
  const list = filter === 'all' ? all : all.filter((x) => x.userId === filter);
  const totalMin = sum(list.map((x) => x.actualMin));
  const felt = list.filter((x) => x.feeling);
  const avgFeel = felt.length ? (sum(felt.map((x) => x.feeling)) / felt.length).toFixed(1) : '—';

  root.innerHTML = `
    ${segmented('filter', [{ value: 'all', label: 'Everyone' }, ...s.users.map((u) => ({ value: u.id, label: u.name }))], filter)}
    <div class="stats">
      <div class="stat"><div class="stat-num">${list.length}</div><div class="stat-label">sessions</div></div>
      <div class="stat"><div class="stat-num">${(totalMin / 60).toFixed(1)}</div><div class="stat-label">hours</div></div>
      <div class="stat"><div class="stat-num">${avgFeel}</div><div class="stat-label">avg feeling</div></div>
    </div>
    <div class="grid2">
      <a class="btn btn-primary" href="#/log/new">+ Add entry</a>
      <button class="btn" data-act="csv">Export CSV</button>
    </div>
    <section class="card"><h3>Sessions per week</h3><div class="chart-box"><canvas id="chWeek"></canvas></div></section>
    <section class="card"><h3>Hours per week</h3><div class="chart-box"><canvas id="chHours"></canvas></div></section>
    <section class="card"><h3>Monthly totals</h3>${monthlyTable(list)}</section>
    <h2 class="section-title">Entries</h2>
    <div class="stack">${list.length ? list.map((x) => entryCard(x, s)).join('') : '<div class="card muted">No sessions logged yet.</div>'}</div>`;

  drawCharts(list, s);
  root.onchange = (e) => {
    if (e.target.name === 'filter') {
      filter = e.target.value;
      app.rerender();
    }
  };
  root.onclick = async (e) => {
    if (e.target.closest('[data-act="csv"]')) {
      await shareOrDownload(`zeugma-sessions-${todayISO()}.csv`, 'text/csv', sessionsToCsv(all, s));
    }
  };
  return () => charts.splice(0).forEach((c) => c.destroy());
}

function weekStart(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function drawCharts(list, s) {
  const Chart = window.Chart;
  if (!Chart) return;
  Chart.defaults.color = '#a39dbd';
  Chart.defaults.borderColor = 'rgba(167,139,250,.12)';
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  const thisWeek = weekStart(Date.now());
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - 7 * (11 - i));
    return d.getTime();
  });
  const labels = weeks.map((w) => new Date(w).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  const users = filter === 'all' ? s.users : s.users.filter((u) => u.id === filter);
  const datasets = (fn) =>
    users.map((u) => ({
      label: u.name,
      backgroundColor: u.color,
      borderRadius: 4,
      data: weeks.map((w) => fn(list.filter((x) => x.userId === u.id && weekStart(x.at) === w))),
    }));
  const options = (integer) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: users.length > 1, labels: { boxWidth: 12 } } },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
      y: { stacked: true, beginAtZero: true, ticks: integer ? { precision: 0 } : {} },
    },
  });
  charts.push(
    new Chart(document.getElementById('chWeek'), { type: 'bar', data: { labels, datasets: datasets((xs) => xs.length) }, options: options(true) }),
    new Chart(document.getElementById('chHours'), {
      type: 'bar',
      data: { labels, datasets: datasets((xs) => Math.round((sum(xs.map((x) => x.actualMin)) / 60) * 100) / 100) },
      options: options(false),
    }),
  );
}

function monthlyTable(list) {
  const months = new Map();
  for (const x of list) {
    const d = new Date(x.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const m = months.get(key) || { label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), n: 0, min: 0 };
    m.n += 1;
    m.min += Number(x.actualMin) || 0;
    months.set(key, m);
  }
  const rows = [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  if (!rows.length) return '<p class="muted small">Nothing yet.</p>';
  return `<table><thead><tr><th>Month</th><th class="num">Sessions</th><th class="num">Hours</th></tr></thead><tbody>
    ${rows.map(([, m]) => `<tr><td>${esc(m.label)}</td><td class="num">${m.n}</td><td class="num">${(m.min / 60).toFixed(1)}</td></tr>`).join('')}
  </tbody></table>`;
}

function entryCard(x, s) {
  const u = userById(s, x.userId);
  return `<a class="card entry" href="#/log/edit/${x.id}">
    <div class="entry-top"><span class="strong">${esc(fmtDateTime(x.at))}</span>
      <span class="chip" style="--c:${u?.color || '#999'}">${esc(u?.name || '—')}</span></div>
    <div>${esc(x.protocol || 'Unnamed protocol')}${x.maxPressure != null ? ` · ${x.maxPressure} kPa` : ''}</div>
    <div class="muted small">${fmtMin(x.actualMin)}${x.plannedMin ? ` of ${fmtMin(x.plannedMin)}` : ''} · feeling ${x.feeling ? `${x.feeling}/5` : '—'}${
      x.uvcRun ? ' · UVC' : ''
    }</div>
    ${x.outcome === 'stopped' ? `<div class="note-warn">Stopped early${x.stopReason ? `: ${esc(x.stopReason)}` : ''}</div>` : ''}
    ${x.earTrouble ? `<div class="note-warn">Ear trouble${x.earNotes ? `: ${esc(x.earNotes)}` : ''}</div>` : ''}
    ${x.notes ? `<div class="small">${esc(x.notes)}</div>` : ''}
  </a>`;
}

export async function renderForm(root, app, mode, id) {
  const s = app.settings;
  let rec;
  let active = null;
  if (mode === 'edit') {
    rec = await db.get('sessions', id);
    if (!rec) {
      location.hash = '#/log';
      return;
    }
  } else if (mode === 'finish') {
    active = await getKV('active');
    if (!active) {
      location.hash = '#/log/new';
      return;
    }
    const end = active.endAt || Date.now();
    rec = {
      at: active.playAt || active.startedAt,
      userId: active.userId,
      protocol: active.protocolName,
      maxPressure: active.maxPressure,
      plannedMin: active.plannedMin,
      actualMin: active.playAt ? Math.round((end - active.playAt) / 60000) : null,
      outcome: 'completed',
      uvcRun: !!active.checks.uvc,
    };
  } else {
    rec = { at: Date.now(), userId: s.users[0].id, outcome: 'completed', uvcRun: false };
  }
  const protocols = await db.all('protocols');
  const yesNo = (name, val) => segmented(name, [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }], val ? 'yes' : 'no');

  root.innerHTML = `
    <form id="f" class="stack">
      ${mode === 'finish' ? `<div class="banner banner-ok">${icon('check')}<div><strong>Checklist complete.</strong><div class="small">Review and save the log entry.</div></div></div>` : ''}
      <div class="card stack">
        <label class="field"><span>Date & time</span><input type="datetime-local" name="at" value="${toLocalInput(rec.at)}" required></label>
        <div class="field"><span>Who</span>${userPicker('userId', s, rec.userId)}</div>
        <label class="field"><span>Protocol</span><input name="protocol" list="protoList" autocomplete="off" value="${esc(rec.protocol || '')}">
          <datalist id="protoList">${protocols.map((p) => `<option value="${esc(p.name)}">`).join('')}</datalist></label>
        <div class="grid3">
          <label class="field"><span>Max kPa</span><input type="number" inputmode="decimal" name="maxPressure" value="${rec.maxPressure ?? ''}"></label>
          <label class="field"><span>Planned min</span><input type="number" inputmode="numeric" name="plannedMin" value="${rec.plannedMin ?? ''}"></label>
          <label class="field"><span>Actual min</span><input type="number" inputmode="numeric" name="actualMin" value="${rec.actualMin ?? ''}"></label>
        </div>
      </div>
      <div class="card stack">
        <div class="field"><span>Outcome</span>${segmented('outcome', [{ value: 'completed', label: 'Completed' }, { value: 'stopped', label: 'Stopped early' }], rec.outcome)}</div>
        <label class="field" data-show="outcome=stopped"><span>Why did it stop early?</span><textarea name="stopReason" rows="2">${esc(rec.stopReason || '')}</textarea></label>
        <div class="field"><span>Trouble equalizing ears?</span>${yesNo('earTrouble', rec.earTrouble)}</div>
        <label class="field" data-show="earTrouble=yes"><span>Ear notes</span><textarea name="earNotes" rows="2">${esc(rec.earNotes || '')}</textarea></label>
        <div class="field"><span>How did you feel?</span>
          ${segmented('feeling', [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })), rec.feeling)}
          <div class="feel-labels"><span>1 · poor</span><span>5 · great</span></div></div>
        <div class="field"><span>UVC run afterwards?</span>${yesNo('uvcRun', rec.uvcRun)}</div>
        <label class="field"><span>Issues / notes</span><textarea name="notes" rows="3">${esc(rec.notes || '')}</textarea></label>
      </div>
      <button class="btn btn-hero btn-primary">Save session</button>
      ${mode === 'edit' ? '<button type="button" class="btn btn-ghost btn-danger-text" data-act="delete">Delete this entry</button>' : ''}
    </form>`;

  const form = root.querySelector('#f');
  const f = form.elements;
  const syncShow = () =>
    form.querySelectorAll('[data-show]').forEach((el) => {
      const [k, v] = el.dataset.show.split('=');
      el.hidden = f[k].value !== v;
    });
  form.onchange = syncShow;
  syncShow();

  form.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
    if (await confirmBox('Delete this log entry?', { ok: 'Delete', danger: true })) {
      await db.del('sessions', rec.id);
      toast('Entry deleted');
      location.hash = '#/log';
    }
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const out = {
      ...rec,
      id: rec.id || uid(),
      // datetime-local drops seconds; keep the exact time unless it was edited.
      at: f.at.value === toLocalInput(rec.at) ? rec.at : fromLocalInput(f.at.value),
      userId: f.userId.value,
      protocol: f.protocol.value.trim(),
      maxPressure: num(f.maxPressure.value),
      plannedMin: num(f.plannedMin.value),
      actualMin: num(f.actualMin.value),
      outcome: f.outcome.value,
      stopReason: f.outcome.value === 'stopped' ? f.stopReason.value.trim() : '',
      earTrouble: f.earTrouble.value === 'yes',
      earNotes: f.earTrouble.value === 'yes' ? f.earNotes.value.trim() : '',
      feeling: num(f.feeling.value),
      uvcRun: f.uvcRun.value === 'yes',
      notes: f.notes.value.trim(),
      createdAt: rec.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    await db.put('sessions', out);
    if (mode !== 'edit') {
      // Maintenance done as part of this session resets those counters.
      const at = mode === 'finish' ? Date.now() : out.at + 1;
      const auto = [];
      if (out.uvcRun) auto.push('uvc');
      if (active?.checks.chillerLevel) auto.push('chillerLevel');
      if (active?.checks.dryerEmptied) auto.push('dryerEmpty');
      for (const taskId of auto) {
        await db.put('maint', { id: uid(), taskId, at, userId: out.userId, note: 'Recorded from the session' });
      }
    }
    if (mode === 'finish') await delKV('active');
    toast('Session saved');
    location.hash = mode === 'finish' ? '#/home' : '#/log';
  };
}
