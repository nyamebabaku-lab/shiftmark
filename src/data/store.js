// App state, saved on the phone (IndexedDB) so everything works offline.
// Every change is applied here first, queued in `outbox`, and sent to the server when there's internet.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../lib/idbStorage';
import { DEMO, STORE_KEY } from '../config';
import { live } from './live';
import { demo } from './demo';
import { isNetwork, friendly } from '../lib/supabase';
import { uid } from '../lib/format';

export const api = DEMO ? demo : live;

const empty = () => ({ session: null, me: null, settings: null, profiles: [], events: [], marks: [], inviteCode: '', outbox: [], lastSync: null });

export const useStore = create(
  persist(
    () => ({
      ...empty(),
      hydrated: false,
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
      syncing: false,
      syncError: '',
      // GPS watcher state (not saved).
      geo: { inside: null, outsideCount: 0, pendingOutAt: null, distance: null, accuracy: null, lastFix: null, tracking: false, error: '' },
      prefs: { autoTrack: true, reminders: true, dark: null },
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ session: s.session, me: s.me, settings: s.settings, profiles: s.profiles, events: s.events, marks: s.marks, inviteCode: s.inviteCode, outbox: s.outbox, lastSync: s.lastSync, prefs: s.prefs }),
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);
const set = (p) => useStore.setState(p);
const get = () => useStore.getState();

// ------------------------------------------------------------------ sync
let flushing = null;
/** Sends queued changes in order. Stops at the first "no internet". */
export async function flush() {
  if (flushing) return flushing;
  flushing = (async () => {
    while (get().outbox.length) {
      const op = get().outbox[0];
      try {
        await api.push(op);
        if (op.t === 'event') set({ events: get().events.map((e) => (e.id === op.row.id ? { ...e, pending: false } : e)) });
        set({ outbox: get().outbox.slice(1), syncError: '' });
      } catch (e) {
        if (isNetwork(e)) { set({ online: false }); break; }
        // The server refused it (e.g. permission): drop it so the queue doesn't jam.
        set({ outbox: get().outbox.slice(1), syncError: friendly(e) });
        if (op.t === 'event') set({ events: get().events.map((x) => (x.id === op.row.id ? { ...x, pending: false, rejected: friendly(e) } : x)) });
      }
    }
  })();
  try { await flushing; } finally { flushing = null; }
}

/** Push queued changes, then pull the latest from the server. */
export async function sync() {
  const s = get();
  if (!s.session || s.syncing) return;
  set({ syncing: true });
  try {
    await flush();
    const data = await api.fetch(s.session.userId);
    set({ online: true });
    if (!data.me) { set({ me: null, syncing: false }); return; }
    // Keep events that are still waiting to be sent.
    const waiting = get().events.filter((e) => e.pending);
    const ids = new Set(data.events.map((e) => e.id));
    set({
      me: data.me,
      settings: data.settings || get().settings,
      profiles: data.profiles,
      events: [...data.events, ...waiting.filter((e) => !ids.has(e.id))].sort((a, b) => a.at.localeCompare(b.at)),
      marks: data.marks,
      inviteCode: data.inviteCode ?? '',
      lastSync: new Date().toISOString(),
      syncError: '',
    });
  } catch (e) {
    if (isNetwork(e)) set({ online: false }); else set({ syncError: friendly(e) });
  } finally {
    set({ syncing: false });
  }
}

function queue(op) {
  set({ outbox: [...get().outbox, op] });
  flush();
}

// ------------------------------------------------------------------ actions
/** Records a clock-in / clock-out for the signed-in worker (or, for admins, `userId`). */
export function addEvent({ kind, at = Date.now(), source = 'manual', reading = null, distance = null, note = '', userId = null }) {
  const me = get().me;
  const row = {
    id: uid(), user_id: userId || me.user_id, kind, at: new Date(at).toISOString(), source, note,
    lat: reading?.lat ?? null, lng: reading?.lng ?? null, accuracy: reading?.accuracy ?? null,
    distance_m: distance != null ? Math.round(distance) : null, simulated: !!reading?.simulated, voided: false,
    created_at: new Date().toISOString(), pending: true,
  };
  set({ events: [...get().events, row].sort((a, b) => a.at.localeCompare(b.at)) });
  queue({ t: 'event', row });
  return row;
}

export function voidEvent(id, voided = true, note) {
  const patch = { voided, ...(note != null ? { note } : {}) };
  set({ events: get().events.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  queue({ t: 'eventUpdate', id, patch });
}

export function updateProfile(id, patch) {
  set({ profiles: get().profiles.map((p) => (p.user_id === id ? { ...p, ...patch } : p)), ...(get().me?.user_id === id ? { me: { ...get().me, ...patch } } : {}) });
  queue({ t: 'profile', id, patch });
}

export function removeProfile(id) {
  set({ profiles: get().profiles.filter((p) => p.user_id !== id), events: get().events.filter((e) => e.user_id !== id) });
  queue({ t: 'profileDel', id });
}

export function saveSettings(patch) {
  set({ settings: { ...get().settings, ...patch } });
  queue({ t: 'settings', patch });
}

export function setMark(row) {
  const r = { paid: false, note: '', ...row, updated_at: new Date().toISOString() };
  set({ marks: [...get().marks.filter((m) => !(m.user_id === r.user_id && m.day === r.day)), r] });
  queue({ t: 'mark', row: { user_id: r.user_id, day: r.day, kind: r.kind, paid: r.paid, note: r.note } });
}

export function clearMark(user_id, day) {
  set({ marks: get().marks.filter((m) => !(m.user_id === user_id && m.day === day)) });
  queue({ t: 'markDel', user_id, day });
}

export function newInviteCode() {
  const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
  set({ inviteCode: code });
  queue({ t: 'invite', code });
}

export const setPrefs = (p) => set({ prefs: { ...get().prefs, ...p } });
export const setGeo = (p) => set({ geo: { ...get().geo, ...p } });

// ------------------------------------------------------------------ account
export async function signedIn(session) {
  set({ ...empty(), session });
  await sync();
}

export async function signOut() {
  if (get().outbox.length) await flush();
  try { await api.signOut(); } catch { /* offline: still sign out here */ }
  set({ ...empty() });
}

// ------------------------------------------------------------------ selectors (pure helpers, never inside useStore)
/** Latest non-voided event for a user. */
export function lastEvent(events, userId) {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.user_id === userId && !e.voided) return e;
  }
  return null;
}
/** Clocked in = last event is an "in" from the last 16 hours. */
export function isClockedIn(events, userId, now = Date.now()) {
  const e = lastEvent(events, userId);
  return !!e && e.kind === 'in' && now - new Date(e.at).getTime() < 16 * 3600000;
}
