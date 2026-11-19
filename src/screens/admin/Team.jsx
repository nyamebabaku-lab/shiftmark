import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, X, ChevronRight, ArrowLeft, FileDown, Pencil, Share2, Copy, Users } from 'lucide-react';
import { useStore, updateProfile, removeProfile } from '../../data/store';
import { useNow, useMonth } from '../../lib/useRecords';
import { Card, PageHead, Avatar, Button, Modal, Field, Input, Select, MonthSwitch, Stat, StatusPill, ShiftPill, Empty, cx } from '../../components/ui';
import MonthCalendar from '../../components/MonthCalendar';
import DayDetail from '../../components/DayDetail';
import { money, dur, hours, hm, dayLabel } from '../../lib/format';
import { workerMonthPdf } from '../../lib/pdf';
import { toast } from '../../components/toast';
import { today } from '../../lib/shifts';
import { CalendarCheck2, Timer, AlertTriangle, XCircle, Wallet } from 'lucide-react';

export function InviteCard() {
  const code = useStore((s) => s.inviteCode);
  const company = useStore((s) => s.settings?.company);
  const msg = `Join ${company} on ShiftMark to clock in automatically. Install the app, tap "New worker? Create your account" and use invite code: ${code}`;
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invite code for new workers</p>
        <p className="font-mono text-2xl font-bold tracking-[.3em] text-slate-900 dark:text-white">{code || '——'}</p>
      </div>
      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(code); toast.success('Code copied'); }}><Copy className="h-4 w-4" />Copy</Button>
      <Button size="sm" variant="soft" onClick={async () => { try { if (navigator.share) await navigator.share({ text: msg }); else { await navigator.clipboard.writeText(msg); toast.success('Message copied', 'Paste it in WhatsApp'); } } catch { /* cancelled */ } }}><Share2 className="h-4 w-4" />Share</Button>
    </Card>
  );
}

export default function Team() {
  const profiles = useStore((s) => s.profiles);
  const me = useStore((s) => s.me);
  const [tab, setTab] = useState('active');
  const [approve, setApprove] = useState(null);
  const list = profiles.filter((p) => p.user_id !== me.user_id && (tab === 'active' ? p.status === 'active' : p.status === tab));
  const pending = profiles.filter((p) => p.status === 'pending').length;
  return (
    <div className="animate-fade-in space-y-4">
      <PageHead title="Team" sub={`${profiles.filter((p) => p.status === 'active' && p.role === 'worker').length} active workers`} />
      <InviteCard />
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
        {[['active', 'Active'], ['pending', `Waiting${pending ? ` (${pending})` : ''}`], ['disabled', 'Switched off']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cx('flex-1 rounded-lg py-2 text-sm font-semibold', tab === k ? 'bg-white text-slate-900 shadow-sm dark:bg-ink-800 dark:text-white' : 'text-slate-500')}>{l}</button>
        ))}
      </div>
      <Card className="divide-y divide-slate-100 dark:divide-white/5">
        {!list.length && <Empty icon={Users} title={tab === 'pending' ? 'Nobody waiting' : 'Nobody here yet'}>{tab === 'active' ? 'Share the invite code so workers can join.' : null}</Empty>}
        {list.map((p) => (
          tab === 'pending' ? (
            <div key={p.user_id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={p.name} />
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900 dark:text-white">{p.name}</p><p className="text-xs text-slate-500">{p.phone}</p></div>
              <Button size="sm" variant="outline" onClick={() => { if (confirm(`Reject and remove ${p.name}?`)) { removeProfile(p.user_id); toast.success('Removed'); } }}><X className="h-4 w-4" /></Button>
              <Button size="sm" variant="success" onClick={() => setApprove(p)}><Check className="h-4 w-4" />Approve</Button>
            </div>
          ) : (
            <Link key={p.user_id} to={`/team/${p.user_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5">
              <Avatar name={p.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.name}{p.role === 'admin' && <span className="ml-2 rounded bg-indigo-100 px-1.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">ADMIN</span>}</p>
                <p className="text-xs text-slate-500">{p.phone}{p.staff_no ? ` · ${p.staff_no}` : ''}{p.role === 'worker' ? ` · ${money(p.daily_rate)}/day` : ''}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          )
        ))}
      </Card>
      {approve && <EditWorker worker={approve} approving onClose={() => setApprove(null)} />}
    </div>
  );
}

export function EditWorker({ worker, approving, onClose }) {
  const settings = useStore((s) => s.settings);
  const me = useStore((s) => s.me);
  const [f, setF] = useState({ name: worker.name, phone: worker.phone, staff_no: worker.staff_no || '', daily_rate: worker.daily_rate || '', ot_rate: worker.ot_rate || '', start_date: worker.start_date || today(), status: approving ? 'active' : worker.status, role: worker.role });
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const cur = settings?.currency || 'GH₵';
  const save = () => {
    if (f.name.trim().length < 2) { toast.error('Enter a name'); return; }
    updateProfile(worker.user_id, { ...f, name: f.name.trim(), daily_rate: Number(f.daily_rate) || 0, ot_rate: Number(f.ot_rate) || 0, start_date: f.start_date || null });
    toast.success(approving ? `${f.name} approved` : 'Saved');
    onClose();
  };
  const self = worker.user_id === me.user_id;
  return (
    <Modal open onClose={onClose} title={approving ? `Approve ${worker.name}` : 'Edit worker'} footer={<><Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" onClick={save}>{approving ? 'Approve' : 'Save'}</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name" className="col-span-2"><Input value={f.name} onChange={up('name')} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={up('phone')} /></Field>
        <Field label="Staff number"><Input value={f.staff_no} onChange={up('staff_no')} placeholder="Optional" /></Field>
        <Field label={`Daily rate (${cur})`}><Input type="number" inputMode="decimal" value={f.daily_rate} onChange={up('daily_rate')} /></Field>
        <Field label={`Overtime per hour (${cur})`}><Input type="number" inputMode="decimal" value={f.ot_rate} onChange={up('ot_rate')} /></Field>
        <Field label="Counting starts" hint="Days before this never show as absent." className="col-span-2"><Input type="date" value={f.start_date} onChange={up('start_date')} /></Field>
        {!approving && !self && (
          <>
            <Field label="Status"><Select value={f.status} onChange={up('status')}><option value="active">Active</option><option value="disabled">Switched off</option></Select></Field>
            <Field label="Role"><Select value={f.role} onChange={up('role')}><option value="worker">Worker</option><option value="admin">Admin</option></Select></Field>
          </>
        )}
      </div>
    </Modal>
  );
}

export function WorkerDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const now = useNow(60000);
  const settings = useStore((s) => s.settings);
  const worker = useStore((s) => s.profiles.find((p) => p.user_id === id));
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth() + 1]);
  const [pick, setPick] = useState(null);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const { records, summary: s, profile } = useMonth(id, ym[0], ym[1], now);
  if (!worker) return <Empty title="Worker not found"><Link className="text-brand-700 underline" to="/team">Back to team</Link></Empty>;
  const cur = settings?.currency || 'GH₵';
  const list = records.filter((r) => r.date <= today(now) && (r.shift.type !== 'O' || r.status === 'extra')).slice().reverse();
  return (
    <div className="animate-fade-in space-y-4">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500"><ArrowLeft className="h-4 w-4" />Back</button>
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Avatar name={worker.name} className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-slate-900 dark:text-white">{worker.name}</p>
          <p className="text-xs text-slate-500">{worker.phone}{worker.staff_no ? ` · ${worker.staff_no}` : ''} · {money(worker.daily_rate, cur)}/day · OT {money(worker.ot_rate, cur)}/h{worker.status !== 'active' ? ` · ${worker.status}` : ''}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Edit</Button>
      </Card>
      <div className="flex items-center justify-between gap-2">
        <MonthSwitch year={ym[0]} month={ym[1]} onChange={(y, m) => setYm([y, m])} />
        <Button size="sm" variant="dark" loading={busy} onClick={async () => { setBusy(true); try { await workerMonthPdf({ profile, records, summary: s, settings, year: ym[0], month: ym[1] }); } catch (e) { toast.error('PDF failed', e.message); } finally { setBusy(false); } }}><FileDown className="h-4 w-4" />PDF</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={CalendarCheck2} tone="green" label="Days worked" value={s.worked} sub={s.scheduled ? `${s.attendanceRate}% attendance` : ''} />
        <Stat icon={Timer} label="Hours" value={hours(s.workedMin)} sub={`OT ${dur(s.otMin)}`} />
        <Stat icon={AlertTriangle} tone="amber" label="Late" value={s.late} sub={s.early ? `${s.early} left early` : ''} />
        <Stat icon={XCircle} tone="rose" label="Absent" value={s.absent} sub={s.excused ? `${s.excused} excused` : ''} />
        <Stat icon={Wallet} tone="violet" label="Pay" value={money(s.pay, cur)} sub={`${money(s.basePay, cur)} + OT ${money(s.otPay, cur)}`} />
      </div>
      <Card className="p-3 sm:p-4"><MonthCalendar records={records} onPick={setPick} /></Card>
      <Card className="divide-y divide-slate-100 dark:divide-white/5">
        {list.map((r) => (
          <button key={r.date} onClick={() => setPick(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5">
            <div className="w-24 shrink-0"><p className="text-sm font-semibold text-slate-900 dark:text-white">{dayLabel(r.date)}</p><ShiftPill type={r.shift.type} label={r.shift.label} className="mt-0.5" /></div>
            <div className="min-w-0 flex-1 text-xs text-slate-500">{r.arrival ? `${hm(r.arrival)} → ${r.departure ? hm(r.departure) : r.missingOut ? '?' : 'now'} · ${dur(r.workedMin)}${r.otMin ? ` · +${dur(r.otMin)} OT` : ''}` : r.mark?.note || '—'}</div>
            <StatusPill status={r.status} />
          </button>
        ))}
      </Card>
      {pick && <DayDetail admin rec={pick} userId={id} onClose={() => setPick(null)} />}
      {edit && <EditWorker worker={worker} onClose={() => setEdit(false)} />}
    </div>
  );
}
