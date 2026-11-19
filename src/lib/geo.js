// Geofence maths and the auto clock-in / clock-out decision (pure, so it can be tested).
import { shiftOn, addDays, ymd } from './shifts.js';

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
/** Distance in metres between two points. */
export function distance(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const MIN = 60000;
/** Auto clock-in is allowed from 60 min before a shift starts until 30 min before it ends. */
export const OPEN_BEFORE = 60 * MIN;
export const CLOSE_BEFORE_END = 30 * MIN;
/** Extra distance past the circle before you count as having left (stops GPS jitter flipping in/out). */
export const EXIT_MARGIN = 50;
/** Readings worse than this are ignored. */
export const MAX_ACCURACY = 120;

/** The scheduled shift whose clock-in window contains `now`, or null. */
export function clockInWindow(now, settings) {
  const d = ymd(new Date(now));
  for (const day of [addDays(d, -1), d]) {
    const s = shiftOn(day, settings);
    if (s.type === 'O') continue;
    if (now >= s.start.getTime() - OPEN_BEFORE && now < s.end.getTime() - CLOSE_BEFORE_END) return s;
  }
  return null;
}

/**
 * Decide what to do with a new GPS reading.
 * state: { inside: true|false|null, outsideCount, clockedIn, lastInAt (ms|null), lastOutAt (ms|null), pendingOutAt }
 * reading: { lat, lng, accuracy, time (ms), simulated }
 * Returns { state, action: null | { kind: 'in'|'out', at, shift? }, distance, ignored }
 */
export function decide(state, reading, settings) {
  const office = { lat: settings.office_lat, lng: settings.office_lng };
  const radius = settings.radius_m || 150;
  if (office.lat == null || office.lng == null) return { state, action: null, ignored: 'no-office' };
  const now = reading.time ?? Date.now();
  const d = distance(office, reading);
  if (reading.accuracy != null && reading.accuracy > Math.max(MAX_ACCURACY, radius)) {
    return { state, action: null, distance: d, ignored: 'inaccurate' };
  }
  const next = { ...state };
  let action = null;

  if (d <= radius) {
    const entered = state.inside !== true;
    next.inside = true;
    next.outsideCount = 0;
    next.pendingOutAt = null;
    if (!state.clockedIn) {
      const shift = clockInWindow(now, settings);
      // Walk in during the window, or already here when the window opens (once per shift, so a manual
      // clock-out at the office isn't undone straight away).
      const outThisShift = shift && state.lastOutAt != null && state.lastOutAt >= shift.start.getTime() - OPEN_BEFORE;
      if (shift && (entered || !outThisShift)) {
        action = { kind: 'in', at: now, shift: shift.date };
      }
    }
  } else if (d > radius + EXIT_MARGIN) {
    next.outsideCount = (state.outsideCount || 0) + 1;
    if (next.outsideCount === 1) next.pendingOutAt = now;
    // Two readings outside in a row before we believe you left.
    if (next.outsideCount >= 2 || state.inside === null) {
      next.inside = false;
      if (state.clockedIn) action = { kind: 'out', at: next.pendingOutAt ?? now };
      next.pendingOutAt = null;
    }
  }
  if (action?.kind === 'in') { next.clockedIn = true; next.lastInAt = action.at; }
  if (action?.kind === 'out') { next.clockedIn = false; next.lastOutAt = action.at; }
  return { state: next, action, distance: d };
}
