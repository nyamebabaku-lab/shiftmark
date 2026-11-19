import { useState } from 'react';
import { LogIn, LogOut, MapPin, Hand, ShieldCheck, Ban, Undo2, AlertTriangle, CloudOff } from 'lucide-react';
import { Modal, Button, StatusPill, ShiftPill, Field, Input, Select, cx } from './ui';
import { hm, dur, dayLabel } from '../lib/format';
import { MARK_KINDS } from '../lib/attendance';
import { addDays } from '../lib/shifts';
import { useStore, addEvent, voidEvent, setMark, clearMark } from '../data/store';
import { toast } from './toast';
import { useNow, useRecords } from '../lib/useRecords';

const SRC = { auto: { icon: MapPin, label: 'Auto (GPS)' }, manual: { icon: Hand, label: 'Manual button' }, admin: { icon: ShieldCheck, label: 'Added by admin' } };

/** Everything about one worker's day. Admins can add/void clock events and mark leave/sick days. */
export default function DayDetail({ rec: initial, userId, onClose, admin }) {
  const now = useNow(30000);
  // Recomputed live, so admin changes show straight away.
  const { records } = useRecords(userId, initial.date, initial.date, now);
  const rec = records[0] || initial;
  const events = useStore((s) => s.events);
  const settings = useStore((s) => s.settings);
  const [adding, setAdding] = useState(null);
  const [markOpen, setMarkOpen] = useState(false);
  if (!rec) return null;
  const sh = rec.shift;
  // Events that belong to this day: those in its visits, plus voided ones near it.
  const sessIds = new Set(rec.sessions.flatMap((s) => [s.inEv?.id, s.outEv?.id]).filter(Boolean));
  const lo = `${addDays(rec.date, 0)}T00:00`;
  const hi = `${addDays(rec.date, 1)}T12:00`;
  const dayEvents = events.filter((e) => e.user_id === userId && (sessIds.has(e.id) || (e.voided && e.at >= new Date(lo).toISOString() && e.at < new Date(hi).toISOString())));

  return (
    <Modal open onClose={onClose} title={dayLabel(rec.date, true)}>
      <div className="flex flex-wrap items-center gap-2">
        <ShiftPill type={sh.type} label={sh.type === 'O' ? 'Off day' : `${sh.label} · ${sh.startText}–${sh.endText}`} />
        <StatusPill status={rec.status} />
        {rec.mark && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">{MARK_KINDS[rec.mark.kind]}{rec.mark.paid ? ' (paid)' : ''}</span>}
      </div>

      {(rec.arrival || rec.workedMin > 0) && (
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[['In', hm(rec.arrival)], ['Out', rec.departure ? hm(rec.departure) : rec.missingOut ? '?' : '—'], ['Worked', dur(rec.workedMin)], ['Overtime', rec.otMin ? dur(rec.otMin) : '—']].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 py-2 dark:bg-white/5">
              <p className="text-[11px] text-slate-500">{k}</p>
              <p className="font-bold text-slate-900 dark:text-white">{v}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 space-y-1 text-sm">
        {rec.late && <p className="text-amber-700 dark:text-amber-300">Late by {rec.lateMin} minutes.</p>}
        {rec.early && <p className="text-amber-700 dark:text-amber-300">Left {rec.earlyMin} minutes before the shift ended.</p>}
        {rec.missingOut && <p className="text-rose-600">No clock-out was recorded — counted until the shift end time.</p>}
        {rec.mark?.note && <p className="text-slate-500">Note: {rec.mark.note}</p>}
      </div>

      <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">Clock events</h4>
      {!dayEvents.length && <p className="text-sm text-slate-500">No clock-ins on this day.</p>}
      <ul className="space-y-2">
        {dayEvents.map((e) => {
          const S = SRC[e.source] || SRC.manual;
          return (
            <li key={e.id} className={cx('flex items-center gap-3 rounded-xl border border-slate-100 p-2.5 dark:border-white/5', e.voided && 'opacity-50')}>
              <span className={cx('rounded-lg p-2', e.kind === 'in' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300')}>
                {e.kind === 'in' ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cx('text-sm font-semibold text-slate-900 dark:text-white', e.voided && 'line-through')}>{e.kind === 'in' ? 'Clocked in' : 'Clocked out'} {hm(e.at)}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><S.icon className="h-3 w-3" />{S.label}</span>
                  {e.distance_m != null && <span>{e.distance_m} m from office</span>}
                  {e.simulated && <span className="inline-flex items-center gap-1 font-semibold text-rose-600"><AlertTriangle className="h-3 w-3" />fake GPS</span>}
                  {e.pending && <span className="inline-flex items-center gap-1 text-sky-600"><CloudOff className="h-3 w-3" />not synced yet</span>}
                  {e.rejected && <span className="text-rose-600">refused: {e.rejected}</span>}
                </p>
                {e.note && <p className="text-xs italic text-slate-500">“{e.note}”</p>}
              </div>
              {admin && (
                <button onClick={() => { voidEvent(e.id, !e.voided); toast.success(e.voided ? 'Restored' : 'Clock event removed'); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-white/5" title={e.voided ? 'Restore' : 'Remove'}>
                  {e.voided ? <Undo2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {admin && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="soft" size="sm" onClick={() => setAdding('in')}><LogIn className="h-4 w-4" />Add clock-in</Button>
          <Button variant="soft" size="sm" onClick={() => setAdding('out')}><LogOut className="h-4 w-4" />Add clock-out</Button>
          <Button variant="outline" size="sm" className="col-span-2" onClick={() => setMarkOpen(true)}>{rec.mark ? 'Change leave / sick note' : 'Mark leave, sick or holiday'}</Button>
        </div>
      )}
      {adding && <AddEvent kind={adding} rec={rec} userId={userId} onClose={() => setAdding(null)} />}
      {markOpen && <MarkDay rec={rec} userId={userId} settings={settings} onClose={() => setMarkOpen(false)} />}
    </Modal>
  );
}

function AddEvent({ kind, rec, userId, onClose }) {
  const sh = rec.shift;
  const def = kind === 'in' ? (sh.startText || '08:00') : (sh.endText || '17:00');
  const nextDay = kind === 'out' && sh.type === 'N';
  const [date, setDate] = useState(nextDay ? addDays(rec.date, 1) : rec.date);
  const [time, setTime] = useState(def);
  const [note, setNote] = useState('');
  const save = () => {
    if (!note.trim()) { toast.error('Add a reason', 'e.g. “Phone was off”'); return; }
    const [y, m, d] = date.split('-').map(Number);
    const [h, mi] = time.split(':').map(Number);
    const at = new Date(y, m - 1, d, h, mi).getTime();
    if (at > Date.now() + 600000) { toast.error('That time is in the future'); return; }
    addEvent({ kind, at, source: 'admin', note: note.trim(), userId });
    toast.success(kind === 'in' ? 'Clock-in added' : 'Clock-out added');
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={kind === 'in' ? 'Add a clock-in' : 'Add a clock-out'} footer={<><Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button><Button className="flex-1" onClick={save}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Time"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <Field label="Reason (the worker will see it)" className="mt-3"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Phone battery died" /></Field>
    </Modal>
  );
}

function MarkDay({ rec, userId, onClose }) {
  const [kind, setKind] = useState(rec.mark?.kind || 'leave');
  const [paid, setPaid] = useState(rec.mark ? !!rec.mark.paid : true);
  const [note, setNote] = useState(rec.mark?.note || '');
  return (
    <Modal open onClose={onClose} title={`Mark ${dayLabel(rec.date)}`} footer={(
      <>
        {rec.mark && <Button variant="outline" onClick={() => { clearMark(userId, rec.date); toast.success('Mark removed'); onClose(); }}>Remove</Button>}
        <Button className="flex-1" onClick={() => { setMark({ user_id: userId, day: rec.date, kind, paid: kind === 'absent' ? false : paid, note: note.trim() }); toast.success('Saved'); onClose(); }}>Save</Button>
      </>
    )}>
      <Field label="What was it?"><Select value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(MARK_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      {kind !== 'absent' && (
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4 accent-cyan-600" />Pay this day (counts as a paid day)</label>
      )}
      <Field label="Note" className="mt-3"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
    </Modal>
  );
}
