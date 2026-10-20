import { getKV, setKV } from './db.js';

export const VERSION = '1.0.0';

export const DEFAULT_SETTINGS = {
  installedAt: 0,
  users: [
    { id: 'u1', name: 'Person 1', color: '#a78bfa' },
    { id: 'u2', name: 'Person 2', color: '#7dd3fc' },
  ],
  contacts: [
    { id: 'nick', name: 'Nick', org: 'HPO Tech', role: 'Installer · primary contact', phone: '(305) 229-0234', primary: true },
    { id: 'jayden', name: 'Jayden', org: 'HPO Tech', role: "Installer · Nick's colleague", phone: '', primary: false },
    { id: 'shawn', name: 'Shawn', org: 'HPO Tech', role: 'Boss · escalation', phone: '(909) 306-3253', primary: false },
  ],
  // 0 = not used. A task is due when either limit is reached.
  intervals: {
    compressorDrain: { sessions: 5, days: 7 },
    dryerEmpty: { sessions: 3, days: 0 },
    chillerLevel: { sessions: 1, days: 0 },
    wipeDown: { sessions: 10, days: 7 },
  },
  uvcEvery: 1,
  masks: [{ userId: 'u1' }, { userId: 'u2' }, { userId: '' }, { userId: '' }, { userId: '' }, { userId: '' }],
  maskCleanSessions: 3,
  maskCleanDays: 0,
  clothAcrylic: '',
  clothMetal: '',
  lysolHours: 24,
  serviceLastDate: '',
  serviceMonths: 12,
  serviceRemindDays: 30,
  chillerSetpoint: 13,
  chillerMin: 11.5,
  lastBackupAt: 0,
};

function merge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    if (over && typeof over === 'object') {
      for (const k of Object.keys(over)) out[k] = k in base ? merge(base[k], over[k]) : over[k];
    }
    return out;
  }
  return over === undefined ? base : over;
}

export async function loadSettings() {
  const stored = await getKV('settings');
  const s = merge(structuredClone(DEFAULT_SETTINGS), stored || {});
  if (!s.installedAt) {
    s.installedAt = Date.now();
    await setKV('settings', s);
  }
  return s;
}

export const saveSettings = (s) => setKV('settings', s);
export const primaryContact = (s) => s.contacts.find((c) => c.primary) || s.contacts[0];
export const userById = (s, id) => s.users.find((u) => u.id === id);
export const userName = (s, id) => userById(s, id)?.name || '—';
