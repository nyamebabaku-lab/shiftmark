// The 8-day rotation: 2 mornings, 2 afternoons, 2 nights, 2 off days.
// Dates are local calendar days written 'YYYY-MM-DD'. A night shift belongs to the day it starts.

export const CYCLE = ['M', 'M', 'A', 'A', 'N', 'N', 'O', 'O'];

export const SHIFT_TYPES = {
  M: { key: 'M', name: 'Morning', short: 'AM', color: '#f59e0b', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' },
  A: { key: 'A', name: 'Afternoon', short: 'PM', color: '#f97316', bg: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300' },
  N: { key: 'N', name: 'Night', short: 'NT', color: '#6366f1', bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300' },
  O: { key: 'O', name: 'Off', short: 'OFF', color: '#94a3b8', bg: 'bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400' },
};

export const DEFAULT_TIMES = {
  M: { start: '06:00', end: '14:00' },
  A: { start: '14:00', end: '22:00' },
  N: { start: '22:00', end: '06:00' },
};

/** Fri 20 Nov 2026 is Morning day 1 (the user's Wed 18 Nov 2026 was Off day 1). */
export const DEFAULT_ANCHOR = '2026-11-20';

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const utcDay = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
export const daysBetween = (a, b) => utcDay(b) - utcDay(a);
export const today = (now = new Date()) => ymd(now);

/** Position in the cycle (0–7) for a date. 0 = Morning day 1. */
export function cycleIndex(date, anchor = DEFAULT_ANCHOR) {
  return ((daysBetween(anchor, date) % 8) + 8) % 8;
}

/** "Morning 1", "Night 2", "Off 1" … */
export function cycleLabel(idx) {
  const t = CYCLE[idx];
  return `${SHIFT_TYPES[t].name} ${idx % 2 === 0 ? 1 : 2}`;
}

/** The anchor (Morning-1 date) that makes `date` fall on cycle position `idx`. */
export function anchorFrom(date, idx) {
  return addDays(date, -idx);
}

const at = (date, hhmm) => { const d = parseYmd(date); const [h, m] = hhmm.split(':').map(Number); d.setHours(h, m, 0, 0); return d; };

/**
 * The shift on a date: { date, type, idx, label, start, end } (start/end are Date objects),
 * or { date, type: 'O', idx, label } on an off day.
 */
export function shiftOn(date, settings = {}) {
  const idx = cycleIndex(date, settings.anchor || DEFAULT_ANCHOR);
  const type = CYCLE[idx];
  const base = { date, type, idx, label: cycleLabel(idx), name: SHIFT_TYPES[type].name };
  if (type === 'O') return base;
  const t = { ...DEFAULT_TIMES[type], ...(settings.shifts?.[type] || {}) };
  const start = at(date, t.start);
  let end = at(date, t.end);
  if (end <= start) end = at(addDays(date, 1), t.end);
  return { ...base, start, end, startText: t.start, endText: t.end };
}

/** Every shift (including off days) from `from` to `to`, inclusive. */
export function shiftsBetween(from, to, settings) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(shiftOn(d, settings));
  return out;
}

/** The shift happening now, else the next one to start (looks back a day for night shifts). */
export function currentOrNextShift(now = new Date(), settings) {
  const d0 = ymd(now);
  for (let i = -1; i <= 9; i++) {
    const s = shiftOn(addDays(d0, i), settings);
    if (s.type === 'O') continue;
    if (now < s.end) return { ...s, live: now >= s.start };
  }
  return null;
}

export const monthRange = (year, month) => {
  const first = `${year}-${pad(month)}-01`;
  const last = ymd(new Date(year, month, 0));
  return [first, last];
};
