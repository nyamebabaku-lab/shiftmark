import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, MapPin, Navigation, Satellite, AlertTriangle, CalendarDays, Wallet, Timer, ChevronRight, FlaskConical } from 'lucide-react';
import { useStore, addEvent, isClockedIn, lastEvent } from '../../data/store';
import { useNow, useMonth } from '../../lib/useRecords';
import { currentOrNextShift, shiftOn, addDays, today, SHIFT_TYPES } from '../../lib/shifts';
import { distance, clockInWindow } from '../../lib/geo';
import { hm, dur, money, countdown, weekday, ago, hours } from '../../lib/format';
import { Card, Button, Modal, ShiftPill, StatusPill, cx } from '../../components/ui';
import { SyncBadge } from '../../components/Layout';
import { toast } from '../../components/toast';
import { simulateReading } from '../../native/tracker';
import { DEMO, IS_NATIVE } from '../../config';

/** Quick one-off GPS fix for the manual button (best effort, 12 s). */
function quickFix() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, time: Date.now() }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
    return null;
  });
}

export default function WorkerHome() {
  const now = useNow(15000);
  const me = useStore((s) => s.me);
  const settings = useStore((s) => s.settings);
  const events = useStore((s) => s.events);
  const geo = useStore((s) => s.geo);
  const autoTrack = useStore((s) => s.prefs.autoTrack);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const shift = currentOrNextShift(now, settings);
  const clockedIn = isClockedIn(events, me.user_id, now.getTime());
  const last = lastEvent(events, me.user_id);
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const { summary, records } = useMonth(me.user_id, y, m, now);
  const todayRec = records.find((r) => r.date === (shift?.live ? shift.date : today(now)));
  const week = useMemo(() => Array.from({ length: 8 }, (_, i) => shiftOn(addDays(today(now), i), settings)), [now, settings]);
  const cur = settings?.currency || 'GH₵';
  const officeSet = settings?.office_lat != null;

  const doManual = async () => {
    const kind = clockedIn ? 'out' : 'in';
    setBusy(true);
    const fix = await quickFix();
    setBusy(false);
    const d = fix && officeSet ? distance({ lat: settings.office_lat, lng: settings.office_lng }, fix) : null;
    const far = d != null && d > (settings.radius_m || 150) + 50;
    setConfirm({ kind, fix, d, far });
  };
  const commit = () => {
    const { kind, fix, d, far } = confirm;
    addEvent({ kind, source: 'manual', reading: fix, distance: d, note: far ? `Manual ${kind} ${Math.round(d)} m from office` : '' });
    toast.success(kind === 'in' ? `Clocked in ${hm(Date.now())}` : `Clocked out ${hm(Date.now())}`, far ? 'Saved — your admin will see you were away from the office.' : 'Saved on this phone; it syncs when you are online.');
    setConfirm(null);
  };

  const inWindow = clockInWindow(now.getTime(), settings);
  const sinceIn = clockedIn && last ? Math.round((now - new Date(last.at)) / 60000) : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Hi, {me.name.split(' ')[0]}</h1>
        </div>
        <SyncBadge />
      </div>

      {/* Shift + clock card */}
      <div className="overflow-hidden rounded-2xl bg-ink-900 text-white shadow-soft ring-1 ring-white/5">
        <div className="relative p-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-2xl" style={{ background: `${SHIFT_TYPES[shift?.type || 'O'].color}55` }} />
          {shift ? (
            <>
              <div className="flex items-center gap-2">
                <ShiftPill type={shift.type} label={shift.label} />
                {todayRec && shift.live && <StatusPill status={todayRec.status} />}
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight">{shift.startText} – {shift.endText}</p>
              <p className="text-sm text-slate-300">
                {shift.live ? `Ends in ${countdown(shift.end - now)}` : `${shift.date === today(now) ? 'Today' : weekday(shift.date)} · starts in ${countdown(shift.start - now)}`}
              </p>
            </>
          ) : <p className="text-lg font-semibold">No shift set</p>}

          <div className="mt-5 flex items-center gap-4">
            <div className="relative">
              {clockedIn && <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping2" />}
              <span className={cx('relative flex h-14 w-14 items-center justify-center rounded-full', clockedIn ? 'bg-emerald-500' : 'bg-white/10')}>
                {clockedIn ? <LogIn className="h-6 w-6" /> : <LogOut className="h-6 w-6 text-slate-300" />}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{clockedIn ? `Clocked in at ${hm(last.at)}` : 'Not clocked in'}</p>
              <p className="text-xs text-slate-400">
                {clockedIn ? `${dur(sinceIn)} so far${last.source === 'auto' ? ' · automatic' : ''}` : last ? `Last: ${last.kind === 'in' ? 'in' : 'out'} ${hm(last.at)} (${ago(last.at)})` : 'ShiftMark clocks you in when you reach the office'}
              </p>
            </div>
          </div>
          <Button size="lg" variant={clockedIn ? 'outline' : 'primary'} loading={busy} className={cx('mt-4 w-full', clockedIn && '!border-white/20 !bg-white/5 !text-white')} onClick={doManual}>
            {clockedIn ? <><LogOut className="h-5 w-5" />Clock out</> : <><LogIn className="h-5 w-5" />Clock in manually</>}
          </Button>
        </div>
      </div>

      {/* Geofence status */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className={cx('rounded-xl p-2.5', geo.tracking && !geo.error ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15')}>
            {geo.tracking ? <Satellite className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {!officeSet ? 'Office location not set yet' : !autoTrack ? 'Auto clock-in is off' : geo.tracking ? (geo.inside ? `At ${settings.office_name || 'the office'}` : 'Auto clock-in is on') : 'Auto clock-in is paused'}
            </p>
            <p className="text-xs text-slate-500">
              {!officeSet ? 'Your admin must pin the office on the map.'
                : geo.error ? geo.error
                  : geo.distance != null ? `${geo.distance < 1000 ? `${Math.round(geo.distance)} m` : `${(geo.distance / 1000).toFixed(1)} km`} from the office · GPS ±${Math.round(geo.accuracy || 0)} m · ${ago(geo.lastFix)}`
                    : 'Waiting for a GPS fix…'}
            </p>
            {!IS_NATIVE && autoTrack && officeSet && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">In a browser, auto clock-in only works while ShiftMark is open on screen.</p>}
            {inWindow && !clockedIn && officeSet && <p className="mt-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300">Clock-in window open for {inWindow.label}</p>}
          </div>
          {(!geo.tracking || geo.error || !autoTrack) && <Link to="/me" className="text-xs font-semibold text-brand-700 dark:text-brand-300">Fix</Link>}
        </div>
        {DEMO && officeSet && (
          <div className="mt-3 flex gap-2 rounded-xl bg-indigo-50 p-2 dark:bg-indigo-500/10">
            <FlaskConical className="mt-1.5 h-4 w-4 shrink-0 text-indigo-500" />
            <Button size="sm" variant="soft" className="flex-1" onClick={() => { simulateReading(true); if (!clockInWindow(Date.now(), settings) && !clockedIn) toast.info('You\'re at the office', 'No shift is starting right now, so you weren\'t clocked in.'); }}><MapPin className="h-4 w-4" />Arrive</Button>
            <Button size="sm" variant="soft" className="flex-1" onClick={() => simulateReading(false)}><Navigation className="h-4 w-4" />Leave</Button>
          </div>
        )}
      </Card>

      {/* This month */}
      <Link to="/pay" className="block">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900 dark:text-white">This month</p>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[[CalendarDays, summary.worked, 'days'], [Timer, hours(summary.workedMin), 'hours'], [AlertTriangle, summary.late, 'late'], [Wallet, money(summary.pay, '').trim().replace(/\.00$/, ''), cur]].map(([I, v, l]) => (
              <div key={l} className="rounded-xl bg-slate-50 py-2.5 dark:bg-white/5">
                <I className="mx-auto mb-1 h-4 w-4 text-slate-400" />
                <p className="text-lg font-bold leading-tight text-slate-900 dark:text-white">{v}</p>
                <p className="text-[11px] text-slate-500">{l}</p>
              </div>
            ))}
          </div>
        </Card>
      </Link>

      {/* Next 8 days */}
      <Card className="p-4">
        <p className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Next 8 days</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {week.map((s) => (
            <div key={s.date} className={cx('min-w-[64px] flex-1 rounded-xl p-2 text-center', s.date === today(now) ? 'ring-2 ring-brand-500' : 'ring-1 ring-slate-200/70 dark:ring-white/5')}>
              <p className="text-[11px] font-semibold text-slate-500">{weekday(s.date)}</p>
              <p className="font-bold text-slate-900 dark:text-white">{Number(s.date.slice(8))}</p>
              <span className="mx-auto mt-1 block h-1.5 w-8 rounded-full" style={{ background: SHIFT_TYPES[s.type].color }} />
              <p className="mt-1 text-[10px] font-bold uppercase text-slate-500">{SHIFT_TYPES[s.type].short}</p>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.kind === 'in' ? 'Clock in now?' : 'Clock out now?'} footer={<><Button variant="outline" className="flex-1" onClick={() => setConfirm(null)}>Cancel</Button><Button className="flex-1" onClick={commit}>{confirm?.kind === 'in' ? 'Clock in' : 'Clock out'} {hm(Date.now())}</Button></>}>
        {confirm?.far ? (
          <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><AlertTriangle className="h-5 w-5 shrink-0" />You are about {confirm.d < 1000 ? `${Math.round(confirm.d)} m` : `${(confirm.d / 1000).toFixed(1)} km`} from the office. You can still continue — your admin will see the distance.</p>
        ) : confirm?.fix ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">Your location will be saved with this {confirm.kind === 'in' ? 'clock-in' : 'clock-out'}.</p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">We couldn't get your location. The {confirm?.kind === 'in' ? 'clock-in' : 'clock-out'} will be saved without it.</p>
        )}
      </Modal>
    </div>
  );
}
