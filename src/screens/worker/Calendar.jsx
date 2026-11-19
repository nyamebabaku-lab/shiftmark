import { useState } from 'react';
import { useStore } from '../../data/store';
import { useNow, useMonth } from '../../lib/useRecords';
import { Card, PageHead, MonthSwitch, StatusPill, ShiftPill } from '../../components/ui';
import MonthCalendar from '../../components/MonthCalendar';
import DayDetail from '../../components/DayDetail';
import { hm, dur, dayLabel } from '../../lib/format';
import { today } from '../../lib/shifts';

export default function WorkerCalendar() {
  const now = useNow(60000);
  const me = useStore((s) => s.me);
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth() + 1]);
  const [pick, setPick] = useState(null);
  const { records } = useMonth(me.user_id, ym[0], ym[1], now);
  const past = records.filter((r) => r.date <= today(now) && r.shift.type !== 'O' || r.status === 'extra').slice().reverse();
  return (
    <div className="animate-fade-in">
      <PageHead title="My shifts" right={<MonthSwitch year={ym[0]} month={ym[1]} onChange={(y, m) => setYm([y, m])} />} />
      <Card className="p-3 sm:p-4"><MonthCalendar records={records} onPick={setPick} /></Card>
      <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">Day by day</h2>
      <Card className="divide-y divide-slate-100 dark:divide-white/5">
        {!past.length && <p className="p-4 text-sm text-slate-500">No shifts yet this month.</p>}
        {past.map((r) => (
          <button key={r.date} onClick={() => setPick(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5">
            <div className="w-24 shrink-0"><p className="text-sm font-semibold text-slate-900 dark:text-white">{dayLabel(r.date)}</p><ShiftPill type={r.shift.type} label={r.shift.label} className="mt-0.5" /></div>
            <div className="min-w-0 flex-1 text-xs text-slate-500">{r.arrival ? `${hm(r.arrival)} → ${r.departure ? hm(r.departure) : r.missingOut ? '?' : 'now'} · ${dur(r.workedMin)}${r.otMin ? ` · +${dur(r.otMin)} OT` : ''}` : '—'}</div>
            <StatusPill status={r.status} />
          </button>
        ))}
      </Card>
      {pick && <DayDetail rec={pick} userId={me.user_id} onClose={() => setPick(null)} />}
    </div>
  );
}
