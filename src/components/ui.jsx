import { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useToasts } from './toast';
import { STATUS } from '../lib/attendance';
import { SHIFT_TYPES } from '../lib/shifts';
import { initials } from '../lib/format';

const cx = (...a) => a.filter(Boolean).join(' ');
export { cx };

export function Button({ variant = 'primary', size = 'md', className, loading, children, ...p }) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
    dark: 'bg-ink-900 text-white hover:bg-ink-800 dark:bg-white dark:text-ink-900',
    soft: 'bg-brand-50 text-brand-800 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  }[variant];
  const s = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-sm', lg: 'h-14 px-6 text-base' }[size];
  return (
    <button className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-50 disabled:pointer-events-none', v, s, className)} disabled={loading || p.disabled} {...p}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export const Card = ({ className, children, ...p }) => (
  <div className={cx('rounded-2xl border border-slate-200/70 bg-white shadow-soft dark:border-white/5 dark:bg-ink-900', className)} {...p}>{children}</div>
);

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}
export const inputCls = 'w-full min-w-0 h-11 rounded-xl border border-slate-200 bg-white px-3 text-[15px] text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:border-white/10 dark:bg-ink-950 dark:text-white';
export const Input = ({ className, ...p }) => <input className={cx(inputCls, className)} {...p} />;
export const Select = ({ className, children, ...p }) => <select className={cx(inputCls, 'pr-8', className)} {...p}>{children}</select>;

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className={cx('max-h-[92vh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-slide-up sm:rounded-3xl sm:animate-fade-in dark:bg-ink-900 flex flex-col', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex gap-2 border-t border-slate-100 px-5 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] dark:border-white/5">{footer}</div>}
      </div>
    </div>
  );
}

export function Toasts() {
  const list = useToasts((s) => s.list);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 pt-[max(.75rem,env(safe-area-inset-top))]">
      {list.map((t) => {
        const Icon = t.kind === 'error' ? AlertTriangle : t.kind === 'info' ? Info : CheckCircle2;
        const c = t.kind === 'error' ? 'text-rose-500' : t.kind === 'info' ? 'text-sky-500' : 'text-emerald-500';
        return (
          <div key={t.id} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-white p-3.5 shadow-xl ring-1 ring-black/5 animate-fade-in dark:bg-ink-800 dark:ring-white/10">
            <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', c)} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.title}</p>
              {t.body && <p className="text-xs text-slate-500 dark:text-slate-400">{t.body}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const StatusPill = ({ status, className }) => {
  const s = STATUS[status] || STATUS.off;
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', s.cls, className)}>{s.label}</span>;
};
export const ShiftPill = ({ type, label, className }) => (
  <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', SHIFT_TYPES[type].bg, className)}>{label || SHIFT_TYPES[type].name}</span>
);

export const Avatar = ({ name, className }) => (
  <span className={cx('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-500 text-sm font-bold text-white', className)}>{initials(name)}</span>
);

export function Stat({ label, value, sub, icon: Icon, tone = 'brand' }) {
  const t = { brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300', green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        {Icon && <span className={cx('rounded-lg p-1.5', t)}><Icon className="h-4 w-4" /></span>}
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
    </Card>
  );
}

export const Empty = ({ icon: Icon, title, children }) => (
  <div className="flex flex-col items-center px-6 py-12 text-center">
    {Icon && <Icon className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />}
    <p className="font-semibold text-slate-700 dark:text-slate-200">{title}</p>
    {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
  </div>
);

export function PageHead({ title, sub, right }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {sub && <p className="text-sm text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Toggle({ checked, onChange, label, sub }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 py-3 text-left">
      <span>
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        {sub && <span className="block text-xs text-slate-500">{sub}</span>}
      </span>
      <span className={cx('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  );
}

export function MonthSwitch({ year, month, onChange }) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const go = (n) => { const d = new Date(year, month - 1 + n, 1); onChange(d.getFullYear(), d.getMonth() + 1); };
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-ink-900">
      <button className="px-3 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-white" onClick={() => go(-1)} aria-label="Previous month">‹</button>
      <span className="min-w-[84px] text-center text-sm font-semibold text-slate-800 dark:text-slate-100">{MONTHS[month - 1]} {year}</span>
      <button className="px-3 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-white" onClick={() => go(1)} aria-label="Next month">›</button>
    </div>
  );
}
