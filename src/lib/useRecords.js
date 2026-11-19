import { useMemo, useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { dailyRecords, summarize } from './attendance';
import { monthRange, today } from './shifts';

/** Re-renders every `ms` so live clocks and statuses stay fresh. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/** Daily records + totals for one worker over a date range. */
export function useRecords(userId, from, to, now) {
  const events = useStore((s) => s.events);
  const marks = useStore((s) => s.marks);
  const settings = useStore((s) => s.settings);
  const profiles = useStore((s) => s.profiles);
  const me = useStore((s) => s.me);
  return useMemo(() => {
    const profile = (me?.user_id === userId ? me : profiles.find((p) => p.user_id === userId)) || {};
    const recs = settings && userId ? dailyRecords({
      events: events.filter((e) => e.user_id === userId),
      marks: marks.filter((m) => m.user_id === userId),
      settings, from, to, now, since: profile.start_date || null,
    }) : [];
    return { records: recs, summary: summarize(recs.filter((r) => r.date <= today(now)), profile), profile };
  }, [events, marks, settings, profiles, me, userId, from, to, now]);
}

export function useMonth(userId, year, month, now) {
  const [from, to] = monthRange(year, month);
  return useRecords(userId, from, to, now);
}

/** Records for every worker for a range: [{ profile, records, summary }]. */
export function useTeam(from, to, now) {
  const events = useStore((s) => s.events);
  const marks = useStore((s) => s.marks);
  const settings = useStore((s) => s.settings);
  const profiles = useStore((s) => s.profiles);
  return useMemo(() => {
    if (!settings) return [];
    const byUser = {};
    events.forEach((e) => { (byUser[e.user_id] ||= []).push(e); });
    return profiles.filter((p) => p.role === 'worker' && p.status === 'active').map((p) => {
      const recs = dailyRecords({ events: byUser[p.user_id] || [], marks: marks.filter((m) => m.user_id === p.user_id), settings, from, to, now, since: p.start_date || null });
      return { profile: p, records: recs, summary: summarize(recs.filter((r) => r.date <= today(now)), p) };
    });
  }, [events, marks, settings, profiles, from, to, now]);
}
