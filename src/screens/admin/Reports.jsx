import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileDown, Wallet, CalendarCheck2, Timer, AlertTriangle } from 'lucide-react';
import { useStore } from '../../data/store';
import { useNow, useTeam } from '../../lib/useRecords';
import { monthRange } from '../../lib/shifts';
import { Card, PageHead, MonthSwitch, Button, Stat, Avatar } from '../../components/ui';
import { money, dur, hours, monthName } from '../../lib/format';
import { teamMonthPdf } from '../../lib/pdf';
import { toast } from '../../components/toast';

export default function Reports() {
  const now = useNow(60000);
  const settings = useStore((s) => s.settings);
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth() + 1]);
  const [from, to] = monthRange(ym[0], ym[1]);
  const rows = useTeam(from, to, now);
  const [busy, setBusy] = useState(false);
  const cur = settings?.currency || 'GH₵';
  const tot = rows.reduce((a, { summary: s }) => ({ pay: a.pay + s.pay, worked: a.worked + s.worked, min: a.min + s.workedMin, ot: a.ot + s.otMin, late: a.late + s.late, absent: a.absent + s.absent }), { pay: 0, worked: 0, min: 0, ot: 0, late: 0, absent: 0 });
  return (
    <div className="animate-fade-in space-y-4">
      <PageHead title="Reports" sub={`${monthName(ym[1])} ${ym[0]}`} right={<MonthSwitch year={ym[0]} month={ym[1]} onChange={(y, m) => setYm([y, m])} />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Wallet} tone="violet" label="Total pay" value={money(tot.pay, cur)} sub={`OT ${dur(tot.ot)}`} />
        <Stat icon={CalendarCheck2} tone="green" label="Days worked" value={tot.worked} />
        <Stat icon={Timer} label="Hours worked" value={hours(tot.min)} />
        <Stat icon={AlertTriangle} tone="amber" label="Late / absent" value={`${tot.late} / ${tot.absent}`} />
      </div>
      <Button variant="dark" size="lg" className="w-full sm:w-auto" loading={busy} onClick={async () => {
        setBusy(true);
        try { await teamMonthPdf({ rows, settings, year: ym[0], month: ym[1] }); } catch (e) { toast.error('PDF failed', e.message); } finally { setBusy(false); }
      }}><FileDown className="h-5 w-5" />Download team PDF</Button>

      {/* Phones: cards. Wide screens: table. */}
      <div className="space-y-2 md:hidden">
        {rows.map(({ profile: p, summary: s }) => (
          <Link key={p.user_id} to={`/team/${p.user_id}`}>
            <Card className="mb-2 p-4">
              <div className="flex items-center gap-3">
                <Avatar name={p.name} className="h-9 w-9" />
                <p className="flex-1 font-semibold text-slate-900 dark:text-white">{p.name}</p>
                <p className="font-bold text-slate-900 dark:text-white">{money(s.pay, cur)}</p>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                {[['Days', s.worked], ['Hours', hours(s.workedMin)], ['Late', s.late], ['Absent', s.absent]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 py-1.5 dark:bg-white/5"><p className="font-bold text-slate-900 dark:text-white">{v}</p><p className="text-slate-500">{k}</p></div>
                ))}
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr className="border-b border-slate-100 dark:border-white/5">
              {['Worker', 'Days', 'Late', 'Absent', 'Excused', 'Extra', 'Hours', 'Overtime', 'Attendance', 'Pay'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ profile: p, summary: s }) => (
              <tr key={p.user_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                <td className="px-4 py-3"><Link to={`/team/${p.user_id}`} className="font-semibold text-slate-900 hover:text-brand-700 dark:text-white">{p.name}</Link></td>
                <td className="px-4 py-3">{s.worked}</td>
                <td className="px-4 py-3 text-amber-700 dark:text-amber-400">{s.late || ''}</td>
                <td className="px-4 py-3 text-rose-600">{s.absent || ''}</td>
                <td className="px-4 py-3">{s.excused || ''}</td>
                <td className="px-4 py-3">{s.extra || ''}</td>
                <td className="px-4 py-3">{hours(s.workedMin)}</td>
                <td className="px-4 py-3">{s.otMin ? dur(s.otMin) : ''}</td>
                <td className="px-4 py-3">{s.attendanceRate == null ? '' : `${s.attendanceRate}%`}</td>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{money(s.pay, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
