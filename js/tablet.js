// Parser for the chamber tablet's per-session CSV export (HPO Soft → Saved Data → Copy CSV Files to USB).
// Expected columns: Timestamp, Pressure (kPa), Temp (°C), Humidity, Oxygen; one row every ~10 s.
// It is deliberately forgiving: columns are found by name, and comma / semicolon / tab delimiters,
// decimal commas and the common date formats are all accepted.
//
// Points are stored compactly as [timeMs, kPa, tempC, humidity, oxygen].

const COLUMNS = {
  t: /time|date|zaman|tarih/i,
  p: /press|bas[ıi]n[çc]/i,
  temp: /temp|s[ıi]cakl[ıi]k/i,
  hum: /humid|nem/i,
  o2: /oxy|o2|o₂|oksijen/i,
};

function splitLine(line, delim) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delim && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function toNumber(v, decimalComma) {
  if (v == null) return null;
  let s = String(v).trim().replace(/[^\d,.\-]/g, '');
  if (decimalComma) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const DATE_TIME = /(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,]\d+)?\s*(am|pm)?/i;
const TIME_ONLY = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i;

function hour24(h, ampm) {
  h = Number(h);
  if (!ampm) return h;
  if (/pm/i.test(ampm) && h < 12) return h + 12;
  if (/am/i.test(ampm) && h === 12) return 0;
  return h;
}

// Decide day-first vs month-first once per file from the values themselves.
function detectDayFirst(values) {
  let sep = '';
  for (const v of values) {
    const m = String(v).match(DATE_TIME);
    if (!m || m[1].length === 4) continue;
    sep ||= String(v).match(/\d([./-])\d/)?.[1] || '';
    if (Number(m[1]) > 12) return true;
    if (Number(m[2]) > 12) return false;
  }
  return sep === '.'; // 19.10.2026 style is day-first; 10/19/2026 defaults to US order
}

function parseTimestamp(v, dayFirst, fallbackDay) {
  const s = String(v ?? '').trim();
  if (/^\d{9,13}$/.test(s)) return Number(s) * (s.length <= 10 ? 1000 : 1);
  let m = s.match(DATE_TIME);
  if (m) {
    let y, mo, d;
    if (m[1].length === 4) [y, mo, d] = [m[1], m[2], m[3]];
    else if (dayFirst) [d, mo, y] = [m[1], m[2], m[3]];
    else [mo, d, y] = [m[1], m[2], m[3]];
    y = Number(y) < 100 ? 2000 + Number(y) : Number(y);
    return new Date(y, Number(mo) - 1, Number(d), hour24(m[4], m[7]), Number(m[5]), Number(m[6] || 0)).getTime();
  }
  m = s.match(TIME_ONLY);
  if (m && fallbackDay) {
    const d = new Date(fallbackDay);
    d.setHours(hour24(m[1], m[4]), Number(m[2]), Number(m[3] || 0), 0);
    return d.getTime();
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : NaN;
}

function dayFromFileName(name) {
  const m = String(name).match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
}

export function parseTabletCsv(text, fileName = '', lastModified = null) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const hIdx = lines.findIndex((l) => COLUMNS.p.test(l) && COLUMNS.t.test(l));
  if (hIdx < 0) throw new Error(`${fileName}: no Timestamp and Pressure columns found.`);
  const headerLine = lines[hIdx];
  const delim = [';', '\t', ','].reduce((best, d) => (headerLine.split(d).length > headerLine.split(best).length ? d : best), ',');
  const header = splitLine(headerLine, delim);
  const col = (re) => header.findIndex((h) => re.test(h));
  const ci = { t: col(COLUMNS.t), p: col(COLUMNS.p), temp: col(COLUMNS.temp), hum: col(COLUMNS.hum), o2: col(COLUMNS.o2) };
  const rows = lines.slice(hIdx + 1).map((l) => splitLine(l, delim));
  const decimalComma = delim !== ',' && rows.some((r) => /^\d+,\d+$/.test(r[ci.p] || ''));
  const dayFirst = detectDayFirst(rows.slice(0, 50).map((r) => r[ci.t]));
  const fallbackDay = dayFromFileName(fileName) ?? lastModified;
  const val = (r, i) => (i < 0 ? null : toNumber(r[i], decimalComma));

  const points = rows
    .map((r) => [parseTimestamp(r[ci.t], dayFirst, fallbackDay), val(r, ci.p), val(r, ci.temp), val(r, ci.hum), val(r, ci.o2)])
    .filter((p) => Number.isFinite(p[0]) && p[1] != null)
    .sort((a, b) => a[0] - b[0]);
  if (points.length < 2) throw new Error(`${fileName}: could not read any data rows.`);
  return { fileName, start: points[0][0], end: points[points.length - 1][0], points, stats: runStats(points) };
}

export function runStats(points) {
  const avg = (i) => {
    const xs = points.map((p) => p[i]).filter((x) => x != null);
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
  };
  const max = (i) => {
    const xs = points.map((p) => p[i]).filter((x) => x != null);
    return xs.length ? Math.max(...xs) : null;
  };
  return {
    durationMin: Math.round((points[points.length - 1][0] - points[0][0]) / 60000),
    maxKpa: max(1),
    avgTemp: avg(2),
    avgHumidity: avg(3),
    maxO2: max(4),
  };
}

// Closest log entry that started within 45 min of the file's start (or during it).
export function matchSession(run, sessions, takenIds) {
  const slack = 45 * 60000;
  const candidates = sessions.filter(
    (x) => !takenIds.has(x.id) && x.at >= run.start - slack && x.at <= Math.max(run.end, run.start + slack),
  );
  candidates.sort((a, b) => Math.abs(a.at - run.start) - Math.abs(b.at - run.start));
  return candidates[0] || null;
}
