import { useState } from 'react';
import { MapPin, BatteryCharging, Bell, ShieldCheck, LogOut, KeyRound, Moon, RefreshCw, Smartphone, Info } from 'lucide-react';
import { useStore, setPrefs, signOut, sync, api } from '../../data/store';
import { Card, PageHead, Toggle, Button, Avatar, Modal, Field, Input } from '../../components/ui';
import { openLocationSettings } from '../../native/tracker';
import { IS_NATIVE, PLATFORM, DEMO } from '../../config';
import { ago, money } from '../../lib/format';
import { toast } from '../../components/toast';
import { friendly } from '../../lib/supabase';

export function ChangePassword({ open, onClose }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Change password" footer={<Button className="flex-1" loading={busy} onClick={async () => {
      if (pw.length < 6) { toast.error('At least 6 characters'); return; }
      setBusy(true);
      try { await api.changePassword(pw); toast.success('Password changed'); onClose(); } catch (e) { toast.error('Could not change it', friendly(e)); } finally { setBusy(false); }
    }}>Save</Button>}>
      <Field label="New password"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
    </Modal>
  );
}

export function GeneralSettings() {
  const prefs = useStore((s) => s.prefs);
  const outbox = useStore((s) => s.outbox.length);
  const lastSync = useStore((s) => s.lastSync);
  const syncing = useStore((s) => s.syncing);
  const syncError = useStore((s) => s.syncError);
  const [pwOpen, setPwOpen] = useState(false);
  return (
    <>
      <Card className="divide-y divide-slate-100 px-4 dark:divide-white/5">
        <Toggle checked={prefs.dark ?? false} onChange={(v) => setPrefs({ dark: v })} label={<span className="inline-flex items-center gap-2"><Moon className="h-4 w-4" />Dark mode</span>} />
        <button onClick={sync} className="flex w-full items-center justify-between py-3 text-left">
          <span><span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />Sync now</span><span className="block text-xs text-slate-500">Last synced {ago(lastSync)}{outbox ? ` · ${outbox} change(s) waiting` : ''}</span>{syncError && <span className="block text-xs text-rose-600">{syncError}</span>}</span>
        </button>
        {!DEMO && <button onClick={() => setPwOpen(true)} className="flex w-full items-center gap-2 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100"><KeyRound className="h-4 w-4" />Change password</button>}
        <button onClick={async () => { if (outbox && !confirm(`${outbox} change(s) haven't reached the server yet. Sign out anyway? They will be lost.`)) return; await signOut(); }} className="flex w-full items-center gap-2 py-3 text-sm font-semibold text-rose-600"><LogOut className="h-4 w-4" />Sign out</button>
      </Card>
      <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  );
}

const Step = ({ icon: Icon, title, children, action }) => (
  <div className="flex gap-3 py-3">
    <span className="h-fit rounded-xl bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"><Icon className="h-5 w-5" /></span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      <div className="text-xs leading-relaxed text-slate-500">{children}</div>
      {action}
    </div>
  </div>
);

export default function WorkerMe() {
  const me = useStore((s) => s.me);
  const settings = useStore((s) => s.settings);
  const prefs = useStore((s) => s.prefs);
  const geo = useStore((s) => s.geo);
  const cur = settings?.currency || 'GH₵';
  return (
    <div className="animate-fade-in space-y-4">
      <PageHead title="Me" />
      <Card className="flex items-center gap-3 p-4">
        <Avatar name={me.name} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="font-bold text-slate-900 dark:text-white">{me.name}</p>
          <p className="text-xs text-slate-500">{me.phone}{me.staff_no ? ` · ${me.staff_no}` : ''} · {settings?.company}</p>
          <p className="text-xs text-slate-500">Daily rate {money(me.daily_rate, cur)} · overtime {money(me.ot_rate, cur)}/h</p>
        </div>
      </Card>

      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Automatic clock-in</h2>
      <Card className="divide-y divide-slate-100 px-4 dark:divide-white/5">
        <Toggle checked={prefs.autoTrack} onChange={(v) => setPrefs({ autoTrack: v })} label="Clock me in at the office" sub={geo.tracking ? 'On — watching for the office' : geo.error || 'Off'} />
        <Toggle checked={prefs.reminders} onChange={(v) => setPrefs({ reminders: v })} label="Shift reminders" sub="A notification 30 minutes before each shift" />
      </Card>

      <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Smartphone className="h-3.5 w-3.5" />Phone setup (do this once)</h2>
      <Card className="divide-y divide-slate-100 px-4 dark:divide-white/5">
        {PLATFORM === 'android' && (
          <>
            <Step icon={MapPin} title="1. Location: “Allow all the time”" action={<Button size="sm" variant="soft" className="mt-2" onClick={openLocationSettings}>Open app settings</Button>}>
              Permissions → Location → <b>Allow all the time</b>, and switch on <b>Use precise location</b>. “Only while using the app” is not enough — ShiftMark must see you arrive while the phone is in your pocket.
            </Step>
            <Step icon={BatteryCharging} title="2. Battery: Unrestricted" action={<Button size="sm" variant="soft" className="mt-2" onClick={openLocationSettings}>Open app settings</Button>}>
              App battery usage → <b>Unrestricted</b> (Samsung: also remove ShiftMark from “Sleeping apps”; Tecno/Infinix/itel: Phone Master → Auto-start → allow ShiftMark).
            </Step>
            <Step icon={Bell} title="3. Notifications: allow">
              Keep the small “ShiftMark is on” notification — Android needs it to watch your location. Don't swipe ShiftMark away from recent apps.
            </Step>
          </>
        )}
        {PLATFORM === 'ios' && (
          <Step icon={MapPin} title="Location: “Always”">Settings → ShiftMark → Location → <b>Always</b> and <b>Precise Location</b> on.</Step>
        )}
        {!IS_NATIVE && (
          <>
            <Step icon={Info} title="You're using the web version">
              Browsers (including iPhone Safari) can only check your location <b>while ShiftMark is open on screen</b>. Open it when you arrive, or use the <b>Clock in</b> button. On Android, install the ShiftMark app for fully automatic clock-in.
            </Step>
            <Step icon={MapPin} title="Allow location">When the browser asks, choose <b>Allow</b>. On iPhone: Settings → Safari → Location → Allow.</Step>
            <Step icon={Smartphone} title="Add to Home Screen">iPhone: Safari → Share → <b>Add to Home Screen</b>. It then opens like an app and works offline.</Step>
          </>
        )}
        <Step icon={ShieldCheck} title="Your privacy">ShiftMark only sends your company the time and place of each clock-in and clock-out — never where you go the rest of the day.</Step>
      </Card>

      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">App</h2>
      <GeneralSettings />
      <p className="pb-4 text-center text-[11px] text-slate-400">ShiftMark 1.0 · {settings?.office_name}</p>
    </div>
  );
}
