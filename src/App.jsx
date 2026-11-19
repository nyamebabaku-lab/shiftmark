import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home, CalendarDays, Wallet, User, Radio, Users, FileBarChart, Settings } from 'lucide-react';
import { useStore, sync, api, signOut } from './data/store';
import { DEMO, APP_ROLE, IS_NATIVE } from './config';
import { startTracking, stopTracking, scheduleReminders } from './native/tracker';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import { Toasts } from './components/ui';
import Logo from './components/Logo';
import Auth, { NoProfile, Waiting, WrongApp } from './screens/Auth';
import WorkerHome from './screens/worker/Home';
import WorkerCalendar from './screens/worker/Calendar';
import WorkerPay from './screens/worker/Pay';
import WorkerMe from './screens/worker/Me';
import AdminToday from './screens/admin/Today';
import Team, { WorkerDetail } from './screens/admin/Team';
import Reports from './screens/admin/Reports';
import AdminSettings from './screens/admin/Settings';

function Splash() {
  return <div className="flex min-h-screen items-center justify-center bg-ink-950"><Logo className="h-16 w-16 animate-pulse" /></div>;
}

/** Keeps data fresh: on start, when the internet comes back, when the app reopens, and every 2 minutes. */
function useSyncLoop(active) {
  useEffect(() => {
    if (!active) return undefined;
    sync();
    const on = () => { useStore.setState({ online: true }); sync(); };
    const off = () => useStore.setState({ online: false });
    const vis = () => document.visibilityState === 'visible' && sync();
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    document.addEventListener('visibilitychange', vis);
    const t = setInterval(() => document.visibilityState === 'visible' && sync(), 120000);
    let sub;
    if (IS_NATIVE) import('@capacitor/app').then(({ App }) => { sub = App.addListener('appStateChange', (s) => s.isActive && sync()); });
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', vis);
      clearInterval(t);
      sub?.then?.((h) => h.remove());
    };
  }, [active]);
}

/** Runs the GPS watcher whenever an active worker has auto clock-in on and the office is set. */
function useTracker(me, settings, prefs) {
  const want = !!me && me.role === 'worker' && me.status === 'active' && prefs.autoTrack && settings?.office_lat != null;
  useEffect(() => {
    if (want) startTracking(); else stopTracking();
  }, [want]);
  const key = settings ? `${settings.anchor}|${JSON.stringify(settings.shifts)}` : '';
  useEffect(() => {
    if (me?.role === 'worker' && me.status === 'active' && settings) scheduleReminders(settings, prefs.reminders);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, prefs.reminders, me?.status]);
}

const WORKER_NAV = [
  { to: '/', end: true, icon: Home, label: 'Today' },
  { to: '/calendar', icon: CalendarDays, label: 'Shifts' },
  { to: '/pay', icon: Wallet, label: 'Pay' },
  { to: '/me', icon: User, label: 'Me' },
];

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const session = useStore((s) => s.session);
  const me = useStore((s) => s.me);
  const settings = useStore((s) => s.settings);
  const prefs = useStore((s) => s.prefs);
  const lastSync = useStore((s) => s.lastSync);
  const pending = useStore((s) => s.profiles.filter((p) => p.status === 'pending').length);

  // Restore the server session (demo: in memory; live: Supabase keeps its own).
  useEffect(() => {
    if (!hydrated || !session) return;
    if (DEMO) api.restore(session.userId);
    else supabase?.auth.getSession().then(({ data }) => { if (!data.session) signOut(); });
  }, [hydrated, session]);
  useEffect(() => {
    const dark = prefs.dark ?? false;
    document.documentElement.classList.toggle('dark', dark);
    if (IS_NATIVE) import('@capacitor/status-bar').then(({ StatusBar }) => StatusBar.setBackgroundColor({ color: dark || !me ? '#0a1020' : '#f8fafc' }).catch(() => {}));
  }, [prefs.dark, me]);
  useSyncLoop(hydrated && !!session);
  useTracker(me, settings, prefs);

  let body;
  if (!hydrated) body = <Splash />;
  else if (!session) body = <Auth />;
  else if (!me) body = lastSync ? <NoProfile /> : <Splash />;
  else if (me.status !== 'active') body = <Waiting />;
  else if (APP_ROLE && APP_ROLE !== me.role) body = <WrongApp />;
  else if (me.role === 'admin') {
    const nav = [
      { to: '/', end: true, icon: Radio, label: 'Today' },
      { to: '/team', icon: Users, label: 'Team', badge: pending },
      { to: '/reports', icon: FileBarChart, label: 'Reports' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ];
    body = (
      <Routes>
        <Route element={<Layout nav={nav} title="ShiftMark Admin" />}>
          <Route index element={<AdminToday />} />
          <Route path="team" element={<Team />} />
          <Route path="team/:id" element={<WorkerDetail />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={settings ? <AdminSettings /> : <Splash />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  } else {
    body = (
      <Routes>
        <Route element={<Layout nav={WORKER_NAV} title="ShiftMark" />}>
          <Route index element={<WorkerHome />} />
          <Route path="calendar" element={<WorkerCalendar />} />
          <Route path="pay" element={<WorkerPay />} />
          <Route path="me" element={<WorkerMe />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }
  return (
    <HashRouter>
      {body}
      <Toasts />
    </HashRouter>
  );
}
