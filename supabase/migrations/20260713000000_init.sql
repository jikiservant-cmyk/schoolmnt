-- ============================================================
-- SCHOOL ATTENDANCE SYSTEM — FULL SCHEMA (v3)
-- Multi-tenant, ZKTeco device + manual teacher entry
-- v3 changes: academic_years, dedup people/staff_users,
-- notification recipient resolution, device health, jsonb payload
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. SCHOOLS
-- ============================================================
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  attendance_mode text not null check (attendance_mode in ('device', 'manual', 'both')) default 'manual',
  timezone text not null default 'Africa/Kampala', -- used to correctly bucket "today" per school, not server UTC
  settings jsonb not null default '{}'::jsonb, -- e.g. {"late_after": "07:45", "send_sms_on_present": true}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table schools is 'Each row = one school (tenant).';

-- ============================================================
-- 1b. AUTO-UPDATE updated_at ON CHANGE
-- ============================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_schools_updated_at before update on schools
  for each row execute function set_updated_at();

-- (people trigger added after that table is created below)

-- ============================================================
-- 2. ACADEMIC_YEARS (terms, not just calendar years)
-- ============================================================
create table academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null, -- e.g. "2026 Term 1", "2026"
  starts_at date,
  ends_at date,
  is_current boolean default false,
  created_at timestamptz default now(),

  unique (school_id, name)
);

comment on table academic_years is 'Lets classes/reports reference "2026 Term 1" etc. instead of raw text. Only one row per school should have is_current = true — enforce in application code or a partial unique index if you want it DB-enforced.';

-- optional: enforce only one current year per school at the DB level
create unique index idx_one_current_year_per_school
  on academic_years(school_id)
  where is_current = true;

-- ============================================================
-- 3. CLASSES
-- ============================================================
create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id),
  name text not null, -- e.g. "P.5" — rename once here, not per-student
  teacher_id uuid, -- FK added after `people` exists below (the form/class teacher)
  created_at timestamptz default now(),

  unique (school_id, name, academic_year_id)
);

comment on table classes is 'Classes are scoped per academic year, so promoting students to a new year just means new class rows, not overwriting old ones.';

-- ============================================================
-- 4. DEVICES
-- ============================================================
create table devices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  serial_number text not null unique,
  label text,
  is_active boolean default true,
  firmware_version text,
  ip_address text,
  last_seen_at timestamptz,
  last_error text,
  created_at timestamptz default now()
);

comment on table devices is 'ZKTeco device registry with basic health fields for support/debugging.';

-- ============================================================
-- 5. PEOPLE (single source of truth for students, teachers, admins)
-- ============================================================
create table people (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,

  device_user_id text, -- ZKTeco enrollment ID; null if manual-only or role = 'admin'
  full_name text not null,
  role text not null check (role in ('student', 'teacher', 'admin')),
  class_id uuid references classes(id), -- current class; null for teachers/admins
  phone text, -- teachers/admins may have their own phone here; students generally won't
  is_active boolean default true,

  -- lightweight "who last touched this" pointer, NOT a full history table.
  -- No inline FK here on purpose: staff_users doesn't exist yet at this point in the
  -- script. FK added via ALTER TABLE further down once staff_users is created.
  created_by uuid,
  updated_by uuid,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (school_id, device_user_id)
);

comment on table people is 'SINGLE SOURCE OF TRUTH for name/phone/role for students, teachers, and admins. staff_users below references this for auth — it does NOT duplicate name/phone.';

create index idx_people_school_class on people(school_id, class_id);
create index idx_people_device_lookup on people(school_id, device_user_id);

-- now wire up classes.teacher_id -> people.id (the class/form teacher)
alter table classes add constraint fk_classes_teacher
  foreign key (teacher_id) references people(id) on delete set null;

create trigger trg_people_updated_at before update on people
  for each row execute function set_updated_at();

comment on column people.created_by is 'FK to staff_users added below, after that table exists.';

-- ============================================================
-- 6. STAFF_USERS (pure authentication — no name/phone duplication)
-- ============================================================
create table staff_users (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references people(id) on delete cascade, -- the ONE source of truth for who this is
  auth_user_id uuid references auth.users(id) on delete set null, -- Supabase Auth login, for admins/dashboard

  staff_role text not null check (staff_role in ('school_admin', 'teacher')), -- permission level, separate from people.role

  manual_link_token text unique,
  manual_link_token_expires_at timestamptz, -- token with no expiry set is treated as INVALID, not "forever" — see fn_validate_manual_link_token
  pin_hash text,
  pin_failed_attempts integer default 0,
  pin_locked_until timestamptz,

  created_at timestamptz default now()
);

comment on table staff_users is 'Pure auth/permissions layer. Name and phone live ONLY in people, via person_id. PIN lockout and manual-link-token expiry are enforced via functions below, not just app code.';

-- ============================================================
-- 6a. PIN LOCKOUT ENFORCEMENT — call fn_check_pin_attempt BEFORE verifying a
-- submitted PIN (raises an exception if locked, using row-level locking to
-- avoid a race between concurrent attempts). Call fn_register_pin_failure
-- after a wrong PIN, fn_register_pin_success after a correct one.
-- ============================================================
create or replace function fn_check_pin_attempt(p_staff_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_locked_until timestamptz;
begin
  select pin_locked_until into v_locked_until
  from staff_users
  where id = p_staff_user_id
  for update; -- lock the row to avoid a race between concurrent attempts

  if v_locked_until is not null and v_locked_until > now() then
    raise exception 'account_locked' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function fn_register_pin_failure(p_staff_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_attempts integer;
begin
  update staff_users
  set pin_failed_attempts = pin_failed_attempts + 1
  where id = p_staff_user_id
  returning pin_failed_attempts into v_attempts;

  if v_attempts >= 5 then
    update staff_users
    set pin_locked_until = now() + interval '15 minutes'
    where id = p_staff_user_id;
  end if;
end;
$$;

create or replace function fn_register_pin_success(p_staff_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update staff_users
  set pin_failed_attempts = 0,
      pin_locked_until = null
  where id = p_staff_user_id;
end;
$$;

-- ============================================================
-- 6b. MANUAL LINK TOKEN EXPIRY — call fn_validate_manual_link_token instead
-- of a raw "where manual_link_token = $1" lookup. Default expiry is 30 days;
-- adjust to match how often your schools actually want to re-issue links
-- (7 days is often too aggressive for a "set once per term" workflow).
-- ============================================================
create or replace function fn_validate_manual_link_token(p_token text)
returns setof staff_users
language sql
security definer
stable
as $$
  select *
  from staff_users
  where manual_link_token = p_token
    and manual_link_token_expires_at is not null
    and manual_link_token_expires_at > now();
$$;

create or replace function fn_issue_manual_link_token(p_staff_user_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_token text;
begin
  v_token := encode(gen_random_bytes(24), 'hex');
  update staff_users
  set manual_link_token = v_token,
      manual_link_token_expires_at = now() + interval '30 days'
  where id = p_staff_user_id;
  return v_token;
end;
$$;

-- now that staff_users exists, wire up people.created_by / updated_by
alter table people add constraint fk_people_created_by
  foreign key (created_by) references staff_users(id) on delete set null;
alter table people add constraint fk_people_updated_by
  foreign key (updated_by) references staff_users(id) on delete set null;

-- ============================================================
-- 6b. TEACHER_CLASSES (junction — a teacher may mark more than one class,
-- common in secondary schools where subject teachers rotate)
-- ============================================================
create table teacher_classes (
  staff_user_id uuid not null references staff_users(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,

  primary key (staff_user_id, class_id)
);

comment on table teacher_classes is 'Which classes a teacher is allowed to mark manual attendance for. Many-to-many: a secondary school teacher may mark several classes.';

-- ============================================================
-- 7. PARENTS
-- ============================================================
create table parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  full_name text,
  phone text not null,
  created_at timestamptz default now(),

  unique (school_id, phone)
);

comment on table parents is 'A parent/guardian, linked to one or more students via student_parents.';

-- ============================================================
-- 8. STUDENT_PARENTS (junction)
-- ============================================================
create table student_parents (
  student_id uuid not null references people(id) on delete cascade,
  parent_id uuid not null references parents(id) on delete cascade,
  relationship text, -- "mother", "father", "guardian"
  is_primary_contact boolean default true,

  primary key (student_id, parent_id)
);

comment on table student_parents is 'Links students to guardians. is_primary_contact decides who gets attendance SMS by default.';

-- ============================================================
-- 9. DEVICE_LOGS (raw, unprocessed pushes — audit trail)
-- ============================================================
create table device_logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references devices(id), -- nullable: unknown serials get logged too
  raw_serial_number text not null,
  device_user_id text,
  event_timestamp timestamptz,
  payload jsonb, -- parsed ADMS key=value body, stored as jsonb for querying (e.g. payload->>'UserID')
  processed boolean default false,
  processed_at timestamptz,
  processing_error text,

  received_at timestamptz default now()
);

comment on table device_logs is 'Every raw device push lands here first, unprocessed. attendance_logs rows are derived from these — your audit trail / replay source.';

create index idx_device_logs_unprocessed on device_logs(processed) where processed = false;

-- Call this in your processing job before writing an attendance_logs row from a
-- device push. device_user_id collisions across schools are a real risk — two
-- different schools' devices can legitimately assign the same small integer ID
-- to different people. This centralizes the check in the DB so it's not
-- reimplemented (or forgotten) in application code.
create or replace function fn_device_belongs_to_school(p_device_id uuid, p_school_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from devices
    where id = p_device_id and school_id = p_school_id
  );
$$;

-- ============================================================
-- 10. ATTENDANCE_LOGS
-- ============================================================
create table attendance_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,

  source text not null check (source in ('device', 'manual')),
  device_id uuid references devices(id),
  device_log_id uuid references device_logs(id),
  marked_by uuid references staff_users(id),

  -- widened beyond present/late/absent — schools will ask for these eventually
  status text not null default 'present'
    check (status in ('present', 'late', 'absent', 'excused', 'sick', 'holiday')),
  attendance_type text not null default 'check_in' check (attendance_type in ('check_in', 'check_out')),

  -- snapshot at insert time — protects historical reports through class promotions
  class_id_at_time uuid references classes(id),
  class_name_at_time text,

  occurred_at timestamptz not null default now(),
  created_at timestamptz default now()
);

comment on table attendance_logs is 'One row per attendance event. class_id_at_time / class_name_at_time are snapshotted so promotions never rewrite past reports.';

create index idx_attendance_school_date on attendance_logs(school_id, occurred_at);
create index idx_attendance_person on attendance_logs(person_id, occurred_at);

-- ============================================================
-- 11. NOTIFICATIONS (decoupled queue, resolved recipient + audit snapshot)
-- ============================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,

  -- resolve phone at send time (avoids stale numbers) ...
  recipient_type text not null check (recipient_type in ('parent', 'teacher', 'staff')),
  recipient_id uuid not null, -- points into parents.id or people.id depending on recipient_type

  -- ... but snapshot what was actually sent to, for support/debugging ("parent says they didn't get it")
  recipient_phone_snapshot text,

  channel text not null default 'sms' check (channel in ('sms', 'whatsapp', 'email')),
  notification_type text not null default 'attendance', -- 'attendance', 'fee_reminder', 'report_card', 'announcement', ...

  related_table text, -- e.g. 'attendance_logs'
  related_id uuid,

  message text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_response text,
  error text,

  retry_count integer not null default 0,
  next_retry_at timestamptz,

  created_at timestamptz default now(),
  sent_at timestamptz
);

comment on table notifications is 'Generic outbound-message queue, reusable beyond attendance (fees, report cards, announcements). recipient_type/recipient_id resolve the phone at send time; recipient_phone_snapshot records what was actually used, for support debugging.';

create index idx_notifications_pending on notifications(status) where status = 'pending';
create index idx_notifications_retry_worker on notifications(status, next_retry_at) where status = 'failed';
create index idx_notifications_school on notifications(school_id, created_at);

-- ============================================================
-- 12. ROW LEVEL SECURITY
-- ============================================================

alter table schools enable row level security;
alter table academic_years enable row level security;
alter table classes enable row level security;
alter table devices enable row level security;
alter table people enable row level security;
alter table staff_users enable row level security;
alter table teacher_classes enable row level security;
alter table parents enable row level security;
alter table student_parents enable row level security;
alter table device_logs enable row level security;
alter table attendance_logs enable row level security;
alter table notifications enable row level security;

-- resolves school_id via staff_users -> people (no duplicated school_id on staff_users)
-- requires people.is_active = true, so a deactivated staff member's lingering
-- Supabase Auth session no longer resolves a valid school_id or passes any RLS check.
create or replace function auth_school_id()
returns uuid
language sql
security definer
stable
as $$
  select p.school_id
  from staff_users su
  join people p on p.id = su.person_id
  where su.auth_user_id = auth.uid()
    and p.is_active = true
  limit 1;
$$;

create or replace function is_school_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from staff_users su
    join people p on p.id = su.person_id
    where su.auth_user_id = auth.uid()
      and su.staff_role = 'school_admin'
      and p.is_active = true
  );
$$;

create policy "staff can view own school" on schools for select using (id = auth_school_id());

create policy "staff can view own school years" on academic_years for select using (school_id = auth_school_id());
create policy "admin can manage own school years" on academic_years for all using (school_id = auth_school_id() and is_school_admin());

create policy "staff can view own school classes" on classes for select using (school_id = auth_school_id());
create policy "admin can manage own school classes" on classes for all using (school_id = auth_school_id() and is_school_admin());

create policy "staff can view own school devices" on devices for select using (school_id = auth_school_id());
create policy "admin can manage own school devices" on devices for all using (school_id = auth_school_id() and is_school_admin());

create policy "staff can view own school people" on people for select using (school_id = auth_school_id());
create policy "staff can manage own school people" on people for all using (school_id = auth_school_id());

create policy "staff can view own school staff_users" on staff_users for select
  using (exists (select 1 from people where people.id = staff_users.person_id and people.school_id = auth_school_id()));
create policy "admin can manage own school staff_users" on staff_users for all
  using (exists (select 1 from people where people.id = staff_users.person_id and people.school_id = auth_school_id()) and is_school_admin());

create policy "staff can view own school teacher_classes" on teacher_classes for select
  using (exists (select 1 from classes where classes.id = teacher_classes.class_id and classes.school_id = auth_school_id()));
create policy "admin can manage own school teacher_classes" on teacher_classes for all
  using (exists (select 1 from classes where classes.id = teacher_classes.class_id and classes.school_id = auth_school_id()) and is_school_admin());

create policy "staff can view own school parents" on parents for select using (school_id = auth_school_id());
create policy "staff can manage own school parents" on parents for all using (school_id = auth_school_id());

create policy "staff can view own school student_parents" on student_parents for select
  using (exists (select 1 from people where people.id = student_parents.student_id and people.school_id = auth_school_id()));
create policy "staff can manage own school student_parents" on student_parents for all
  using (exists (select 1 from people where people.id = student_parents.student_id and people.school_id = auth_school_id()));

create policy "staff can view own school device_logs" on device_logs for select
  using (exists (select 1 from devices where devices.id = device_logs.device_id and devices.school_id = auth_school_id()));

create policy "staff can view own school attendance" on attendance_logs for select using (school_id = auth_school_id());

create policy "staff can view own school notifications" on notifications for select using (school_id = auth_school_id());

create view today_attendance_summary as
select
  attendance_logs.school_id,
  people.role,
  count(*) filter (where attendance_logs.status = 'present') as present_count,
  count(*) as total_marked
from attendance_logs
join people on people.id = attendance_logs.person_id
join schools on schools.id = attendance_logs.school_id
where (attendance_logs.occurred_at at time zone schools.timezone)::date
    = (now() at time zone schools.timezone)::date
group by attendance_logs.school_id, people.role;
