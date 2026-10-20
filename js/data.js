// Export, backup and restore. Attached video files are left out of backups (too large).
import { db, getKV, setKV, RECORD_STORES } from './db.js';
import { userName } from './state.js';
import { localDate, localTime } from './ui.js';

const CSV_COLUMNS = [
  ['date', (x) => localDate(x.at)],
  ['time', (x) => localTime(x.at)],
  ['person', (x, s) => userName(s, x.userId)],
  ['protocol', (x) => x.protocol],
  ['max_pressure_kpa', (x) => x.maxPressure],
  ['planned_min', (x) => x.plannedMin],
  ['actual_min', (x) => x.actualMin],
  ['outcome', (x) => (x.outcome === 'stopped' ? 'stopped early' : 'completed')],
  ['stop_reason', (x) => x.stopReason],
  ['ear_trouble', (x) => (x.earTrouble ? 'yes' : 'no')],
  ['ear_notes', (x) => x.earNotes],
  ['feeling_1_to_5', (x) => x.feeling],
  ['uvc_run', (x) => (x.uvcRun ? 'yes' : 'no')],
  ['notes', (x) => x.notes],
];

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function sessionsToCsv(sessions, s) {
  const rows = [...sessions].sort((a, b) => a.at - b.at);
  return [CSV_COLUMNS.map(([h]) => h).join(','), ...rows.map((x) => CSV_COLUMNS.map(([, f]) => csvCell(f(x, s))).join(','))].join('\r\n');
}

export async function buildBackup(settings) {
  const [sessions, maint, protocols, videos, active, lock] = await Promise.all([
    db.all('sessions'),
    db.all('maint'),
    db.all('protocols'),
    db.all('videos'),
    getKV('active'),
    getKV('lock'),
  ]);
  return {
    app: 'zeugma',
    format: 1,
    exportedAt: new Date().toISOString(),
    settings,
    sessions,
    maint,
    protocols,
    videos: videos.map(({ blob, ...v }) => ({ ...v, hadFile: !!blob })),
    active: active ?? null,
    lock: lock ?? null,
  };
}

export async function restoreBackup(data) {
  if (data?.app !== 'zeugma') throw new Error('This is not a Zeugma backup file.');
  const oldVideos = await db.all('videos');
  for (const store of RECORD_STORES) await db.clear(store);
  for (const store of ['sessions', 'maint', 'protocols']) {
    for (const rec of data[store] || []) await db.put(store, rec);
  }
  for (const { hadFile, ...v } of data.videos || []) {
    const blob = oldVideos.find((o) => o.id === v.id)?.blob;
    await db.put('videos', blob ? { ...v, blob } : v);
  }
  await setKV('settings', data.settings || {});
  await setKV('active', data.active ?? undefined);
  await setKV('lock', data.lock ?? undefined);
}

export async function resetAll() {
  for (const store of [...RECORD_STORES, 'kv']) await db.clear(store);
}
