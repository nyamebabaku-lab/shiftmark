// Watches the phone's location and clocks the worker in/out at the office.
// Android/iOS app: background watcher (keeps working with the screen off, shows a small notification).
// Browser (incl. iPhone web app): only while the app is open.
import { registerPlugin } from '@capacitor/core';
import { IS_NATIVE } from '../config';
import { useStore, addEvent, setGeo, isClockedIn, lastEvent } from '../data/store';
import { decide } from '../lib/geo';
import { shiftOn, addDays, ymd, SHIFT_TYPES } from '../lib/shifts';
import { hm } from '../lib/format';
import { toast } from '../components/toast';

const BackgroundGeolocation = IS_NATIVE ? registerPlugin('BackgroundGeolocation') : null;
let watcherId = null;
let webWatch = null;

async function notify(title, body, id = Math.floor(Math.random() * 100000) + 1) {
  if (!IS_NATIVE) { toast.success(title, body); return; }
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({ notifications: [{ id, title, body }] });
  } catch { /* notifications blocked */ }
}

function onReading(reading) {
  const s = useStore.getState();
  if (!s.me || s.me.status !== 'active' || !s.settings) return;
  const userId = s.me.user_id;
  const last = lastEvent(s.events, userId);
  const state = {
    inside: s.geo.inside,
    outsideCount: s.geo.outsideCount,
    pendingOutAt: s.geo.pendingOutAt,
    clockedIn: isClockedIn(s.events, userId, reading.time),
    lastOutAt: last?.kind === 'out' ? new Date(last.at).getTime() : null,
  };
  const r = decide(state, reading, s.settings);
  setGeo({
    inside: r.state.inside, outsideCount: r.state.outsideCount, pendingOutAt: r.state.pendingOutAt,
    distance: r.distance ?? s.geo.distance, accuracy: reading.accuracy, lastFix: reading.time, error: r.ignored === 'inaccurate' ? 'Weak GPS signal' : '',
  });
  if (!r.action) return;
  addEvent({ kind: r.action.kind, at: r.action.at, source: 'auto', reading, distance: r.distance });
  if (r.action.kind === 'in') {
    const sh = shiftOn(r.action.shift, s.settings);
    const late = r.action.at > sh.start.getTime() + (s.settings.grace_min ?? 10) * 60000;
    notify(`Clocked in ${hm(r.action.at)}`, `${sh.label} shift (${sh.startText}–${sh.endText})${late ? ' — marked late' : ''}. Have a good shift!`);
  } else {
    notify(`Clocked out ${hm(r.action.at)}`, 'You left the office. Your hours are saved.');
  }
  if (reading.simulated) toast.error('Fake GPS detected', 'Your admin will see this clock event was flagged.');
}

export async function startTracking() {
  if (watcherId || webWatch != null) return true;
  if (IS_NATIVE) {
    try {
      watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: 'ShiftMark is on',
          backgroundMessage: 'Clocks you in automatically when you reach the office.',
          requestPermissions: true,
          stale: false,
          distanceFilter: 20,
        },
        (loc, err) => {
          if (err) {
            setGeo({ error: err.code === 'NOT_AUTHORIZED' ? 'Location permission is off' : err.message, tracking: false });
            if (err.code === 'NOT_AUTHORIZED') stopTracking();
            return;
          }
          if (loc) onReading({ lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy, time: loc.time || Date.now(), simulated: !!loc.simulated });
        },
      );
      setGeo({ tracking: true, error: '' });
      return true;
    } catch (e) {
      setGeo({ tracking: false, error: e.message || 'Could not start location' });
      return false;
    }
  }
  if (!navigator.geolocation) { setGeo({ error: 'This browser has no GPS access', tracking: false }); return false; }
  webWatch = navigator.geolocation.watchPosition(
    (p) => onReading({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, time: p.timestamp || Date.now(), simulated: false }),
    (e) => setGeo({ error: e.code === 1 ? 'Location permission is off' : 'Waiting for GPS…', tracking: e.code !== 1 }),
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 },
  );
  setGeo({ tracking: true, error: '' });
  return true;
}

export async function stopTracking() {
  if (watcherId) { try { await BackgroundGeolocation.removeWatcher({ id: watcherId }); } catch { /* gone */ } watcherId = null; }
  if (webWatch != null) { navigator.geolocation.clearWatch(webWatch); webWatch = null; }
  setGeo({ tracking: false });
}

export async function openLocationSettings() {
  if (IS_NATIVE) { try { await BackgroundGeolocation.openSettings(); } catch { /* ignore */ } }
}

/** Demo / test only: pretend the phone is at (or away from) the office. */
export function simulateReading(atOffice) {
  const s = useStore.getState().settings;
  const off = atOffice ? 0 : 0.01;
  onReading({ lat: s.office_lat + off, lng: s.office_lng, accuracy: 15, time: Date.now(), simulated: false });
  if (!atOffice) onReading({ lat: s.office_lat + off, lng: s.office_lng, accuracy: 15, time: Date.now() + 1000, simulated: false });
}

/** Reminders 30 minutes before each of the next shifts (Android/iOS app only). */
export async function scheduleReminders(settings, enabled = true) {
  if (!IS_NATIVE || !settings) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') await LocalNotifications.requestPermissions();
    const ids = Array.from({ length: 16 }, (_, i) => ({ id: 9000 + i }));
    await LocalNotifications.cancel({ notifications: ids });
    if (!enabled) return;
    const list = [];
    const d0 = ymd(new Date());
    for (let i = 0; i < 16; i++) {
      const sh = shiftOn(addDays(d0, i), settings);
      if (sh.type === 'O') continue;
      const when = new Date(sh.start.getTime() - 30 * 60000);
      if (when.getTime() < Date.now()) continue;
      list.push({ id: 9000 + i, title: `${SHIFT_TYPES[sh.type].name} shift in 30 minutes`, body: `${sh.label}: ${sh.startText}–${sh.endText}. ShiftMark will clock you in when you arrive.`, schedule: { at: when, allowWhileIdle: true } });
    }
    if (list.length) await LocalNotifications.schedule({ notifications: list });
  } catch { /* ignore */ }
}
