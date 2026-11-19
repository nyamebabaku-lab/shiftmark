import { SHIFT_TYPES, today, parseYmd } from '../lib/shifts';
import { cx } from './ui';

const DOT = { present: 'bg-emerald-500', late: 'bg-amber-500', absent: 'bg-rose-500', extra: 'bg-violet-500', excused: 'bg-teal-500', in: 'bg-emerald-500 animate-pulse', missing: 'bg-rose-400' };

/** Month grid: shift colour on each day plus an attendance dot. */
export default function MonthCalendar({ records, onPick, selected }) {
  if (!records.length) return null;
  const first = parseYmd(records[0].date);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const td = today();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} />)}
        {records.map((r) => {
          const t = SHIFT_TYPES[r.shift.type];
          const isToday = r.date === td;
          return (
            <button
              key={r.date}
              onClick={() => onPick?.(r)}
              className={cx('relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition hover:ring-2 hover:ring-brand-400/50',
                r.shift.type === 'O' ? 'bg-slate-50 text-slate-400 dark:bg-white/[.03]' : 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:bg-ink-800 dark:text-slate-100 dark:ring-white/5',
                isToday && 'ring-2 ring-brand-500 dark:ring-brand-400', selected === r.date && 'ring-2 ring-ink-900 dark:ring-white')}
            >
              <span className="absolute inset-x-1.5 top-1 h-1 rounded-full" style={{ background: r.shift.type === 'O' ? 'transparent' : t.color }} />
              <span className={cx('font-semibold', isToday && 'text-brand-700 dark:text-brand-300')}>{Number(r.date.slice(8))}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide opacity-60">{t.short}</span>
              {DOT[r.status] && <span className={cx('absolute bottom-1 h-1.5 w-1.5 rounded-full', DOT[r.status])} />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {['M', 'A', 'N'].map((k) => <span key={k} className="inline-flex items-center gap-1"><i className="h-2 w-3 rounded-full" style={{ background: SHIFT_TYPES[k].color }} />{SHIFT_TYPES[k].name}</span>)}
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" />Present</span>
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" />Late</span>
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500" />Absent</span>
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-teal-500" />Excused</span>
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-violet-500" />Extra</span>
      </div>
    </div>
  );
}
