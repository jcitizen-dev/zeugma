import { loadSettings, saveSettings } from './state.js';
import { beep, fmtClock, showContacts, toast } from './ui.js';
import * as Home from './views/home.js';
import * as Session from './views/session.js';
import * as Log from './views/log.js';
import * as Upkeep from './views/upkeep.js';
import * as Safety from './views/safety.js';
import * as Guide from './views/guide.js';
import * as Protocols from './views/protocols.js';
import * as Settings from './views/settings.js';

const app = {
  settings: null,
  save() {
    return saveSettings(this.settings);
  },
  async reloadSettings() {
    this.settings = await loadSettings();
  },
  rerender: () => route(),
};

const ROUTES = {
  home: { title: () => 'Home', view: Home.render },
  session: { title: () => 'Session', view: Session.render },
  log: {
    title: (p) => (p[0] ? 'Log entry' : 'Session log'),
    view: (root, a, p) => {
      if (p[0] === 'new' || p[0] === 'finish') return Log.renderForm(root, a, p[0]);
      if (p[0] === 'edit') return Log.renderForm(root, a, 'edit', p[1]);
      return Log.renderList(root, a);
    },
  },
  upkeep: { title: () => 'Maintenance', view: Upkeep.render },
  guide: { title: () => 'Guide', view: Guide.render },
  safety: { title: () => 'Safety', view: Safety.render },
  protocols: {
    title: (p) => (p[0] ? 'Protocol' : 'Protocols'),
    view: (root, a, p) => (p[0] ? Protocols.renderEditor(root, a, p[0]) : Protocols.renderList(root, a)),
  },
  settings: { title: () => 'Settings', view: Settings.render },
};

let cleanup = null;
let lastHash = null;
let token = 0;

async function route() {
  const hash = location.hash || '#/home';
  const [name, ...params] = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const key = ROUTES[name] ? name : 'home';
  const r = ROUTES[key];
  cleanup?.();
  cleanup = null;
  document.getElementById('pageTitle').textContent = r.title(params);
  document.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('active', a.dataset.tab === key));
  const root = document.getElementById('view');
  const mine = ++token;
  try {
    const result = await r.view(root, app, params);
    if (typeof result === 'function') {
      if (mine === token) cleanup = result;
      else result();
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="banner banner-danger"><div><strong>Something went wrong.</strong><div class="small">${String(err.message || err)}</div></div></div>`;
  }
  if (hash !== lastHash) window.scrollTo(0, 0);
  lastHash = hash;
  tick();
}

// One ticker drives every countdown ([data-until]) and stopwatch ([data-since]) on screen.
function tick() {
  const now = Date.now();
  document.querySelectorAll('[data-until]').forEach((el) => {
    const left = Number(el.dataset.until) - now;
    if (left > 0) {
      el.textContent = fmtClock(left);
      return;
    }
    el.textContent = el.dataset.doneText || '00:00';
    el.classList.add('expired');
    if (el.dataset.fired) return;
    el.dataset.fired = '1';
    if (el.dataset.alert && left > -5000) {
      beep(2);
      toast(el.dataset.alert);
    }
    if (el.dataset.rerender) app.rerender();
  });
  document.querySelectorAll('[data-since]').forEach((el) => {
    const since = Number(el.dataset.since);
    const elapsed = now - since;
    el.textContent = fmtClock(elapsed);
    if (!el.dataset.alarmAt) return;
    // Thresholds (used by the pause timer). Remembered per start time so a re-render doesn't re-warn.
    const warn = elapsed >= Number(el.dataset.warnAt);
    const alarm = elapsed >= Number(el.dataset.alarmAt);
    el.classList.toggle('warn', warn && !alarm);
    el.classList.toggle('alarm', alarm);
    if (warn && !alarm && !warned.has(since)) {
      warned.add(since);
      beep(1);
      toast(el.dataset.warnMsg);
    }
    if (alarm && now - (lastAlarm.get(since) || 0) >= 15000) {
      lastAlarm.set(since, now);
      beep(3);
      toast(el.dataset.alarmMsg);
    }
  });
}
const warned = new Set();
const lastAlarm = new Map();

(async () => {
  await app.reloadSettings();
  window.addEventListener('hashchange', route);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="contacts"]')) showContacts(app.settings);
  });
  setInterval(tick, 1000);
  await route();
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
  }
})();
