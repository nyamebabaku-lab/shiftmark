import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserCheck, Clock4, UserX, AlertTriangle, MapPinOff, ChevronRight, UserPlus } from 'lucide-react';
import { useStore } from '../../data/store';
import { useNow, useTeam } from '../../lib/useRecords';
import { currentOrNextShift, today, addDays, shiftOn } from '../../lib/shifts';
import { Card, PageHead, Stat, StatusPill, ShiftPill, Avatar, cx } from '../../components/ui';
import { SyncBadge } from '../../components/Layout';
import DayDetail from '../../components/DayDetail';
import { hm, dur, countdown, ago } from '../../lib/format';

export default function AdminToday() {
  const now = useNow(20000);
  const settings = useStore((s) => s.settings);
  const profiles = useStore((s) => s.profiles);
  const events = useStore((s) => s.events);
  const [pick, setPick] = useState(null);
  const shift = currentOrNextShift(now, settings);
  // The shift to show: the live one, else today's (if it already ended), else the next.
  const td = today(now);
  const tShift = shiftOn(td, settings);
  const focusDate = shift?.live ? shift.date : (tShift.type !== 'O' && now >= tShift.start ? td : shift?.date || td);
  const team = useTeam(addDays(focusDate, 0), focusDate, now);
  const rows = team.map((t) => ({ ...t, rec: t.records[0] }));
  const c = useMemo(() => ({
    in: rows.filter((r) => r.rec.status === 'in').length,
    done: rows.filter((r) => ['present', 'late'].includes(r.rec.status)).length,
    late: rows.filter((r) => r.rec.late).length,
    missing: rows.filter((r) => ['missing', 'absent'].includes(r.rec.status)).length,
  }), [rows]);
  const pending = profiles.filter((p) => p.status === 'pending');
  const flagged = events.filter((e) => e.simulated && !e.voided && e.at > addDays(td, -7)).length;
  const focus = shiftOn(focusDate, settings);
  const order = { in: 0, late: 1, present: 2, missing: 3, due: 4, upcoming: 5, absent: 6, excused: 7, extra: 8, off: 9 };

  return (
    <div className="animate-fade-in space-y-4">
      <PageHead title="Today" sub={settings?.company} right={<SyncBadge />} />

      {settings?.office_lat == null && (
        <Link to="/settings" className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <MapPinOff className="h-5 w-5" /><span className="flex-1 text-sm font-semibold">Pin the office on the map so workers can be clocked in automatically.</span><ChevronRight className="h-4 w-4" />
        </Link>
      )}
      {pending.length > 0 && (
        <Link to="/team" className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4 text-brand-900 dark:bg-brand-500/10 dark:text-brand-200">
          <UserPlus className="h-5 w-5" /><span className="flex-1 text-sm font-semibold">{pending.length} new worker{pending.length > 1 ? 's' : ''} waiting for approval</span><ChevronRight className="h-4 w-4" />
        </Link>
      )}
      {flagged > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-rose-50 p-4 text-rose-900 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle className="h-5 w-5" /><span className="text-sm font-semibold">{flagged} clock event{flagged > 1 ? 's' : ''} this week came from a fake-GPS app.</span>
        </div>
      )}

      <Card className="flex flex-wrap items-center gap-3 p-4">
        {focus.type !== 'O' ? <ShiftPill type={focus.type} label={`${focus.label} · ${focus.startText}–${focus.endText}`} /> : <ShiftPill type="O" label="Off day for everyone" />}
        <span className="text-sm text-slate-500">
          {focus.type === 'O' ? '' : now < focus.start ? `Starts in ${countdown(focus.start - now)}` : now < focus.end ? `Ends in ${countdown(focus.end - now)}` : 'Finished'}
        </span>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={UserCheck} tone="green" label="At work now" value={c.in} sub={`of ${rows.length} workers`} />
        <Stat icon={Users} label="Done (shift over)" value={c.done} />
        <Stat icon={Clock4} tone="amber" label="Late" value={c.late} />
        <Stat icon={UserX} tone="rose" label="Not in / absent" value={c.missing} />
      </div>

      <Card className="divide-y divide-slate-100 dark:divide-white/5">
        {!rows.length && <p className="p-4 text-sm text-slate-500">No active workers yet. Share the invite code from Settings.</p>}
        {rows.slice().sort((a, b) => (order[a.rec.status] ?? 9) - (order[b.rec.status] ?? 9)).map(({ profile: p, rec }) => {
          const last = [...events].reverse().find((e) => e.user_id === p.user_id && !e.voided);
          return (
            <button key={p.user_id} onClick={() => setPick({ rec, userId: p.user_id })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div className="relative"><Avatar name={p.name} />{rec.status === 'in' && <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 dark:border-ink-900" />}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{p.name}</p>
                <p className={cx('truncate text-xs', rec.late ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500')}>
                  {rec.arrival ? `In ${hm(rec.arrival)}${rec.late ? ` (${rec.lateMin} min late)` : ''}${rec.departure ? ` · out ${hm(rec.departure)}` : ''} · ${dur(rec.workedMin)}` : last ? `Last seen ${ago(last.at)}` : 'No clock-ins yet'}
                </p>
              </div>
              <StatusPill status={rec.status} />
            </button>
          );
        })}
      </Card>
      {pick && <DayDetail admin rec={pick.rec} userId={pick.userId} onClose={() => setPick(null)} />}
    </div>
  );
}
