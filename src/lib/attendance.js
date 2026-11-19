// Turns raw clock-in / clock-out events into a record per day: present, late, absent, hours, overtime, pay.
import { shiftOn, shiftsBetween, addDays, ymd } from './shifts.js';

export const DEFAULT_RULES = { grace_min: 10, ot_min: 30 };
const MIN = 60000;
/** If a worker never clocks out, the shift is closed at its end time this long afterwards. */
const FORGOT_OUT_AFTER = 4 * 60 * MIN;
/** A visit counts toward a shift if it touches the shift or the 2 hours before it. */
const EARLY_WINDOW = 2 * 60 * MIN;

const t = (x) => (x instanceof Date ? x.getTime() : new Date(x).getTime());

/** Pairs in/out events (oldest first) into visits: [{ in, out|null, inEv, outEv }]. */
export function buildSessions(events) {
  const evs = events.filter((e) => !e.voided).slice().sort((a, b) => t(a.at) - t(b.at));
  const out = [];
  let open = null;
  for (const e of evs) {
    if (e.kind === 'in') {
      if (!open) open = { in: t(e.at), out: null, inEv: e, outEv: null };
    } else if (e.kind === 'out' && open) {
      open.out = t(e.at);
      open.outEv = e;
      out.push(open);
      open = null;
    }
  }
  if (open) out.push(open);
  return out;
}

/**
 * One record per day from `from` to `to`:
 * { date, shift, status, sessions, arrival, departure, workedMin, lateMin, earlyMin, otMin, late, early, missingOut, mark, counts }
 * status: off | upcoming | due | missing | in | present | late | absent | extra | excused
 */
export function dailyRecords({ events = [], marks = [], settings = {}, from, to, now = new Date(), since = null }) {
  const rules = { ...DEFAULT_RULES, ...settings };
  const nowT = t(now);
  const sessions = buildSessions(events);
  const shifts = shiftsBetween(addDays(from, -1), addDays(to, 1), settings);
  const byDate = Object.fromEntries(shifts.map((s) => [s.date, { shift: s, sessions: [] }]));
  const markBy = Object.fromEntries(marks.map((m) => [m.day, m]));

  // Each visit goes to the scheduled shift it overlaps most; otherwise it's extra work on the day it started.
  for (const s of sessions) {
    const sOut = s.out ?? nowT;
    let best = null;
    let bestOverlap = -1;
    for (const sh of shifts) {
      if (sh.type === 'O') continue;
      const lo = t(sh.start) - EARLY_WINDOW;
      const hi = t(sh.end) + FORGOT_OUT_AFTER;
      if (s.in >= hi || sOut <= lo || s.in >= t(sh.end)) continue;
      const ov = Math.min(sOut, t(sh.end)) - Math.max(s.in, t(sh.start));
      if (ov > bestOverlap) { bestOverlap = ov; best = sh; }
    }
    const key = best ? best.date : ymd(new Date(s.in));
    if (!byDate[key]) byDate[key] = { shift: shiftOn(key, settings), sessions: [] };
    byDate[key].sessions.push(s);
  }

  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const { shift, sessions: ss } = byDate[d];
    const mark = markBy[d] || null;
    const rec = { date: d, shift, sessions: ss, mark, arrival: null, departure: null, workedMin: 0, lateMin: 0, earlyMin: 0, otMin: 0, late: false, early: false, missingOut: false, beforeStart: since && d < since };
    const scheduled = shift.type !== 'O';
    const sT = scheduled ? t(shift.start) : 0;
    const eT = scheduled ? t(shift.end) : 0;

    if (ss.length) {
      rec.arrival = ss[0].in;
      let worked = 0;
      let last = null;
      let live = false;
      for (const s of ss) {
        let o = s.out;
        if (o == null) {
          const closeBy = (scheduled ? eT : s.in + 8 * 60 * MIN) + FORGOT_OUT_AFTER;
          if (nowT < closeBy) { o = nowT; live = true; } else { o = Math.max(s.in, scheduled ? eT : s.in + 8 * 60 * MIN); rec.missingOut = true; }
        }
        worked += Math.max(0, o - s.in);
        last = Math.max(last ?? 0, o);
      }
      rec.departure = live ? null : last;
      rec.workedMin = Math.round(worked / MIN);
      if (scheduled) {
        rec.lateMin = Math.max(0, Math.round((rec.arrival - sT) / MIN));
        rec.late = rec.lateMin > rules.grace_min;
        if (!live && !rec.missingOut) {
          rec.earlyMin = Math.max(0, Math.round((eT - last) / MIN));
          rec.early = rec.earlyMin > rules.grace_min;
          const ot = Math.max(0, Math.round((last - eT) / MIN));
          rec.otMin = ot >= rules.ot_min ? ot : 0;
        }
        rec.status = live ? 'in' : rec.late ? 'late' : 'present';
      } else {
        // Worked on an off day: the whole day is extra; time past 8 hours is overtime.
        rec.status = live ? 'in' : 'extra';
        const ot = rec.workedMin - 8 * 60;
        rec.otMin = !live && ot >= rules.ot_min ? ot : 0;
      }
    } else if (!scheduled) {
      rec.status = 'off';
    } else if (rec.beforeStart) {
      rec.status = 'off';
    } else if (nowT < sT) {
      rec.status = 'upcoming';
    } else if (nowT < sT + rules.grace_min * MIN) {
      rec.status = 'due';
    } else if (nowT < eT) {
      rec.status = 'missing';
    } else {
      rec.status = 'absent';
    }

    if (mark && ['absent', 'missing', 'off', 'upcoming', 'due'].includes(rec.status) && mark.kind !== 'absent') {
      rec.status = 'excused';
    }
    if (mark?.kind === 'absent' && !ss.length && scheduled) rec.status = 'absent';
    // Days worked: counts for pay. Excused paid days count too.
    rec.worked = ['present', 'late', 'extra'].includes(rec.status) || (rec.status === 'in');
    rec.paidDay = ['present', 'late', 'extra'].includes(rec.status) || (rec.status === 'excused' && !!mark?.paid);
    out.push(rec);
  }
  return out;
}

/** Totals for a list of daily records plus pay from the worker's rates. */
export function summarize(records, profile = {}) {
  const s = { scheduled: 0, worked: 0, present: 0, late: 0, early: 0, absent: 0, excused: 0, extra: 0, missingOut: 0, workedMin: 0, otMin: 0, lateMin: 0, paidDays: 0 };
  for (const r of records) {
    if (r.shift.type !== 'O' && !r.beforeStart && !['upcoming', 'due'].includes(r.status)) s.scheduled += 1;
    if (r.worked) s.worked += 1;
    if (r.status === 'present') s.present += 1;
    if (r.status === 'late') { s.late += 1; s.lateMin += r.lateMin; }
    if (r.early) s.early += 1;
    if (r.status === 'absent') s.absent += 1;
    if (r.status === 'excused') s.excused += 1;
    if (r.status === 'extra') s.extra += 1;
    if (r.missingOut) s.missingOut += 1;
    if (r.paidDay) s.paidDays += 1;
    s.workedMin += r.workedMin;
    s.otMin += r.otMin;
  }
  const daily = Number(profile.daily_rate) || 0;
  const otRate = Number(profile.ot_rate) || 0;
  s.basePay = s.paidDays * daily;
  s.otPay = Math.round((s.otMin / 60) * otRate * 100) / 100;
  s.pay = Math.round((s.basePay + s.otPay) * 100) / 100;
  s.attendanceRate = s.scheduled ? Math.round(((s.present + s.late) / s.scheduled) * 100) : null;
  return s;
}

export const STATUS = {
  off: { label: 'Off', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  upcoming: { label: 'Upcoming', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  due: { label: 'Starting', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300' },
  missing: { label: 'Not in yet', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  in: { label: 'At work', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' },
  present: { label: 'Present', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' },
  late: { label: 'Late', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' },
  absent: { label: 'Absent', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300' },
  extra: { label: 'Extra day', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300' },
  excused: { label: 'Excused', cls: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300' },
};

export const MARK_KINDS = {
  leave: 'Annual leave',
  sick: 'Sick',
  excused: 'Permission',
  holiday: 'Public holiday',
  absent: 'Absent (confirmed)',
};
