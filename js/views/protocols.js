import { db } from '../db.js';
import { esc, uid, sum, fmtMin, fmtKpa, icon, toast, confirmBox } from '../ui.js';

const FIRST_BREAK_BY_MIN = 35;
const MAX_O2_BLOCK_MIN = 20;
export const MAX_STEPS = 20;
const LEVELS = ['easy', 'medium', 'hard'];

const blankStep = (kpa = '') => ({ min: '', kpa, level: '', o2: false });

export function protocolSummary(p) {
  return {
    totalMin: sum(p.steps.map((x) => x.min)),
    maxKpa: Math.max(0, ...p.steps.map((x) => Number(x.kpa) || 0)),
    o2Min: sum(p.steps.filter((x) => x.o2).map((x) => x.min)),
  };
}

export function validateProtocol(p) {
  const errors = [];
  const warnings = [];
  if (!p.name.trim()) errors.push('Give the protocol a name.');
  if (!p.steps.length) errors.push('Add at least one step.');
  if (p.steps.length > MAX_STEPS) errors.push(`The tablet allows at most ${MAX_STEPS} steps (this has ${p.steps.length}).`);
  p.steps.forEach((x, i) => {
    if (!(Number(x.min) > 0)) errors.push(`Step ${i + 1}: time must be more than 0 min.`);
    if (x.kpa === '' || Number(x.kpa) < 0) errors.push(`Step ${i + 1}: enter a pressure (0 or more kPa).`);
  });
  const last = p.steps[p.steps.length - 1];
  if (last && last.kpa !== '' && Number(last.kpa) !== 0) errors.push('The last step must end at 0 kPa.');

  // Consecutive oxygen-on steps form one oxygen block; the gap between blocks is an air break.
  const blocks = [];
  let t = 0;
  let cur = null;
  for (const x of p.steps) {
    const m = Number(x.min) || 0;
    if (x.o2) {
      cur ??= { start: t, len: 0 };
      cur.len += m;
    } else if (cur) {
      blocks.push(cur);
      cur = null;
    }
    t += m;
  }
  if (cur) blocks.push(cur);
  if (blocks.length) {
    const firstBreak = blocks[0].start + blocks[0].len;
    if (firstBreak > FIRST_BREAK_BY_MIN) {
      warnings.push(`No air break within the first ${FIRST_BREAK_BY_MIN} min. The first break starts at minute ${firstBreak}.`);
    }
    blocks.slice(1).forEach((b, i) => {
      if (b.len > MAX_O2_BLOCK_MIN) {
        warnings.push(`Oxygen block ${i + 2} runs ${b.len} min without an air break (keep it to about ${MAX_O2_BLOCK_MIN} min).`);
      }
    });
  }
  return { errors, warnings };
}

const TABLET_REMINDER = `<div class="banner banner-info">${icon('info')}<div class="stack">
  <div><strong>Saving on the tablet:</strong> tap <strong>Activate Protocol</strong> and <strong>Update Protocol</strong> → Yes.</div>
  <div><strong>To edit later:</strong> Update Protocols → Yes → make the change → Activate again.</div>
  <div class="small">An active protocol can't be deleted on the tablet.</div></div></div>`;

export async function renderList(root) {
  const list = (await db.all('protocols')).sort((a, b) => a.name.localeCompare(b.name));
  root.innerHTML = `
    ${TABLET_REMINDER}
    <a class="btn btn-primary btn-block" href="#/protocols/new">+ New protocol</a>
    <div class="stack">${
      list.length
        ? list
            .map((p) => {
              const sm = protocolSummary(p);
              const v = validateProtocol(p);
              const flag = v.errors.length
                ? '<span class="badge badge-danger">Fix</span>'
                : v.warnings.length
                  ? '<span class="badge badge-warn">Check</span>'
                  : '';
              return `<a class="card entry" href="#/protocols/${p.id}">
                <div class="entry-top"><span class="strong">${esc(p.name)}</span>${flag}</div>
                <div class="muted small">${fmtMin(sm.totalMin)} · max ${fmtKpa(sm.maxKpa)} · O₂ ${fmtMin(sm.o2Min)} · ${p.steps.length} steps</div></a>`;
            })
            .join('')
        : '<div class="card muted">No protocols saved yet.</div>'
    }</div>`;
}

export async function renderEditor(root, app, id) {
  const existing = id === 'new' ? null : await db.get('protocols', id);
  if (id !== 'new' && !existing) {
    location.hash = '#/protocols';
    return;
  }
  const p = existing ? structuredClone(existing) : { id: uid(), name: '', notes: '', steps: [blankStep(), blankStep(0)] };

  root.innerHTML = `
    <form id="pf" class="stack">
      <label class="field"><span>Protocol name</span><input name="pname" autocomplete="off" value="${esc(p.name)}"></label>
      <div class="card"><h3>Steps</h3>
        <p class="muted small">Up to ${MAX_STEPS} steps. Time in minutes, target pressure in kPa, compression level, oxygen on/off.</p>
        <div id="steps"></div>
        <button type="button" class="btn btn-block" data-act="add">+ Add step at end</button>
        <p class="muted small center" id="stepCount"></p></div>
      <div id="summary"></div>
      <div id="validation" class="stack"></div>
      <label class="field"><span>Notes</span><textarea name="pnotes" rows="3">${esc(p.notes || '')}</textarea></label>
      ${TABLET_REMINDER}
      <button class="btn btn-hero btn-primary">Save protocol</button>
      ${existing ? '<button type="button" class="btn btn-ghost btn-danger-text" data-act="delete">Delete protocol</button>' : ''}
    </form>`;

  const form = root.querySelector('#pf');
  const stepsEl = root.querySelector('#steps');

  const refresh = () => {
    let t = 0;
    stepsEl.querySelectorAll('.step-start').forEach((el, i) => {
      el.textContent = `starts at ${t} min`;
      t += Number(p.steps[i].min) || 0;
    });
    const sm = protocolSummary(p);
    root.querySelector('#summary').innerHTML = `<div class="stats">
      <div class="stat"><div class="stat-num">${sm.totalMin}</div><div class="stat-label">total min</div></div>
      <div class="stat"><div class="stat-num">${sm.maxKpa}</div><div class="stat-label">max kPa · ${Math.round(sm.maxKpa) / 100} bar</div></div>
      <div class="stat"><div class="stat-num">${sm.o2Min}</div><div class="stat-label">O₂ min</div></div></div>`;
    const full = p.steps.length >= MAX_STEPS;
    root.querySelector('#stepCount').textContent = `${p.steps.length} of ${MAX_STEPS} steps`;
    root.querySelectorAll('[data-act="add"], [data-act="ins"]').forEach((b) => (b.disabled = full));
    const v = validateProtocol(p);
    root.querySelector('#validation').innerHTML =
      v.errors.map((x) => `<div class="banner banner-danger">${icon('alert')}<div>${esc(x)}</div></div>`).join('') +
      v.warnings.map((x) => `<div class="banner banner-warn">${icon('alert')}<div>${esc(x)}</div></div>`).join('') +
      (v.errors.length || v.warnings.length ? '' : `<div class="banner banner-ok">${icon('check')}<div>Looks good.</div></div>`);
  };

  const drawSteps = () => {
    stepsEl.innerHTML = p.steps
      .map(
        (x, i) => `<div class="step" data-i="${i}">
          <div class="step-top"><span class="strong">Step ${i + 1}</span><span class="step-start muted small"></span>
            <label class="o2-toggle"><input type="checkbox" data-k="o2"${x.o2 ? ' checked' : ''}> O₂</label>
            <button type="button" class="icon-btn" data-act="ins" aria-label="Insert a step above">＋</button>
            <button type="button" class="icon-btn danger" data-act="del" aria-label="Delete step">✕</button></div>
          <div class="grid3">
            <label class="mini"><span>Minutes</span><input type="number" inputmode="decimal" min="0" data-k="min" value="${x.min}"></label>
            <label class="mini"><span>kPa</span><input type="number" inputmode="decimal" min="0" data-k="kpa" value="${x.kpa}"></label>
            <label class="mini"><span>Compression</span><select data-k="level"><option value="">—</option>${LEVELS.map(
              (l) => `<option value="${l}"${x.level === l ? ' selected' : ''}>${l}</option>`,
            ).join('')}</select></label>
          </div></div>`,
      )
      .join('');
    refresh();
  };
  drawSteps();

  stepsEl.oninput = stepsEl.onchange = (e) => {
    const row = e.target.closest('.step');
    const k = e.target.dataset.k;
    if (!row || !k) return;
    const v = e.target.value;
    p.steps[Number(row.dataset.i)][k] = k === 'o2' ? e.target.checked : k === 'level' || v === '' ? v : Number(v);
    refresh();
  };
  form.elements.pname.oninput = (e) => {
    p.name = e.target.value;
    refresh();
  };

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const i = Number(b.closest('.step')?.dataset.i);
    if ((b.dataset.act === 'add' || b.dataset.act === 'ins') && p.steps.length >= MAX_STEPS) return toast(`At most ${MAX_STEPS} steps`);
    if (b.dataset.act === 'add') p.steps.push(blankStep());
    else if (b.dataset.act === 'ins') p.steps.splice(i, 0, blankStep());
    else if (b.dataset.act === 'del') {
      if (p.steps.length === 1) return toast('A protocol needs at least one step');
      p.steps.splice(i, 1);
    } else if (b.dataset.act === 'delete') {
      if (await confirmBox(`Delete "${p.name}"?`, { ok: 'Delete', danger: true })) {
        await db.del('protocols', p.id);
        location.hash = '#/protocols';
      }
      return;
    } else return;
    drawSteps();
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    p.name = form.elements.pname.value.trim();
    p.notes = form.elements.pnotes.value;
    const v = validateProtocol(p);
    if (v.errors.length) {
      refresh();
      root.querySelector('#validation').scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('Fix the errors first');
      return;
    }
    if (v.warnings.length && !(await confirmBox(`Save with ${v.warnings.length} warning(s)?`, { ok: 'Save anyway' }))) return;
    p.updatedAt = Date.now();
    await db.put('protocols', p);
    toast('Saved. On the tablet: Activate Protocol and Update Protocol → Yes.');
    location.hash = '#/protocols';
  };
}
