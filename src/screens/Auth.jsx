import { useEffect, useState } from 'react';
import { Fingerprint, UserPlus, Building2, Clock3, RefreshCw, LogOut, ShieldCheck, HardHat } from 'lucide-react';
import { Button, Field, Input, Card } from '../components/ui';
import { toast } from '../components/toast';
import { api, signedIn, signOut, sync, useStore } from '../data/store';
import { DEMO, APP_ROLE, APK_URL, IS_NATIVE } from '../config';
import { friendly } from '../lib/supabase';
import { phoneOk } from '../lib/format';
import { DEMO_ADMIN, DEMO_WORKER, resetDemo } from '../data/demo';
import Logo from '../components/Logo';

function Shell({ children, title, sub }) {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-[max(3rem,env(safe-area-inset-top))]">
        <div className="mb-8 flex items-center gap-3">
          <Logo className="h-11 w-11" />
          <div>
            <p className="text-xl font-extrabold tracking-tight">ShiftMark{APP_ROLE === 'admin' ? ' Admin' : ''}</p>
            <p className="text-xs text-brand-200/80">Attendance that marks itself</p>
          </div>
        </div>
        {title && <h1 className="text-2xl font-bold">{title}</h1>}
        {sub && <p className="mb-6 mt-1 text-sm text-slate-400">{sub}</p>}
        {children}
      </div>
    </div>
  );
}
const dark = '!border-white/10 !bg-white/5 !text-white placeholder:text-slate-500';
const Lbl = ({ children }) => <span className="text-slate-300">{children}</span>;

export default function Auth() {
  const [mode, setMode] = useState(APP_ROLE === 'admin' ? 'signin' : 'signin');
  const [adminExists, setAdminExists] = useState(true);
  useEffect(() => { if (!DEMO) api.adminExists().then(setAdminExists).catch(() => {}); }, []);
  if (DEMO) return <DemoStart />;
  if (mode === 'register') return <Register back={() => setMode('signin')} />;
  if (mode === 'setup') return <SetupCompany back={() => setMode('signin')} />;
  return (
    <Shell title="Welcome back" sub="Sign in with your phone number.">
      <SignIn />
      <div className="mt-6 space-y-3">
        {APP_ROLE !== 'admin' && (
          <button onClick={() => setMode('register')} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10">
            <UserPlus className="h-5 w-5 text-brand-300" />
            <span><span className="block text-sm font-semibold">New worker? Create your account</span><span className="block text-xs text-slate-400">You need the invite code from your admin.</span></span>
          </button>
        )}
        {!adminExists && APP_ROLE !== 'worker' && (
          <button onClick={() => setMode('setup')} className="flex w-full items-center gap-3 rounded-2xl border border-brand-400/30 bg-brand-500/10 p-4 text-left hover:bg-brand-500/20">
            <Building2 className="h-5 w-5 text-brand-300" />
            <span><span className="block text-sm font-semibold">First time? Set up your company</span><span className="block text-xs text-slate-400">Creates the admin account. Only possible once.</span></span>
          </button>
        )}
      </div>
    </Shell>
  );
}

function SignIn() {
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    if (!phoneOk(phone)) { toast.error('Enter your phone number'); return; }
    setBusy(true);
    try { await signedIn(await api.signIn(phone, pw)); } catch (err) { toast.error('Could not sign in', friendly(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={go} className="space-y-4">
      <Field label={<Lbl>Phone number</Lbl>}><Input className={dark} inputMode="tel" autoComplete="tel" placeholder="024 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      <Field label={<Lbl>Password</Lbl>}><Input className={dark} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      <Button size="lg" className="w-full" loading={busy}><Fingerprint className="h-5 w-5" />Sign in</Button>
    </form>
  );
}

function Register({ back }) {
  const [f, setF] = useState({ name: '', phone: '', pw: '', code: '' });
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const go = async (e) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return toast.error('Enter your full name');
    if (!phoneOk(f.phone)) return toast.error('Enter your phone number');
    if (f.pw.length < 6) return toast.error('Password must be at least 6 characters');
    if (!f.code.trim()) return toast.error('Enter the invite code from your admin');
    setBusy(true);
    try {
      const s = await api.signUp(f.phone, f.pw);
      await api.registerWorker(f.name.trim(), f.phone.trim(), f.code.trim());
      await signedIn(s);
      toast.success('Account created', 'Your admin must approve you before you can clock in.');
    } catch (err) { toast.error('Could not create the account', friendly(err)); } finally { setBusy(false); }
    return null;
  };
  return (
    <Shell title="Create your account" sub="Ask your admin for the company invite code.">
      <form onSubmit={go} className="space-y-4">
        <Field label={<Lbl>Full name</Lbl>}><Input className={dark} value={f.name} onChange={up('name')} autoComplete="name" /></Field>
        <Field label={<Lbl>Phone number</Lbl>}><Input className={dark} inputMode="tel" value={f.phone} onChange={up('phone')} placeholder="024 123 4567" /></Field>
        <Field label={<Lbl>Choose a password</Lbl>}><Input className={dark} type="password" value={f.pw} onChange={up('pw')} autoComplete="new-password" /></Field>
        <Field label={<Lbl>Invite code</Lbl>}><Input className={`${dark} uppercase tracking-widest`} value={f.code} onChange={up('code')} placeholder="ABC123" /></Field>
        <Button size="lg" className="w-full" loading={busy}>Create account</Button>
        <Button type="button" variant="ghost" className="w-full !text-slate-300" onClick={back}>Back to sign in</Button>
      </form>
    </Shell>
  );
}

function SetupCompany({ back }) {
  const [f, setF] = useState({ company: '', name: '', phone: '', pw: '' });
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const go = async (e) => {
    e.preventDefault();
    if (!f.company.trim()) return toast.error('Enter the company name');
    if (f.name.trim().length < 2) return toast.error('Enter your full name');
    if (!phoneOk(f.phone)) return toast.error('Enter your phone number');
    if (f.pw.length < 6) return toast.error('Password must be at least 6 characters');
    setBusy(true);
    try {
      let s;
      try { s = await api.signUp(f.phone, f.pw); } catch (err) { if (/already/i.test(err.message)) s = await api.signIn(f.phone, f.pw); else throw err; }
      await api.claimAdmin(f.name.trim(), f.phone.trim(), f.company.trim());
      await signedIn(s);
      toast.success('Company set up', 'Next: set the office location in Settings.');
    } catch (err) { toast.error('Could not set up', friendly(err)); } finally { setBusy(false); }
    return null;
  };
  return (
    <Shell title="Set up your company" sub="You'll be the admin. Workers join later with an invite code.">
      <form onSubmit={go} className="space-y-4">
        <Field label={<Lbl>Company name</Lbl>}><Input className={dark} value={f.company} onChange={up('company')} /></Field>
        <Field label={<Lbl>Your full name</Lbl>}><Input className={dark} value={f.name} onChange={up('name')} /></Field>
        <Field label={<Lbl>Your phone number</Lbl>}><Input className={dark} inputMode="tel" value={f.phone} onChange={up('phone')} /></Field>
        <Field label={<Lbl>Password</Lbl>}><Input className={dark} type="password" value={f.pw} onChange={up('pw')} autoComplete="new-password" /></Field>
        <Button size="lg" className="w-full" loading={busy}><ShieldCheck className="h-5 w-5" />Create admin account</Button>
        <Button type="button" variant="ghost" className="w-full !text-slate-300" onClick={back}>Back</Button>
      </form>
    </Shell>
  );
}

function DemoStart() {
  const [busy, setBusy] = useState('');
  const open = async (id, phone) => {
    setBusy(id);
    try { await signedIn({ ...(await api.signIn(phone)), userId: id }); } catch (e) { toast.error('Could not open', friendly(e)); } finally { setBusy(''); }
  };
  return (
    <Shell title="Try ShiftMark" sub="A demo with a sample team and a month of attendance. Nothing you do here is real or saved online.">
      <div className="space-y-3">
        {APP_ROLE !== 'admin' && (
          <button disabled={!!busy} onClick={() => open(DEMO_WORKER, '0244000001')} className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-left hover:bg-white/10">
            <span className="rounded-xl bg-brand-500/20 p-3"><HardHat className="h-6 w-6 text-brand-300" /></span>
            <span><span className="block font-semibold">Open as a worker</span><span className="block text-xs text-slate-400">Kofi — auto clock-in, hours, calendar, pay</span></span>
          </button>
        )}
        {APP_ROLE !== 'worker' && (
          <button disabled={!!busy} onClick={() => open(DEMO_ADMIN, '0200000000')} className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-left hover:bg-white/10">
            <span className="rounded-xl bg-indigo-500/20 p-3"><ShieldCheck className="h-6 w-6 text-indigo-300" /></span>
            <span><span className="block font-semibold">Open as the admin</span><span className="block text-xs text-slate-400">Ama — who's in, team, reports, office location</span></span>
          </button>
        )}
        <button className="w-full pt-4 text-center text-xs text-slate-500 underline" onClick={async () => { await resetDemo(); toast.success('Demo data reset'); }}>Reset demo data</button>
        {!IS_NATIVE && <p className="pt-2 text-center text-xs text-slate-500">Android app: <a className="text-brand-300 underline" href={APK_URL}>download</a></p>}
      </div>
    </Shell>
  );
}

/** Signed in but no ShiftMark profile yet (e.g. signed up, then the app closed). */
export function NoProfile() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Shell title="Finish joining" sub="Enter your name and your company's invite code.">
      <div className="space-y-4">
        <Field label={<Lbl>Full name</Lbl>}><Input className={dark} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={<Lbl>Invite code</Lbl>}><Input className={`${dark} uppercase tracking-widest`} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Button size="lg" className="w-full" loading={busy} onClick={async () => {
          setBusy(true);
          try { await api.registerWorker(name.trim(), '', code.trim()); await sync(); } catch (e) { toast.error('Could not join', friendly(e)); } finally { setBusy(false); }
        }}>Join</Button>
        <Button variant="ghost" className="w-full !text-slate-300" onClick={signOut}><LogOut className="h-4 w-4" />Sign out</Button>
      </div>
    </Shell>
  );
}

export function Waiting() {
  const me = useStore((s) => s.me);
  const syncing = useStore((s) => s.syncing);
  const disabled = me.status === 'disabled';
  return (
    <Shell>
      <Card className="!border-white/10 !bg-white/5 p-6 text-center">
        <Clock3 className="mx-auto h-12 w-12 text-brand-300" />
        <h1 className="mt-3 text-xl font-bold text-white">{disabled ? 'Your account is switched off' : `Hi ${me.name.split(' ')[0]}, you're almost in`}</h1>
        <p className="mt-2 text-sm text-slate-400">{disabled ? 'Speak to your admin if you think this is a mistake.' : 'Your admin needs to approve your account. Once they do, ShiftMark will start marking your attendance.'}</p>
        <Button className="mt-5 w-full" loading={syncing} onClick={sync}><RefreshCw className="h-4 w-4" />Check again</Button>
      </Card>
      <Button variant="ghost" className="mt-4 w-full !text-slate-300" onClick={signOut}><LogOut className="h-4 w-4" />Sign out</Button>
    </Shell>
  );
}

export function WrongApp() {
  const me = useStore((s) => s.me);
  return (
    <Shell title={me.role === 'admin' ? 'This is the worker app' : 'This is the admin app'} sub={me.role === 'admin' ? 'Admins use the ShiftMark Admin app (or the website).' : 'Workers use the ShiftMark app to clock in.'}>
      <Button variant="outline" className="w-full" onClick={signOut}><LogOut className="h-4 w-4" />Sign out</Button>
    </Shell>
  );
}
