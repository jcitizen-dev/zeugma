import { db, getKV, setKV, delKV } from '../db.js';
import { PHASES, DURING_REFERENCE, UVC_MINUTES, currentPhaseIndex, detailText, isOptional } from '../content.js';
import { primaryContact, userName } from '../state.js';
import { esc, icon, uid, num, userPicker, confirmBox, lockBanner, fmtMin, fmtClock, refList, callButton } from '../ui.js';
import { protocolSummary } from './protocols.js';

let wakeLock = null;
async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    /* not supported or denied: fine */
  }
}
function onVisible() {
  if (document.visibilityState === 'visible' && (!wakeLock || wakeLock.released)) keepAwake();
}

export async function render(root, app) {
  const [active, lock] = await Promise.all([getKV('active'), getKV('lock')]);
  if (!active) {
    await renderSetup(root, app, lock);
    return;
  }
  renderActive(root, app, active);
  keepAwake();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  };
}

async function renderSetup(root, app, lock) {
  const s = app.settings;
  const protocols = (await db.all('protocols')).sort((a, b) => a.name.localeCompare(b.name));
  const locked = lock && lock.until > Date.now();
  root.innerHTML = `
    ${locked ? lockBanner(lock) : ''}
    <form class="stack" id="setup">
      <div class="card stack">
        <div class="field"><span>Who is going in?</span>${userPicker('user', s)}</div>
        <label class="field"><span>Protocol</span>
          <select name="protocol">
            ${protocols.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
            <option value="">Other (type the name)</option>
          </select></label>
        <label class="field other-name"><span>Protocol name</span>
          <input name="protocolName" autocomplete="off" placeholder="As shown on the tablet"></label>
        <div class="grid2">
          <label class="field"><span>Planned min</span><input name="plannedMin" type="number" inputmode="numeric" min="1"></label>
          <label class="field"><span>Max kPa</span><input name="maxPressure" type="number" inputmode="decimal" min="0"></label>
        </div>
      </div>
      <button class="btn btn-hero btn-primary"${locked ? ' disabled' : ''}>${icon('play')} Begin checklist</button>
      <p class="muted small center">Start 5–10 minutes before getting in.</p>
    </form>`;
  const form = root.querySelector('#setup');
  const f = form.elements;
  const fill = () => {
    const p = protocols.find((x) => x.id === f.protocol.value);
    form.querySelector('.other-name').hidden = !!p;
    if (p) {
      const sm = protocolSummary(p);
      f.plannedMin.value = sm.totalMin || '';
      f.maxPressure.value = sm.maxKpa || '';
    }
  };
  f.protocol.onchange = fill;
  fill();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const p = protocols.find((x) => x.id === f.protocol.value);
    await setKV('active', {
      id: uid(),
      startedAt: Date.now(),
      userId: f.user.value,
      protocolId: p?.id || '',
      protocolName: p ? p.name : f.protocolName.value.trim(),
      plannedMin: num(f.plannedMin.value),
      maxPressure: num(f.maxPressure.value),
      checks: {},
      during: false,
    });
    app.rerender();
  };
}

function renderActive(root, app, a) {
  const s = app.settings;
  const cur = currentPhaseIndex(a, s);
  const elapsed = a.playAt
    ? a.endAt
      ? `<span class="mono big">${fmtClock(a.endAt - a.playAt)}</span>`
      : `<span class="mono big" data-since="${a.playAt}">${fmtClock(Date.now() - a.playAt)}</span>`
    : '<span class="muted small">Timer starts at Play</span>';
  root.innerHTML = `
    <div class="card session-head">
      <div><div class="muted small">${esc(userName(s, a.userId))}</div><div class="strong">${esc(a.protocolName || 'Session')}</div></div>
      <div class="right">${elapsed}${a.plannedMin ? `<div class="muted small">planned ${fmtMin(a.plannedMin)}</div>` : ''}</div>
    </div>
    <ol class="stepper">${PHASES.map((p, i) => `<li class="${i < cur ? 'done' : i === cur ? 'current' : ''}">${esc(p.short)}</li>`).join('')}</ol>
    ${PHASES.map((p, i) => phaseSection(p, i, cur, a, s)).join('')}
    ${cur >= PHASES.length ? `<button class="btn btn-hero btn-primary" data-act="finish">${icon('check')} Finish & log session</button>` : ''}
    <button class="btn btn-ghost btn-danger-text" data-act="discard">Discard this session</button>`;

  root.onclick = async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const before = currentPhaseIndex(a, s);
    if (act === 'toggle') {
      const id = el.dataset.id;
      const on = !a.checks[id];
      a.checks[id] = on;
      if (id === 'close' && on && !a.playAt) a.playAt = Date.now();
      if (id === 'stop') a.endAt = on ? a.endAt || Date.now() : null;
      navigator.vibrate?.(12);
    } else if (act === 'during-done') {
      a.during = true;
    } else if (act === 'uvc-start') {
      a.uvcEndsAt = Date.now() + UVC_MINUTES * 60000;
    } else if (act === 'uvc-reset') {
      a.uvcEndsAt = null;
    } else if (act === 'finish') {
      location.hash = '#/log/finish';
      return;
    } else if (act === 'discard') {
      if (await confirmBox('Discard this session? Nothing will be logged.', { ok: 'Discard', danger: true })) {
        await delKV('active');
        app.rerender();
      }
      return;
    } else {
      return;
    }
    await setKV('active', a);
    renderActive(root, app, a);
    const after = currentPhaseIndex(a, s);
    if (after > before) {
      const target = after < PHASES.length ? `#phase-${PHASES[after].id}` : '[data-act="finish"]';
      root.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
}

function phaseSection(p, i, cur, a, s) {
  if (i > cur) {
    return `<section class="phase locked" id="phase-${p.id}"><h2>${icon('lock')} ${esc(p.title)}</h2>
      ${i === cur + 1 ? `<p class="muted small">Unlocks when ${esc(PHASES[cur].title.toLowerCase())} is done.</p>` : ''}</section>`;
  }
  const body = p.reference ? duringBody(a, s, i === cur) : itemsBody(p, a, s);
  if (i < cur) {
    const count = p.reference ? '' : `${p.items.filter((it) => a.checks[it.id]).length}/${p.items.length}`;
    return `<details class="phase done" id="phase-${p.id}"><summary><h2>${icon('check')} ${esc(p.title)}</h2>
      <span class="muted small">${count}</span></summary>${body}</details>`;
  }
  return `<section class="phase current" id="phase-${p.id}"><h2>${esc(p.title)}</h2>
    ${p.subtitle ? `<p class="muted small">${esc(p.subtitle)}</p>` : ''}${body}</section>`;
}

function itemsBody(p, a, s) {
  return `<div class="checklist">${p.items
    .map((it, idx) => {
      const on = !!a.checks[it.id];
      const detail = detailText(it, s);
      return `<button type="button" class="check${on ? ' on' : ''}${it.danger ? ' danger' : ''}" data-act="toggle" data-id="${it.id}" aria-pressed="${on}">
        <span class="box">${on ? icon('check') : idx + 1}</span>
        <span class="check-text"><span class="check-title">${esc(it.text)}${isOptional(it, s) ? ' <span class="tag">optional</span>' : ''}</span>
        ${detail ? `<span class="check-detail">${esc(detail)}</span>` : ''}</span>
      </button>${it.id === 'uvc' ? uvcTimer(a) : ''}`;
    })
    .join('')}</div>`;
}

function uvcTimer(a) {
  if (!a.uvcEndsAt) {
    return `<div class="timer-row"><button type="button" class="btn btn-sm" data-act="uvc-start">Start ${UVC_MINUTES}-min UVC timer</button></div>`;
  }
  return `<div class="timer-row"><span class="muted small">UVC</span>
    <span class="mono big" data-until="${a.uvcEndsAt}" data-done-text="Done" data-alert="UVC cycle finished. Turn off UVC.">${fmtClock(
      a.uvcEndsAt - Date.now(),
    )}</span>
    <button type="button" class="btn btn-sm btn-ghost" data-act="uvc-reset">Reset</button></div>`;
}

function duringBody(a, s, isCurrent) {
  const clock = a.playAt
    ? `<div class="clock-card"><div class="mono huge"${a.endAt ? '' : ` data-since="${a.playAt}"`}>${fmtClock(
        (a.endAt || Date.now()) - a.playAt,
      )}</div><div class="muted small">elapsed${a.plannedMin ? ` · planned ${fmtMin(a.plannedMin)}` : ''}</div></div>`
    : '';
  return `<div class="stack">${clock}${refList(DURING_REFERENCE)}
    ${callButton(primaryContact(s), { label: `Call installer (${primaryContact(s).name})` })}
    ${isCurrent ? '<button class="btn btn-primary btn-block" data-act="during-done">Session is ending → Ending steps</button>' : ''}</div>`;
}
