import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shiftOn, cycleLabel, cycleIndex, currentOrNextShift, anchorFrom } from '../src/lib/shifts.js';
import { dailyRecords, summarize } from '../src/lib/attendance.js';
import { decide, distance } from '../src/lib/geo.js';

const S = { anchor: '2026-11-20', grace_min: 10, ot_min: 30, office_lat: 5.6037, office_lng: -0.187, radius_m: 150 };
const L = (s, hh, mm = 0) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, hh, mm).toISOString(); };

test('rotation matches the user’s calendar', () => {
  const want = { '2026-11-18': 'Off 1', '2026-11-19': 'Off 2', '2026-11-20': 'Morning 1', '2026-11-21': 'Morning 2', '2026-11-22': 'Afternoon 1', '2026-11-23': 'Afternoon 2', '2026-11-24': 'Night 1', '2026-11-25': 'Night 2', '2026-11-26': 'Off 1', '2026-11-27': 'Off 2', '2026-11-28': 'Morning 1', '2026-11-12': 'Morning 1' };
  for (const [d, l] of Object.entries(want)) assert.equal(shiftOn(d, S).label, l, d);
  assert.equal(anchorFrom('2026-11-18', 6), '2026-11-12');
  assert.equal(cycleIndex('2027-03-01', S.anchor), cycleIndex('2027-03-09', S.anchor));
});

test('night shift ends next morning', () => {
  const n = shiftOn('2026-11-24', S);
  assert.equal(n.start.getHours(), 22);
  assert.equal(n.end.getDate(), 25);
  assert.equal(n.end.getHours(), 6);
  const cur = currentOrNextShift(new Date(2026, 10, 25, 3), S);
  assert.equal(cur.date, '2026-11-24');
  assert.ok(cur.live);
  assert.equal(currentOrNextShift(new Date(2026, 10, 18, 12), S).date, '2026-11-20');
});

test('attendance: present, late, overtime, absent, night, off-day extra', () => {
  const ev = (id, kind, at) => ({ id, kind, at });
  const events = [
    ev(1, 'in', L('2026-11-20', 5, 50)), ev(2, 'out', L('2026-11-20', 14, 5)),            // on time
    ev(3, 'in', L('2026-11-21', 6, 25)), ev(4, 'out', L('2026-11-21', 15, 0)),            // late 25, OT 60
    // 22nd afternoon: absent
    ev(5, 'in', L('2026-11-23', 13, 55)), ev(6, 'out', L('2026-11-23', 21, 0)),           // left early
    ev(7, 'in', L('2026-11-24', 21, 58)), ev(8, 'out', L('2026-11-25', 6, 10)),           // night, counts on 24th
    ev(9, 'in', L('2026-11-26', 8, 0)), ev(10, 'out', L('2026-11-26', 17, 0)),            // off day worked: extra, OT 60
  ];
  const recs = dailyRecords({ events, settings: S, from: '2026-11-20', to: '2026-11-27', now: new Date(2026, 10, 28, 12) });
  const by = Object.fromEntries(recs.map((r) => [r.date, r]));
  assert.equal(by['2026-11-20'].status, 'present');
  assert.equal(by['2026-11-20'].otMin, 0);
  assert.equal(by['2026-11-21'].status, 'late');
  assert.equal(by['2026-11-21'].lateMin, 25);
  assert.equal(by['2026-11-21'].otMin, 60);
  assert.equal(by['2026-11-22'].status, 'absent');
  assert.ok(by['2026-11-23'].early);
  assert.equal(by['2026-11-24'].status, 'present');
  assert.equal(by['2026-11-24'].workedMin, 492);
  assert.equal(by['2026-11-25'].status, 'absent');
  assert.equal(by['2026-11-26'].status, 'extra');
  assert.equal(by['2026-11-26'].otMin, 60);
  assert.equal(by['2026-11-27'].status, 'off');
  const s = summarize(recs, { daily_rate: 100, ot_rate: 20 });
  assert.equal(s.worked, 5);
  assert.equal(s.absent, 2);
  assert.equal(s.late, 1);
  assert.equal(s.otMin, 120);
  assert.equal(s.pay, 540);
});

test('missing clock-out closes at shift end; excused marks', () => {
  const events = [{ id: 1, kind: 'in', at: L('2026-11-20', 6, 0) }];
  const marks = [{ day: '2026-11-21', kind: 'sick', paid: true }];
  const recs = dailyRecords({ events, marks, settings: S, from: '2026-11-20', to: '2026-11-21', now: new Date(2026, 10, 22, 12) });
  assert.ok(recs[0].missingOut);
  assert.equal(recs[0].workedMin, 480);
  assert.equal(recs[1].status, 'excused');
  assert.equal(summarize(recs, { daily_rate: 50 }).pay, 100);
});

test('live shift in progress', () => {
  const events = [{ id: 1, kind: 'in', at: L('2026-11-20', 6, 0) }];
  const [r] = dailyRecords({ events, settings: S, from: '2026-11-20', to: '2026-11-20', now: new Date(2026, 10, 20, 9) });
  assert.equal(r.status, 'in');
  assert.equal(r.workedMin, 180);
});

test('geofence: enter clocks in only during the window, leaving needs two readings', () => {
  const office = { lat: S.office_lat, lng: S.office_lng };
  const far = { lat: 5.62, lng: -0.187 };
  assert.ok(distance(office, far) > 1500);
  let st = { inside: null, outsideCount: 0, clockedIn: false, lastInAt: null, lastOutAt: null };
  // Off day at office: no clock-in.
  let r = decide(st, { ...office, accuracy: 20, time: new Date(2026, 10, 19, 9).getTime() }, S);
  assert.equal(r.action, null);
  st = { ...r.state, inside: false };
  // 05:20 on a morning day: window open (from 05:00).
  r = decide(st, { ...office, accuracy: 20, time: new Date(2026, 10, 20, 5, 20).getTime() }, S);
  assert.equal(r.action.kind, 'in');
  st = r.state;
  r = decide(st, { ...office, accuracy: 300, time: new Date(2026, 10, 20, 9).getTime() }, S);
  assert.equal(r.ignored, 'inaccurate');
  r = decide(st, { ...far, accuracy: 20, time: new Date(2026, 10, 20, 14, 3).getTime() }, S);
  assert.equal(r.action, null);
  r = decide(r.state, { ...far, accuracy: 20, time: new Date(2026, 10, 20, 14, 6).getTime() }, S);
  assert.equal(r.action.kind, 'out');
  assert.equal(r.action.at, new Date(2026, 10, 20, 14, 3).getTime());
  // Night shift: clock-in window opens at 21:00.
  st = r.state;
  r = decide(st, { ...office, accuracy: 20, time: new Date(2026, 10, 24, 20, 30).getTime() }, S);
  assert.equal(r.action, null);
  r = decide(r.state, { ...office, accuracy: 20, time: new Date(2026, 10, 24, 21, 5).getTime() }, S);
  assert.equal(r.action.kind, 'in');
});
