import { useState, lazy, Suspense } from 'react';
import { Crosshair, Save, RefreshCw, MapPin, CalendarClock, Clock, Building2 } from 'lucide-react';
import { useStore, saveSettings, newInviteCode } from '../../data/store';
import { Card, PageHead, Button, Field, Input, Select } from '../../components/ui';
import { CYCLE, SHIFT_TYPES, DEFAULT_TIMES, cycleIndex, cycleLabel, anchorFrom, shiftOn, today, addDays } from '../../lib/shifts';
import { dayLabel } from '../../lib/format';
import { toast } from '../../components/toast';
import { InviteCard } from './Team';
import { GeneralSettings } from '../worker/Me';

const MapPicker = lazy(() => import('../../components/MapPicker'));

const Section = ({ icon: Icon, title, children }) => (
  <Card className="p-4">
    <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Icon className="h-5 w-5 text-brand-600" />{title}</h2>
    {children}
  </Card>
);

export default function AdminSettings() {
  const s = useStore((x) => x.settings);
  const [f, setF] = useState(() => ({
    company: s.company, office_name: s.office_name, office_lat: s.office_lat, office_lng: s.office_lng, radius_m: s.radius_m,
    grace_min: s.grace_min, ot_min: s.ot_min, currency: s.currency || 'GH₵', shifts: { ...DEFAULT_TIMES, ...(s.shifts || {}) },
  }));
  const td = today();
  const [rot, setRot] = useState({ date: td, idx: cycleIndex(td, s.anchor) });
  const [locating, setLocating] = useState(false);
  const up = (k, num) => (e) => setF({ ...f, [k]: num ? Number(e.target.value) : e.target.value });
  const setTime = (t, k) => (e) => setF({ ...f, shifts: { ...f.shifts, [t]: { ...f.shifts[t], [k]: e.target.value } } });
  const anchor = anchorFrom(rot.date, rot.idx);

  const here = () => {
    if (!navigator.geolocation) { toast.error('No GPS on this device'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setF((x) => ({ ...x, office_lat: p.coords.latitude, office_lng: p.coords.longitude })); setLocating(false); toast.success('Pinned to where you are', `Accuracy ±${Math.round(p.coords.accuracy)} m — drag the pin to fine-tune.`); },
      () => { setLocating(false); toast.error('Could not get your location', 'Allow location access, or drag the pin on the map.'); },
      { enableHighAccuracy: true, timeout: 20000 },
    );
  };
  const save = () => {
    if (!f.company?.trim()) { toast.error('Enter the company name'); return; }
    if (f.radius_m < 30 || f.radius_m > 2000) { toast.error('Radius must be 30–2000 m'); return; }
    saveSettings({ ...f, company: f.company.trim(), anchor, grace_min: Math.max(0, Math.min(120, f.grace_min)), ot_min: Math.max(0, Math.min(240, f.ot_min)) });
    toast.success('Settings saved', 'Workers get them the next time their phone syncs.');
  };

  return (
    <div className="animate-fade-in space-y-4">
      <PageHead title="Settings" right={<Button onClick={save}><Save className="h-4 w-4" />Save</Button>} />

      <Section icon={MapPin} title="Office location">
        <p className="mb-3 text-sm text-slate-500">Drag the pin onto the office (or tap the map). Workers are clocked in when they enter the circle during their clock-in window (from 1 hour before the shift).</p>
        <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />}>
          <MapPicker lat={f.office_lat} lng={f.office_lng} radius={f.radius_m} onChange={(lat, lng) => setF((x) => ({ ...x, office_lat: lat, office_lng: lng }))} />
        </Suspense>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Office name" className="col-span-2"><Input value={f.office_name} onChange={up('office_name')} /></Field>
          <Field label="Circle size (metres)" hint="150 m suits most offices"><Input type="number" value={f.radius_m} onChange={up('radius_m', true)} /></Field>
          <div className="flex items-end"><Button variant="soft" className="w-full" loading={locating} onClick={here}><Crosshair className="h-4 w-4" />I'm at the office</Button></div>
        </div>
        <p className="mt-2 text-xs text-slate-400">{f.office_lat != null ? `${f.office_lat.toFixed(6)}, ${f.office_lng.toFixed(6)}` : 'Not set yet'}</p>
      </Section>

      <Section icon={CalendarClock} title="Rotation">
        <p className="mb-3 text-sm text-slate-500">Everyone works the same 8-day cycle: 2 mornings, 2 afternoons, 2 nights, 2 off. Tell ShiftMark where the cycle is on any one date.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="On this date…"><Input type="date" value={rot.date} onChange={(e) => setRot({ ...rot, date: e.target.value })} /></Field>
          <Field label="…the team is on"><Select value={rot.idx} onChange={(e) => setRot({ ...rot, idx: Number(e.target.value) })}>{CYCLE.map((_, i) => <option key={i} value={i}>{cycleLabel(i)}</option>)}</Select></Field>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {Array.from({ length: 10 }, (_, i) => shiftOn(addDays(td, i), { anchor, shifts: f.shifts })).map((x) => (
            <div key={x.date} className="min-w-[70px] rounded-lg p-2 text-center ring-1 ring-slate-200/70 dark:ring-white/5">
              <p className="text-[10px] text-slate-500">{dayLabel(x.date)}</p>
              <span className="mx-auto mt-1 block h-1.5 w-8 rounded-full" style={{ background: SHIFT_TYPES[x.type].color }} />
              <p className="mt-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">{x.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Clock} title="Shift times & rules">
        <div className="space-y-2">
          {['M', 'A', 'N'].map((t) => (
            <div key={t} className="grid grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: SHIFT_TYPES[t].color }}>{SHIFT_TYPES[t].name}</span>
              <Input type="time" value={f.shifts[t].start} onChange={setTime(t, 'start')} />
              <Input type="time" value={f.shifts[t].end} onChange={setTime(t, 'end')} />
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Late after (minutes)" hint="Grace time after the start"><Input type="number" value={f.grace_min} onChange={up('grace_min', true)} /></Field>
          <Field label="Overtime counts after (min)" hint="Staying later than this past the end"><Input type="number" value={f.ot_min} onChange={up('ot_min', true)} /></Field>
          <Field label="Currency"><Input value={f.currency} onChange={up('currency')} /></Field>
        </div>
      </Section>

      <Section icon={Building2} title="Company">
        <Field label="Company name"><Input value={f.company} onChange={up('company')} /></Field>
        <div className="mt-3"><InviteCard /></div>
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => { if (confirm('Make a new invite code? The old one stops working.')) { newInviteCode(); toast.success('New code made'); } }}><RefreshCw className="h-4 w-4" />New invite code</Button>
      </Section>

      <Button size="lg" className="w-full" onClick={save}><Save className="h-5 w-5" />Save settings</Button>
      <h2 className="pt-2 text-xs font-bold uppercase tracking-wide text-slate-400">This device</h2>
      <GeneralSettings />
    </div>
  );
}
