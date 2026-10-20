import { db, getKV, delKV } from '../db.js';
import { userById } from '../state.js';
import { sessionsToCsv, earAttempts } from '../data.js';
import { parseTabletCsv, matchSession } from '../tablet.js';
import { pauseStats } from './session.js';
import {
  esc, uid, num, sum, segmented, userPicker, fmtDateTime, fmtMin, fmtKpa, fmtTemp, toLocalInput, fromLocalInput, todayISO,
  toast, confirmBox, modal, shareOrDownload, icon,
} from '../ui.js';

let filter = 'all';
const charts = [];
const destroyCharts = () => charts.splice(0).forEach((c) => c.destroy());

function chartDefaults() {
  const Chart = window.Chart;
  if (!Chart) return null;
  Chart.defaults.color = '#a39dbd';
  Chart.defaults.borderColor = 'rgba(167,139,250,.12)';
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  return Chart;
}

export async function renderList(root, app) {
  const s = app.settings;
  const [sessionsAll, runs] = await Promise.all([db.all('sessions'), db.all('runs')]);
  const all = sessionsAll.sort((a, b) => b.at - a.at);
  const withRun = new Set(runs.map((r) => r.sessionId));
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
    <label class="btn btn-block">${icon('log')} Import tablet CSV files
      <input type="file" name="tabletFiles" accept=".csv,text/csv,text/plain" multiple class="vh"></label>
    <section class="card"><h3>Sessions per week</h3><div class="chart-box"><canvas id="chWeek"></canvas></div></section>
    <section class="card"><h3>Hours per week</h3><div class="chart-box"><canvas id="chHours"></canvas></div></section>
    <section class="card"><h3>Monthly totals</h3>${monthlyTable(list)}</section>
    <h2 class="section-title">Entries</h2>
    <div class="stack">${list.length ? list.map((x) => entryCard(x, s, withRun.has(x.id))).join('') : '<div class="card muted">No sessions logged yet.</div>'}</div>`;

  drawCharts(list, s);
  root.onchange = async (e) => {
    if (e.target.name === 'filter') {
      filter = e.target.value;
      app.rerender();
    } else if (e.target.name === 'tabletFiles' && e.target.files.length) {
      const files = [...e.target.files];
      e.target.value = '';
      await importTabletFiles(files, app);
    }
  };
  root.onclick = async (e) => {
    if (e.target.closest('[data-act="csv"]')) {
      await shareOrDownload(`zeugma-sessions-${todayISO()}.csv`, 'text/csv', sessionsToCsv(all, s));
    }
  };
  return destroyCharts;
}

// Import tablet CSVs: attach each to the matching log entry, or create an entry when none matches.
async function importTabletFiles(files, app) {
  const [sessions, runs] = await Promise.all([db.all('sessions'), db.all('runs')]);
  const taken = new Set(runs.map((r) => r.sessionId));
  const results = [];
  for (const file of files) {
    try {
      const run = parseTabletCsv(await file.text(), file.name, file.lastModified);
      if (runs.some((r) => r.start === run.start && r.points.length === run.points.length)) {
        results.push({ file: file.name, kind: 'skip', text: 'Already imported' });
        continue;
      }
      let entry = matchSession(run, sessions, taken);
      const created = !entry;
      if (created) {
        entry = {
          id: uid(),
          at: run.start,
          userId: '',
          protocol: '',
          outcome: 'completed',
          uvcRun: false,
          notes: '',
          fromTablet: true,
          createdAt: Date.now(),
        };
        sessions.push(entry);
      }
      entry.maxPressure ??= run.stats.maxKpa;
      entry.actualMin ??= run.stats.durationMin;
      entry.updatedAt = Date.now();
      await db.put('sessions', entry);
      await db.put('runs', { id: uid(), sessionId: entry.id, importedAt: Date.now(), ...run });
      taken.add(entry.id);
      results.push({
        file: file.name,
        kind: created ? 'new' : 'ok',
        id: entry.id,
        text: `${fmtDateTime(run.start)} · ${fmtMin(run.stats.durationMin)} · max ${fmtKpa(run.stats.maxKpa)}${
          created ? ' · new entry, set who it was' : ' · attached'
        }`,
      });
    } catch (err) {
      results.push({ file: file.name, kind: 'err', text: err.message });
    }
  }
  if (results.some((r) => r.kind === 'ok' || r.kind === 'new')) {
    await db.put('maint', { id: uid(), taskId: 'tabletBackup', at: Date.now(), userId: app.settings.users[0].id, note: `Imported ${files.length} tablet file(s)` });
  }
  const m = modal(`<h2>Tablet import</h2>
    <div class="stack">${results
      .map(
        (r) => `<div class="import-row import-${r.kind}"><div class="strong small">${esc(r.file)}</div><div class="small">${esc(r.text)}</div>
          ${r.kind === 'new' ? `<a class="link small" href="#/log/edit/${r.id}" data-close>Open entry →</a>` : ''}</div>`,
      )
      .join('')}</div>
    <button class="btn btn-primary" data-close>Done</button>`, { onClose: () => app.rerender() });
  return m;
}

function weekStart(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function drawCharts(list, s) {
  const Chart = chartDefaults();
  if (!Chart) return;
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

function entryCard(x, s, hasRun) {
  const u = userById(s, x.userId);
  const ears = earAttempts(x);
  return `<a class="card entry" href="#/log/edit/${x.id}">
    <div class="entry-top"><span class="strong">${esc(fmtDateTime(x.at))}</span>
      ${u ? `<span class="chip" style="--c:${u.color}">${esc(u.name)}</span>` : '<span class="badge badge-info">Who?</span>'}</div>
    <div>${esc(x.protocol || 'Unnamed protocol')}${x.maxPressure != null ? ` · ${fmtKpa(x.maxPressure)}` : ''}</div>
    <div class="muted small">${fmtMin(x.actualMin)}${x.plannedMin ? ` of ${fmtMin(x.plannedMin)}` : ''} · feeling ${x.feeling ? `${x.feeling}/5` : '—'}${
      x.pauseCount ? ` · ${x.pauseCount} pause${x.pauseCount === 1 ? '' : 's'}` : ''
    }${x.uvcRun ? ' · UVC' : ''}${hasRun ? ' · tablet data' : ''}</div>
    ${x.outcome === 'stopped' ? `<div class="note-warn">Stopped early${x.stopReason ? `: ${esc(x.stopReason)}` : ''}</div>` : ''}
    ${ears ? `<div class="note-warn">Ear trouble: ${ears} attempt${ears === 1 ? '' : 's'}${x.earNotes ? `. ${esc(x.earNotes)}` : ''}</div>` : ''}
    ${x.notes ? `<div class="small">${esc(x.notes)}</div>` : ''}
  </a>`;
}

function tabletCard(run) {
  const st = run.stats;
  const o2High = st.maxO2 != null && st.maxO2 >= 23;
  return `<section class="card stack">
    <div class="task-head"><h3>Tablet data</h3><span class="muted small">${esc(run.fileName)}</span></div>
    <div class="chart-box"><canvas id="chRun"></canvas></div>
    <div class="grid2 small">
      <div><div class="muted">Max pressure</div><div class="strong">${fmtKpa(st.maxKpa)}</div></div>
      <div><div class="muted">Duration</div><div class="strong">${fmtMin(st.durationMin)}</div></div>
      <div><div class="muted">Avg temperature</div><div class="strong">${st.avgTemp != null ? fmtTemp(st.avgTemp) : '—'}</div></div>
      <div><div class="muted">Avg humidity</div><div class="strong">${st.avgHumidity != null ? `${st.avgHumidity}%` : '—'}</div></div>
      <div><div class="muted">Max chamber O₂</div><div class="strong${o2High ? ' danger-text' : ''}">${st.maxO2 != null ? `${st.maxO2}%` : '—'}</div></div>
      <div><div class="muted">Readings</div><div class="strong">${run.points.length}</div></div>
    </div>
    ${o2High ? `<div class="banner banner-danger">${icon('alert')}<div>Chamber O₂ reached ${st.maxO2}% during this session (limit 23%). Tell the installer.</div></div>` : ''}
    <p class="muted small">Chamber readings are the chamber air, not the gas in the mask.</p>
    <button type="button" class="btn btn-ghost btn-danger-text btn-sm" data-act="detach-run">Remove tablet data from this entry</button>
  </section>`;
}

function drawRunChart(run) {
  const Chart = chartDefaults();
  const canvas = document.getElementById('chRun');
  if (!Chart || !canvas) return;
  const t0 = run.points[0][0];
  charts.push(
    new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Pressure (kPa)',
            data: run.points.map((p) => ({ x: (p[0] - t0) / 60000, y: p[1] })),
            borderColor: '#a78bfa',
            backgroundColor: 'rgba(167,139,250,.18)',
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { type: 'linear', title: { display: true, text: 'minutes' }, ticks: { maxTicksLimit: 7 } },
          y: { beginAtZero: true, title: { display: true, text: 'kPa' } },
        },
      },
    }),
  );
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
    const ps = pauseStats(active, end);
    rec = {
      at: active.playAt || active.startedAt,
      userId: active.userId,
      protocol: active.protocolName,
      maxPressure: active.maxPressure,
      plannedMin: active.plannedMin,
      actualMin: active.playAt ? Math.round((end - active.playAt) / 60000) : null,
      outcome: 'completed',
      uvcRun: !!active.checks.uvc,
      earAttempts: active.earAttempts || 0,
      pauseCount: ps.count,
      longestPauseMin: ps.count ? Math.round(ps.longestMs / 6000) / 10 : 0,
    };
  } else {
    rec = { at: Date.now(), userId: s.users[0].id, outcome: 'completed', uvcRun: false, earAttempts: 0, pauseCount: 0 };
  }
  const [protocols, runs] = await Promise.all([db.all('protocols'), db.all('runs')]);
  const run = rec.id ? runs.find((r) => r.sessionId === rec.id) : null;
  const yesNo = (name, val) => segmented(name, [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }], val ? 'yes' : 'no');

  root.innerHTML = `
    <form id="f" class="stack">
      ${mode === 'finish' ? `<div class="banner banner-ok">${icon('check')}<div><strong>Checklist complete.</strong><div class="small">Review and save the log entry.</div></div></div>` : ''}
      ${rec.fromTablet && !rec.userId ? `<div class="banner banner-info">${icon('info')}<div>Created from a tablet file. Pick who it was and add the details.</div></div>` : ''}
      <div class="card stack">
        <label class="field"><span>Date & time</span><input type="datetime-local" name="at" value="${toLocalInput(rec.at)}" required></label>
        <div class="field"><span>Who</span>${userPicker('userId', s, rec.userId ?? '')}</div>
        <label class="field"><span>Protocol</span><input name="protocol" list="protoList" autocomplete="off" value="${esc(rec.protocol || '')}">
          <datalist id="protoList">${protocols.map((p) => `<option value="${esc(p.name)}">`).join('')}</datalist></label>
        <div class="grid3">
          <label class="field"><span>Max kPa</span><input type="number" inputmode="decimal" name="maxPressure" value="${rec.maxPressure ?? ''}"></label>
          <label class="field"><span>Planned min</span><input type="number" inputmode="numeric" name="plannedMin" value="${rec.plannedMin ?? ''}"></label>
          <label class="field"><span>Actual min</span><input type="number" inputmode="numeric" name="actualMin" value="${rec.actualMin ?? ''}"></label>
        </div>
      </div>
      ${run ? tabletCard(run) : ''}
      <div class="card stack">
        <div class="field"><span>Outcome</span>${segmented('outcome', [{ value: 'completed', label: 'Completed' }, { value: 'stopped', label: 'Stopped early' }], rec.outcome)}</div>
        <label class="field" data-show="outcome=stopped"><span>Why did it stop early?</span><textarea name="stopReason" rows="2">${esc(rec.stopReason || '')}</textarea></label>
        <div class="grid3">
          <label class="field"><span>Ear attempts</span><input type="number" inputmode="numeric" min="0" name="earAttempts" value="${earAttempts(rec)}"></label>
          <label class="field"><span>Pauses</span><input type="number" inputmode="numeric" min="0" name="pauseCount" value="${rec.pauseCount ?? 0}"></label>
          <label class="field"><span>Longest (min)</span><input type="number" inputmode="decimal" min="0" step="0.1" name="longestPauseMin" value="${rec.longestPauseMin ?? ''}"></label>
        </div>
        <label class="field" data-show="earAttempts>0"><span>Ear notes</span><textarea name="earNotes" rows="2">${esc(rec.earNotes || '')}</textarea></label>
        <div class="field"><span>How did you feel?</span>
          ${segmented('feeling', [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })), rec.feeling)}
          <div class="feel-labels"><span>1 · poor</span><span>5 · great</span></div></div>
        <div class="field"><span>UVC run afterwards?</span>${yesNo('uvcRun', rec.uvcRun)}</div>
        <label class="field"><span>Issues / notes</span><textarea name="notes" rows="3">${esc(rec.notes || '')}</textarea></label>
      </div>
      <button class="btn btn-hero btn-primary">Save session</button>
      ${mode === 'edit' ? '<button type="button" class="btn btn-ghost btn-danger-text" data-act="delete">Delete this entry</button>' : ''}
    </form>`;

  if (run) drawRunChart(run);
  const form = root.querySelector('#f');
  const f = form.elements;
  const syncShow = () =>
    form.querySelectorAll('[data-show]').forEach((el) => {
      const [, k, op, v] = el.dataset.show.match(/^(\w+)([=>])(.*)$/);
      el.hidden = op === '>' ? !(Number(f[k].value) > Number(v)) : f[k].value !== v;
    });
  form.oninput = form.onchange = syncShow;
  syncShow();

  form.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
    if (await confirmBox(run ? 'Delete this log entry and its tablet data?' : 'Delete this log entry?', { ok: 'Delete', danger: true })) {
      await db.del('sessions', rec.id);
      if (run) await db.del('runs', run.id);
      toast('Entry deleted');
      location.hash = '#/log';
    }
  });
  form.querySelector('[data-act="detach-run"]')?.addEventListener('click', async () => {
    if (await confirmBox('Remove the tablet data from this entry? You can import the file again later.', { ok: 'Remove', danger: true })) {
      await db.del('runs', run.id);
      app.rerender();
    }
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!f.userId.value) {
      toast('Pick who was in the chamber');
      return;
    }
    const ears = num(f.earAttempts.value) || 0;
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
      earAttempts: ears,
      earTrouble: ears > 0,
      earNotes: ears > 0 ? f.earNotes.value.trim() : '',
      pauseCount: num(f.pauseCount.value) || 0,
      longestPauseMin: num(f.longestPauseMin.value),
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
  return destroyCharts;
}
