import { useState } from 'react';
import { FileDown, CalendarCheck2, Timer, AlertTriangle, XCircle, Sparkles, HeartPulse } from 'lucide-react';
import { useStore } from '../../data/store';
import { useNow, useMonth } from '../../lib/useRecords';
import { Card, PageHead, MonthSwitch, Stat, Button } from '../../components/ui';
import { money, dur, hours, monthName } from '../../lib/format';
import { workerMonthPdf } from '../../lib/pdf';
import { toast } from '../../components/toast';

export default function WorkerPay() {
  const now = useNow(60000);
  const me = useStore((s) => s.me);
  const settings = useStore((s) => s.settings);
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth() + 1]);
  const { records, summary: s, profile } = useMonth(me.user_id, ym[0], ym[1], now);
  const cur = settings?.currency || 'GH₵';
  const [busy, setBusy] = useState(false);
  const pdf = async () => {
    setBusy(true);
    try { await workerMonthPdf({ profile, records, summary: s, settings, year: ym[0], month: ym[1] }); } catch (e) { toast.error('Could not make the PDF', e.message); } finally { setBusy(false); }
  };
  return (
    <div className="animate-fade-in">
      <PageHead title="Hours & pay" sub={`${monthName(ym[1])} ${ym[0]}`} right={<MonthSwitch year={ym[0]} month={ym[1]} onChange={(y, m) => setYm([y, m])} />} />
      <Card className="overflow-hidden !border-0 bg-gradient-to-br from-brand-600 to-indigo-600 p-5 text-white">
        <p className="text-sm text-white/80">Estimated pay so far</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">{money(s.pay, cur)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/10 p-3"><p className="text-white/70">{s.paidDays} days × {money(profile.daily_rate, cur)}</p><p className="font-bold">{money(s.basePay, cur)}</p></div>
          <div className="rounded-xl bg-white/10 p-3"><p className="text-white/70">{hours(s.otMin)} h overtime × {money(profile.ot_rate, cur)}</p><p className="font-bold">{money(s.otPay, cur)}</p></div>
        </div>
        {!Number(profile.daily_rate) && <p className="mt-3 text-xs text-white/80">Your admin hasn't set your daily rate yet.</p>}
      </Card>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={CalendarCheck2} tone="green" label="Days worked" value={s.worked} sub={s.scheduled ? `of ${s.scheduled} shifts · ${s.attendanceRate}%` : ''} />
        <Stat icon={Timer} label="Hours worked" value={hours(s.workedMin)} sub={`Overtime ${dur(s.otMin)}`} />
        <Stat icon={AlertTriangle} tone="amber" label="Late" value={s.late} sub={s.lateMin ? `${s.lateMin} min in total` : 'Nice!'} />
        <Stat icon={XCircle} tone="rose" label="Absent" value={s.absent} />
        <Stat icon={HeartPulse} tone="green" label="Excused" value={s.excused} sub="leave / sick / holiday" />
        <Stat icon={Sparkles} tone="violet" label="Extra days" value={s.extra} sub="worked on off days" />
      </div>
      {s.missingOut > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{s.missingOut} shift{s.missingOut > 1 ? 's' : ''} had no clock-out and were counted until the shift end.</p>}
      <Button variant="dark" size="lg" className="mt-5 w-full" loading={busy} onClick={pdf}><FileDown className="h-5 w-5" />Download monthly PDF</Button>
      <p className="mt-2 text-center text-xs text-slate-500">Pay is an estimate from your clock-ins. Your admin's report is final.</p>
    </div>
  );
}
