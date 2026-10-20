// Shared formatting helpers and small UI building blocks (modals, toasts, pickers).

export const DAY = 86400000;

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

export const num = (v) => (v === '' || v == null ? null : Number(v));
export const sum = (xs) => xs.reduce((a, b) => a + (Number(b) || 0), 0);

export const cToF = (c) => Math.round((c * 9) / 5 * 10 + 320) / 10;
export const fmtTemp = (c) => `${c} °C (${cToF(c)} °F)`;
export const fmtKpa = (k) => (k == null || k === '' ? '—' : `${k} kPa (${Math.round(Number(k)) / 100} bar)`);

// Audible alerts. iOS only lets a page make sound after a tap, so call primeAudio() from one.
let audioCtx;
export function primeAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback'; // play even with the silent switch on (iOS 17+)
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
  } catch {
    /* no audio: fine */
  }
}
// Browsers refuse vibration until the page has had a real tap.
export const vibrate = (pattern) => navigator.userActivation?.hasBeenActive !== false && navigator.vibrate?.(pattern);

export function beep(times = 1) {
  vibrate(Array.from({ length: times * 2 - 1 }, (_, i) => (i % 2 ? 150 : 300)));
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  for (let i = 0; i < times; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.35 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.35 + 0.25);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0 + i * 0.35);
    osc.stop(t0 + i * 0.35 + 0.3);
  }
}

const pad = (n) => String(n).padStart(2, '0');
export const localDate = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const localTime = (t) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const todayISO = () => localDate(Date.now());
export const toLocalInput = (t) => `${localDate(t)}T${localTime(t)}`;
export const fromLocalInput = (v) => (v ? new Date(v).getTime() : Date.now());

export const fmtDate = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const fmtDateTime = (t) =>
  new Date(t).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function fmtMin(m) {
  if (m == null || m === '') return '—';
  m = Math.round(m);
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} min` : `${m} min`;
}

export function fmtClock(ms) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export function telHref(phone) {
  const d = String(phone || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return `tel:${d}`;
  if (d.length === 10) return `tel:+1${d}`;
  if (d.length === 11 && d[0] === '1') return `tel:+${d}`;
  return `tel:${d}`;
}

const ICONS = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  session: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5.5 3.5-5.5 3.5z"/>',
  log: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  upkeep: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3.5 17.2a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.1-5.4l-2.5 2.5-2.3-.6-.6-2.3z"/>',
  safety: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8v5M12 16.5v.01"/>',
  protocols: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  phone: '<path d="M5 3.5h3.5l2 5-2.5 1.5a11 11 0 0 0 6 6l1.5-2.5 5 2V19a2 2 0 0 1-2 2A17 17 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  alert: '<path d="M12 3.5l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
};
export const icon = (name) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

export function modal(html, { onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.remove();
    if (!document.querySelector('.modal-wrap')) document.body.classList.remove('modal-open');
    onClose?.();
  };
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) close();
  });
  document.body.append(wrap);
  document.body.classList.add('modal-open');
  return { el: wrap.querySelector('.modal'), close };
}

export function confirmBox(message, { ok = 'OK', danger = false } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const m = modal(
      `<p class="confirm-msg">${esc(message)}</p>
       <div class="row"><button class="btn btn-ghost" data-close>Cancel</button>
       <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(ok)}</button></div>`,
      { onClose: () => resolve(result) },
    );
    m.el.querySelector('[data-ok]').onclick = () => {
      result = true;
      m.close();
    };
  });
}

export function segmented(name, options, selected) {
  return `<div class="seg">${options
    .map(
      (o) => `<label class="seg-opt"><input type="radio" name="${name}" value="${esc(o.value)}"${
        String(o.value) === String(selected ?? '') ? ' checked' : ''
      }><span>${esc(o.label)}</span></label>`,
    )
    .join('')}</div>`;
}

// `selected` undefined → first person; '' → nobody picked yet (e.g. an entry created from a tablet file).
export const userPicker = (name, s, selected) =>
  segmented(name, s.users.map((u) => ({ value: u.id, label: u.name })), selected === undefined ? s.users[0].id : selected);

const BADGES = { overdue: ['Overdue', 'danger'], due: ['Due', 'warn'], unset: ['Set up', 'info'], ok: ['OK', 'ok'] };
export const badge = (status) => {
  const [text, kind] = BADGES[status];
  return `<span class="badge badge-${kind}">${text}</span>`;
};

export function callButton(contact, { label, big = false, small = false } = {}) {
  if (!contact) return '';
  const href = telHref(contact.phone);
  const text = label || `Call ${contact.name}`;
  const cls = `btn btn-call${big ? ' btn-hero' : ''}${small ? ' btn-sm' : ''}`;
  if (!href) return `<span class="${cls} disabled">${icon('phone')} ${esc(text)} (no number)</span>`;
  return `<a class="${cls}" href="${href}">${icon('phone')} ${esc(text)}</a>`;
}

export function showContacts(s) {
  modal(`
    <h2>Installer contacts</h2>
    <div>${s.contacts
      .map(
        (c) => `<div class="contact">
          <div class="grow"><div class="strong">${esc(c.name)}${c.primary ? ' <span class="tag">primary</span>' : ''}</div>
          <div class="muted small">${esc([c.org, c.role].filter(Boolean).join(' · '))}</div>
          <div class="small mono">${esc([c.phone, c.email].filter(Boolean).join(' · ') || 'No number yet')}</div></div>
          ${c.phone || !c.email ? callButton(c, { label: 'Call', small: true }) : ''}
          ${c.email ? `<a class="btn btn-sm" href="mailto:${esc(c.email)}">Email</a>` : ''}
        </div>`,
      )
      .join('')}</div>
    <a class="link small" href="#/settings" data-close>Edit contacts in Settings</a>
    <button class="btn" data-close>Close</button>`);
}

export function lockBanner(lock) {
  return `<div class="banner banner-danger">${icon('lock')}<div>
    <strong>Chamber locked: Lysol drying</strong>
    <div>Usable again in <span class="mono strong" data-until="${lock.until}" data-done-text="now" data-rerender="1">${fmtClock(
      lock.until - Date.now(),
    )}</span> · ${esc(fmtDateTime(lock.until))}</div></div></div>`;
}

export const refList = (items) =>
  `<ul class="ref-list">${items
    .map((i) => `<li class="${i.danger ? 'danger' : ''}"><strong>${esc(i.title)}</strong>${esc(i.text)}</li>`)
    .join('')}</ul>`;

// On phones, the share sheet lets you save to Files / AirDrop; elsewhere a plain download.
export async function shareOrDownload(filename, mime, text) {
  const file = new File([text], filename, { type: mime });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
