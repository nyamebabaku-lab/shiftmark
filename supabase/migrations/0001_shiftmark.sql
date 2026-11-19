-- ShiftMark: team attendance with GPS auto clock-in. Everything lives in schema "shiftmark".
create schema if not exists shiftmark;
grant usage on schema shiftmark to anon, authenticated, service_role;

-- One row of company settings.
create table shiftmark.settings (
  id int primary key default 1 check (id = 1),
  company text not null default 'ShiftMark',
  office_name text not null default 'Office',
  office_lat double precision,
  office_lng double precision,
  radius_m int not null default 150 check (radius_m between 30 and 2000),
  anchor date not null default '2026-11-20',          -- a Morning-1 date of the 8-day rotation
  grace_min int not null default 10 check (grace_min between 0 and 120),
  ot_min int not null default 30 check (ot_min between 0 and 240),
  shifts jsonb not null default '{"M":{"start":"06:00","end":"14:00"},"A":{"start":"14:00","end":"22:00"},"N":{"start":"22:00","end":"06:00"}}',
  currency text not null default 'GH₵',
  updated_at timestamptz not null default now()
);

-- Admin-only secrets (the invite code new workers type when they register).
create table shiftmark.secrets (
  id int primary key default 1 check (id = 1),
  invite_code text not null
);

create table shiftmark.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'worker' check (role in ('admin', 'worker')),
  name text not null,
  phone text not null default '',
  staff_no text not null default '',
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  daily_rate numeric(12, 2) not null default 0,
  ot_rate numeric(12, 2) not null default 0,       -- per overtime hour
  start_date date,                                 -- days before this don't count as absent
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Clock-in / clock-out events. Ids are made on the phone so an offline event can be re-sent safely.
create table shiftmark.events (
  id uuid primary key,
  user_id uuid not null references shiftmark.profiles (user_id) on delete cascade,
  kind text not null check (kind in ('in', 'out')),
  at timestamptz not null,
  lat double precision,
  lng double precision,
  accuracy real,
  distance_m real,
  source text not null default 'auto' check (source in ('auto', 'manual', 'admin')),
  simulated boolean not null default false,       -- fake-GPS app detected (Android)
  note text not null default '',
  voided boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_user_at on shiftmark.events (user_id, at);
create index events_updated on shiftmark.events (updated_at);

-- Admin notes on a day: leave, sick, permission, public holiday, confirmed absence.
create table shiftmark.marks (
  user_id uuid not null references shiftmark.profiles (user_id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('leave', 'sick', 'excused', 'holiday', 'absent')),
  paid boolean not null default false,
  note text not null default '',
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ------------------------------------------------------------------ helpers
create or replace function shiftmark.is_admin() returns boolean
language sql stable security definer set search_path = shiftmark, pg_temp as $$
  select exists (select 1 from shiftmark.profiles where user_id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function shiftmark.is_active() returns boolean
language sql stable security definer set search_path = shiftmark, pg_temp as $$
  select exists (select 1 from shiftmark.profiles where user_id = auth.uid() and status = 'active');
$$;

create or replace function shiftmark.touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger t_settings before update on shiftmark.settings for each row execute function shiftmark.touch();
create trigger t_profiles before update on shiftmark.profiles for each row execute function shiftmark.touch();
create trigger t_events before update on shiftmark.events for each row execute function shiftmark.touch();
create trigger t_marks before insert or update on shiftmark.marks for each row execute function shiftmark.touch();

-- Workers may only add their own events, as themselves, not in the future, never pre-voided.
create or replace function shiftmark.check_event() returns trigger
language plpgsql security definer set search_path = shiftmark, pg_temp as $$
begin
  if shiftmark.is_admin() then
    if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
    return new;
  end if;
  if auth.uid() is null then return new; end if;  -- service role / SQL editor
  if new.user_id <> auth.uid() then raise exception 'You can only clock yourself in or out'; end if;
  if new.source not in ('auto', 'manual') then raise exception 'Not allowed'; end if;
  if new.at > now() + interval '10 minutes' then raise exception 'That time is in the future — check the phone''s clock'; end if;
  new.created_by := auth.uid();
  new.voided := false;
  new.created_at := now();
  return new;
end $$;
create trigger t_events_check before insert on shiftmark.events for each row execute function shiftmark.check_event();

-- ------------------------------------------------------------------ row-level security
alter table shiftmark.settings enable row level security;
alter table shiftmark.secrets enable row level security;
alter table shiftmark.profiles enable row level security;
alter table shiftmark.events enable row level security;
alter table shiftmark.marks enable row level security;

create policy settings_read on shiftmark.settings for select to authenticated using (true);
create policy settings_admin on shiftmark.settings for update to authenticated using (shiftmark.is_admin()) with check (shiftmark.is_admin());

create policy secrets_admin on shiftmark.secrets for all to authenticated using (shiftmark.is_admin()) with check (shiftmark.is_admin());

create policy profiles_read on shiftmark.profiles for select to authenticated using (user_id = auth.uid() or shiftmark.is_admin());
create policy profiles_admin on shiftmark.profiles for update to authenticated using (shiftmark.is_admin()) with check (shiftmark.is_admin());
create policy profiles_admin_del on shiftmark.profiles for delete to authenticated using (shiftmark.is_admin() and user_id <> auth.uid());

create policy events_read on shiftmark.events for select to authenticated using (user_id = auth.uid() or shiftmark.is_admin());
create policy events_add on shiftmark.events for insert to authenticated
  with check ((user_id = auth.uid() and shiftmark.is_active()) or shiftmark.is_admin());
create policy events_admin on shiftmark.events for update to authenticated using (shiftmark.is_admin()) with check (shiftmark.is_admin());

create policy marks_read on shiftmark.marks for select to authenticated using (user_id = auth.uid() or shiftmark.is_admin());
create policy marks_admin on shiftmark.marks for all to authenticated using (shiftmark.is_admin()) with check (shiftmark.is_admin());

grant select, update on shiftmark.settings to authenticated;
grant select, insert, update, delete on shiftmark.secrets to authenticated;
grant select, update, delete on shiftmark.profiles to authenticated;
grant select, insert, update on shiftmark.events to authenticated;
grant select, insert, update, delete on shiftmark.marks to authenticated;

-- Admins must not be able to lock themselves out.
create or replace function shiftmark.guard_profile() returns trigger
language plpgsql security definer set search_path = shiftmark, pg_temp as $$
begin
  if auth.uid() is not null and new.user_id = auth.uid() and (new.role <> 'admin' or new.status <> 'active') then
    raise exception 'You can''t remove your own admin access';
  end if;
  return new;
end $$;
create trigger t_profiles_guard before update on shiftmark.profiles for each row execute function shiftmark.guard_profile();

-- ------------------------------------------------------------------ account functions
create or replace function shiftmark.admin_exists() returns boolean
language sql stable security definer set search_path = shiftmark, pg_temp as $$
  select exists (select 1 from shiftmark.profiles where role = 'admin');
$$;

-- The very first admin sets the company up (only works while there is no admin).
create or replace function shiftmark.claim_admin(p_name text, p_phone text, p_company text default null) returns void
language plpgsql security definer set search_path = shiftmark, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  perform pg_advisory_xact_lock(hashtext('shiftmark.claim_admin'));
  if exists (select 1 from shiftmark.profiles where role = 'admin') then raise exception 'An admin already exists — ask them to add you'; end if;
  insert into shiftmark.profiles (user_id, role, name, phone, status) values (auth.uid(), 'admin', trim(p_name), coalesce(p_phone, ''), 'active')
    on conflict (user_id) do update set role = 'admin', status = 'active', name = excluded.name;
  insert into shiftmark.settings (id, company) values (1, coalesce(nullif(trim(p_company), ''), 'ShiftMark'))
    on conflict (id) do update set company = coalesce(nullif(trim(p_company), ''), shiftmark.settings.company);
  insert into shiftmark.secrets (id, invite_code) values (1, upper(substr(md5(random()::text), 1, 6))) on conflict (id) do nothing;
end $$;

-- A worker joins with the company invite code; an admin then approves them.
create or replace function shiftmark.register_worker(p_name text, p_phone text, p_code text) returns void
language plpgsql security definer set search_path = shiftmark, pg_temp as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select invite_code into v_code from shiftmark.secrets where id = 1;
  if v_code is null then raise exception 'This company isn''t set up yet — the admin must sign in first'; end if;
  if upper(trim(p_code)) <> upper(v_code) then raise exception 'Wrong invite code — ask your admin for it'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Enter your full name'; end if;
  insert into shiftmark.profiles (user_id, role, name, phone, status) values (auth.uid(), 'worker', trim(p_name), coalesce(p_phone, ''), 'pending')
    on conflict (user_id) do nothing;
end $$;

revoke all on function shiftmark.claim_admin(text, text, text) from public, anon;
revoke all on function shiftmark.register_worker(text, text, text) from public, anon;
grant execute on function shiftmark.admin_exists() to anon, authenticated;
grant execute on function shiftmark.claim_admin(text, text, text) to authenticated;
grant execute on function shiftmark.register_worker(text, text, text) to authenticated;
grant execute on function shiftmark.is_admin() to authenticated;
grant execute on function shiftmark.is_active() to authenticated;

insert into shiftmark.settings (id) values (1) on conflict do nothing;
