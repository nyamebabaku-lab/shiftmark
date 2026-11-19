import { NavLink, Outlet } from 'react-router-dom';
import { CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useStore, sync } from '../data/store';
import { DEMO } from '../config';
import { ago } from '../lib/format';
import Logo from './Logo';
import { cx } from './ui';

export function SyncBadge() {
  const online = useStore((s) => s.online);
  const syncing = useStore((s) => s.syncing);
  const outbox = useStore((s) => s.outbox.length);
  const lastSync = useStore((s) => s.lastSync);
  const label = syncing ? 'Syncing…' : !online ? `Offline${outbox ? ` · ${outbox} to send` : ''}` : outbox ? `${outbox} to send` : `Synced ${ago(lastSync)}`;
  const Icon = syncing ? RefreshCw : !online ? CloudOff : CheckCircle2;
  return (
    <button onClick={sync} className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', !online ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300')} title="Sync now">
      <Icon className={cx('h-3.5 w-3.5', syncing && 'animate-spin')} />{label}
    </button>
  );
}

/** Bottom tabs on phones, a sidebar on wide screens. */
export default function Layout({ nav, title }) {
  const company = useStore((s) => s.settings?.company);
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-950">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200/70 bg-white p-4 md:flex dark:border-white/5 dark:bg-ink-900">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <Logo className="h-9 w-9" />
          <div className="min-w-0"><p className="font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</p><p className="truncate text-xs text-slate-500">{company}</p></div>
        </div>
        <nav className="space-y-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5')}>
              <n.icon className="h-5 w-5" />{n.label}{n.badge ? <span className="ml-auto rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{n.badge}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2"><SyncBadge /></div>
      </aside>
      {DEMO && <div className="bg-indigo-600 py-1 text-center text-[11px] font-semibold text-white md:ml-60">Demo — sample data only</div>}
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:ml-60 md:px-8 md:pb-10 md:pt-8">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-white/5 dark:bg-ink-900/95">
        <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold', isActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500')}>
              <n.icon className="h-5 w-5" />{n.label}
              {n.badge ? <span className="absolute right-[calc(50%-18px)] top-1.5 h-2 w-2 rounded-full bg-rose-500" /> : null}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
