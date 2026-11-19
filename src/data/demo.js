// Demo backend: a pretend server kept in this browser, filled with a sample team and a month of attendance.
import { idbStorage } from '../lib/idbStorage';
import { shiftOn, addDays, ymd, DEFAULT_ANCHOR } from '../lib/shifts';

const KEY = 'shiftmark-demodb';
export const DEMO_WORKER = 'demo-w1';
export const DEMO_ADMIN = 'demo-a1';
export const DEMO_OFFICE = { lat: 5.56005, lng: -0.19695 };

let db = null;
let rnd = 7;
const rand = () => { rnd = (rnd * 16807) % 2147483647; return (rnd - 1) / 2147483646; };
const between = (a, b) => a + Math.round(rand() * (b - a));
const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

function seed() {
  rnd = 7;
  const now = Date.now();
  const iso = (t) => new Date(t).toISOString();
  const people = [
    { user_id: DEMO_ADMIN, role: 'admin', name: 'Ama Mensah', phone: '0200000000', status: 'active', daily_rate: 0, ot_rate: 0 },
    { user_id: DEMO_WORKER, role: 'worker', name: 'Kofi Boateng', phone: '0244000001', staff_no: 'SM-001', status: 'active', daily_rate: 150, ot_rate: 25 },
    { user_id: 'demo-w2', role: 'worker', name: 'Akosua Owusu', phone: '0244000002', staff_no: 'SM-002', status: 'active', daily_rate: 150, ot_rate: 25 },
    { user_id: 'demo-w3', role: 'worker', name: 'Yaw Asante', phone: '0244000003', staff_no: 'SM-003', status: 'active', daily_rate: 130, ot_rate: 20 },
    { user_id: 'demo-w4', role: 'worker', name: 'Efua Darko', phone: '0244000004', staff_no: 'SM-004', status: 'active', daily_rate: 130, ot_rate: 20 },
    { user_id: 'demo-w5', role: 'worker', name: 'Kwame Nyarko', phone: '0244000005', staff_no: '', status: 'pending', daily_rate: 0, ot_rate: 0 },
  ].map((p) => ({ staff_no: '', start_date: addDays(ymd(new Date()), -45), created_at: iso(now - 50 * 86400000), ...p }));
  const settings = {
    id: 1, company: 'Demo Company Ltd', office_name: 'Head office, Ridge', office_lat: DEMO_OFFICE.lat, office_lng: DEMO_OFFICE.lng,
    radius_m: 150, anchor: DEFAULT_ANCHOR, grace_min: 10, ot_min: 30, currency: 'GH₵',
    shifts: { M: { start: '06:00', end: '14:00' }, A: { start: '14:00', end: '22:00' }, N: { start: '22:00', end: '06:00' } },
  };
  const events = [];
  const marks = [];
  const MIN = 60000;
  const ev = (user, kind, t, source = 'auto') => events.push({
    id: id(), user_id: user, kind, at: iso(t), source, lat: DEMO_OFFICE.lat + (rand() - 0.5) * 0.0008, lng: DEMO_OFFICE.lng + (rand() - 0.5) * 0.0008,
    accuracy: between(6, 30), distance_m: between(5, 60), simulated: false, note: '', voided: false, created_at: iso(t), updated_at: iso(t),
  });
  const workers = people.filter((p) => p.role === 'worker' && p.status === 'active');
  const td = ymd(new Date());
  for (let d = addDays(td, -40); d <= td; d = addDays(d, 1)) {
    const s = shiftOn(d, settings);
    if (s.type === 'O') continue;
    const st = s.start.getTime();
    const en = s.end.getTime();
    if (st > now) continue;
    for (const w of workers) {
      const r = rand();
      if (r < 0.06) { if (rand() < 0.4) marks.push({ user_id: w.user_id, day: d, kind: 'sick', paid: true, note: 'Hospital card', updated_at: iso(st) }); continue; }
      const late = r < 0.2;
      const arrive = st + (late ? between(12, 45) : between(-25, 6)) * MIN;
      if (arrive > now) continue;
      ev(w.user_id, 'in', arrive, rand() < 0.08 ? 'manual' : 'auto');
      const ot = rand() < 0.12 ? between(40, 120) : between(-4, 12);
      const leave = en + ot * MIN;
      if (leave < now) ev(w.user_id, 'out', leave);
    }
  }
  return { profiles: people, settings, events, marks, inviteCode: 'DEMO24' };
}

async function load() {
  if (db) return db;
  try { const raw = await idbStorage.getItem(KEY); db = raw ? JSON.parse(raw) : null; } catch { db = null; }
  if (!db) { db = seed(); await save(); }
  return db;
}
const save = () => idbStorage.setItem(KEY, JSON.stringify(db));
export async function resetDemo() { db = seed(); await save(); }

let current = null;
export const demo = {
  async session() { return current ? { userId: current } : null; },
  async signIn(phone) {
    await load();
    const digits = String(phone).replace(/\D/g, '').slice(-9);
    const p = db.profiles.find((x) => x.phone.replace(/\D/g, '').slice(-9) === digits);
    if (!p) throw new Error('No demo account with that phone. Use the “Try as worker / admin” buttons.');
    current = p.user_id;
    return { userId: current };
  },
  async signUp(phone) { current = `demo-${String(phone).replace(/\D/g, '')}`; return { userId: current }; },
  async signOut() { current = null; },
  async restore(userId) { current = userId; },
  async adminExists() { return true; },
  async claimAdmin() { throw new Error('The demo already has an admin.'); },
  async registerWorker(name, phone, code) {
    await load();
    if (String(code).toUpperCase() !== db.inviteCode) throw new Error('Wrong invite code — in the demo it is DEMO24');
    db.profiles.push({ user_id: current, role: 'worker', name, phone, staff_no: '', status: 'pending', daily_rate: 0, ot_rate: 0, start_date: null, created_at: new Date().toISOString() });
    await save();
  },
  async changePassword() {},
  async fetch(userId) {
    await load();
    const me = db.profiles.find((p) => p.user_id === userId) || null;
    if (!me) return { me: null };
    const admin = me.role === 'admin';
    return {
      me,
      settings: db.settings,
      profiles: admin ? db.profiles : [me],
      events: admin ? db.events : db.events.filter((e) => e.user_id === userId),
      marks: admin ? db.marks : db.marks.filter((m) => m.user_id === userId),
      inviteCode: admin ? db.inviteCode : '',
    };
  },
  async push(op) {
    await load();
    const now = new Date().toISOString();
    switch (op.t) {
      case 'event': { const row = { ...op.row }; delete row.pending; if (!db.events.some((e) => e.id === row.id)) db.events.push({ ...row, created_at: now, updated_at: now }); break; }
      case 'eventUpdate': db.events = db.events.map((e) => (e.id === op.id ? { ...e, ...op.patch, updated_at: now } : e)); break;
      case 'profile': db.profiles = db.profiles.map((p) => (p.user_id === op.id ? { ...p, ...op.patch } : p)); break;
      case 'profileDel': db.profiles = db.profiles.filter((p) => p.user_id !== op.id); break;
      case 'settings': db.settings = { ...db.settings, ...op.patch }; break;
      case 'mark': db.marks = [...db.marks.filter((m) => !(m.user_id === op.row.user_id && m.day === op.row.day)), op.row]; break;
      case 'markDel': db.marks = db.marks.filter((m) => !(m.user_id === op.user_id && m.day === op.day)); break;
      case 'invite': db.inviteCode = op.code; break;
      default: throw new Error(`Unknown change ${op.t}`);
    }
    await save();
  },
};
