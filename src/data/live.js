// Live backend: Supabase (schema "shiftmark"). Same shape as demo.js.
import { supabase } from '../lib/supabase';
import { PHONE_DOMAIN } from '../config';

export const phoneEmail = (phone) => `0${String(phone).replace(/\D/g, '').slice(-9)}@${PHONE_DOMAIN}`;

async function must(p) {
  const { data, error } = await p;
  if (error) throw error;
  return data;
}
async function all(query) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = await must(query().range(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export const live = {
  async session() {
    const { data } = await supabase.auth.getSession();
    return data.session ? { userId: data.session.user.id } : null;
  },
  async signIn(phone, password) {
    const r = await must(supabase.auth.signInWithPassword({ email: phoneEmail(phone), password }));
    return { userId: r.user.id };
  },
  async signUp(phone, password) {
    const r = await must(supabase.auth.signUp({ email: phoneEmail(phone), password }));
    if (!r.session) throw new Error('Account made, but sign-in needs email confirmation switched off in Supabase.');
    return { userId: r.user.id };
  },
  async signOut() { await supabase.auth.signOut(); },
  adminExists: () => must(supabase.rpc('admin_exists')),
  claimAdmin: (name, phone, company) => must(supabase.rpc('claim_admin', { p_name: name, p_phone: phone, p_company: company })),
  registerWorker: (name, phone, code) => must(supabase.rpc('register_worker', { p_name: name, p_phone: phone, p_code: code })),
  async changePassword(pw) { await must(supabase.auth.updateUser({ password: pw })); },

  /** Everything this account may see. Workers: themselves; admins: the whole team. */
  async fetch(userId) {
    const me = (await must(supabase.from('profiles').select('*').eq('user_id', userId)))[0] || null;
    if (!me) return { me: null };
    const since = new Date(Date.now() - 400 * 86400000).toISOString();
    const admin = me.role === 'admin' && me.status === 'active';
    const [settings, profiles, events, marks, secrets] = await Promise.all([
      must(supabase.from('settings').select('*').eq('id', 1)),
      admin ? must(supabase.from('profiles').select('*').order('name')) : Promise.resolve([me]),
      all(() => supabase.from('events').select('*').gte('at', since).order('at').order('id')),
      all(() => supabase.from('marks').select('*').order('day').order('user_id')),
      admin ? must(supabase.from('secrets').select('invite_code').eq('id', 1)) : Promise.resolve([]),
    ]);
    return { me, settings: settings[0] || null, profiles, events, marks, inviteCode: secrets[0]?.invite_code || '' };
  },

  /** Sends one queued change. Throws on failure. */
  async push(op) {
    switch (op.t) {
      case 'event': {
        const row = { ...op.row };
        delete row.pending;
        delete row.rejected;
        return must(supabase.from('events').upsert(row, { onConflict: 'id', ignoreDuplicates: true }));
      }
      case 'eventUpdate': return must(supabase.from('events').update(op.patch).eq('id', op.id));
      case 'profile': return must(supabase.from('profiles').update(op.patch).eq('user_id', op.id));
      case 'profileDel': return must(supabase.from('profiles').delete().eq('user_id', op.id));
      case 'settings': return must(supabase.from('settings').update(op.patch).eq('id', 1));
      case 'mark': return must(supabase.from('marks').upsert(op.row, { onConflict: 'user_id,day' }));
      case 'markDel': return must(supabase.from('marks').delete().eq('user_id', op.user_id).eq('day', op.day));
      case 'invite': return must(supabase.from('secrets').update({ invite_code: op.code }).eq('id', 1));
      default: throw new Error(`Unknown change ${op.t}`);
    }
  },
};
