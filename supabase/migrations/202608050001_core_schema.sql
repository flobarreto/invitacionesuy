-- Invitia platform v2: tenant-safe core schema.
--
-- This migration is intentionally additive. The legacy `admin` and `tags`
-- tables remain available while reads and writes move to the v2 model.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Keep the existing bcrypt-backed administrator table as the credential
-- source. New installations get the same shape as existing deployments.
create table if not exists public.admin (
  id uuid primary key default gen_random_uuid(),
  legacy_id text,
  username text not null unique,
  password text not null,
  table_name text,
  event_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin add column if not exists legacy_id text;

-- The production legacy schema used integer administrator IDs. Convert them
-- deterministically before creating UUID foreign keys, while retaining the
-- original identifier for audit/reconciliation purposes.
do $$
declare
  admin_id_type text;
begin
  select type.typname into admin_id_type
  from pg_catalog.pg_attribute attribute
  join pg_catalog.pg_class relation on relation.oid = attribute.attrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  join pg_catalog.pg_type type on type.oid = attribute.atttypid
  where namespace.nspname = 'public'
    and relation.relname = 'admin'
    and attribute.attname = 'id'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if admin_id_type in ('int2', 'int4', 'int8') then
    update public.admin
    set legacy_id = id::text
    where legacy_id is null;

    alter table public.admin alter column id drop identity if exists;
    alter table public.admin alter column id drop default;
    alter table public.admin alter column id type uuid
      using md5('invitia:legacy:admin:' || id::text)::uuid;
    alter table public.admin alter column id set default gen_random_uuid();
  elsif admin_id_type <> 'uuid' then
    raise exception 'Unsupported public.admin.id type: %', admin_id_type
      using errcode = '42804';
  end if;
end;
$$;

alter table public.admin add column if not exists event_name text;
alter table public.admin add column if not exists created_at timestamptz default now();
alter table public.admin add column if not exists updated_at timestamptz default now();

create unique index if not exists admin_username_unique_idx
  on public.admin (username);

drop trigger if exists admin_set_updated_at on public.admin;
create trigger admin_set_updated_at
before update on public.admin
for each row execute function public.set_updated_at();

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  event_at timestamptz,
  timezone text not null default 'America/Montevideo',
  rsvp_status text not null default 'open'
    check (rsvp_status in ('scheduled', 'open', 'closed')),
  rsvp_opens_at timestamptz,
  rsvp_deadline timestamptz,
  reminder_enabled boolean not null default true,
  reminder_days_before smallint not null default 14
    check (reminder_days_before between 0 and 365),
  reminder_time time without time zone not null default time '18:00',
  table_notice_enabled boolean not null default true,
  table_notice_days_before smallint not null default 1
    check (table_notice_days_before between 0 and 30),
  table_notice_time time without time zone not null default time '18:00',
  table_notice_message text,
  messaging_enabled boolean not null default false,
  legacy_table_name text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_slug_format check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint events_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint events_rsvp_window check (
    rsvp_opens_at is null
    or rsvp_deadline is null
    or rsvp_opens_at <= rsvp_deadline
  )
);

create index if not exists events_event_at_idx on public.events (event_at);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

-- A legacy table name is an authorization boundary: application code uses it
-- as a PostgREST relation after authenticating an administrator. Accept only
-- physical RSVP tables with the exact legacy contract, never canonical or
-- system-owned relations that happen to live in `public`.
create or replace function public.inspect_legacy_rsvp_relation(p_table_name text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  relation_oid oid;
  relation_kind "char";
  missing_columns text[];
  invalid_columns text[];
begin
  if p_table_name is null
     or p_table_name <> btrim(p_table_name)
     or octet_length(p_table_name) not between 1 and 63
     or p_table_name !~ '^[a-z][a-z0-9_]*$' then
    return jsonb_build_object(
      'valid', false,
      'reason', 'invalid_identifier',
      'tableName', p_table_name
    );
  end if;

  if p_table_name = any (array[
       'admin', 'admin_sessions', 'api_rate_limits', 'attendance_history',
       'crm_idempotency_records', 'event_admins', 'event_migration_state',
       'events', 'floor_plan', 'floor_plans', 'floor_plans_legacy_admin',
       'guest_tags', 'guests', 'invitation_groups',
       'legacy_floor_plan_migration_runs',
       'legacy_floor_plan_reconciliation_audit',
       'legacy_floor_plan_source_versions', 'legacy_floor_plan_sources',
       'legacy_migration_audit', 'legacy_row_identities', 'legacy_rsvp_relations',
       'legacy_rsvp_deletion_audit',
       'legacy_rsvp_idempotency_records', 'legacy_rsvp_mapping_reviews',
       'legacy_tag_aliases', 'message_campaign_alerts', 'message_campaigns',
       'message_deliveries', 'phone_suppressions', 'seating_tables',
       'spatial_ref_sys', 'tags',
       'whatsapp_auth_state', 'whatsapp_conversations',
       'whatsapp_inbound_events', 'whatsapp_outbound_jobs',
       'whatsapp_worker_leases'
     ]::text[])
     or p_table_name ~ '^(pg_|sql_|auth_|storage_|realtime_|supabase_|vault_)' then
    return jsonb_build_object(
      'valid', false,
      'reason', 'blocked_relation',
      'tableName', p_table_name
    );
  end if;

  select relation.oid, relation.relkind
  into relation_oid, relation_kind
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = p_table_name;

  if relation_oid is null then
    return jsonb_build_object(
      'valid', false,
      'reason', 'relation_missing',
      'tableName', p_table_name
    );
  end if;
  if relation_kind not in ('r', 'p') then
    return jsonb_build_object(
      'valid', false,
      'reason', 'invalid_relation_kind',
      'tableName', p_table_name
    );
  end if;

  with required(column_name, allowed_types) as (
    values
      ('id', array['uuid', 'text', 'varchar', 'int2', 'int4', 'int8']::text[]),
      ('name', array['text', 'varchar', 'bpchar']::text[]),
      ('attendance', array['text', 'varchar', 'bpchar']::text[]),
      ('created_at', array['timestamptz', 'timestamp']::text[]),
      ('dietary_preferences', array['_text', '_varchar', 'text', 'varchar', 'json', 'jsonb']::text[]),
      ('favorite_song', array['_text', '_varchar', 'text', 'varchar', 'json', 'jsonb']::text[]),
      ('drink', array['_text', '_varchar', 'text', 'varchar', 'json', 'jsonb']::text[]),
      ('table_number', array['text', 'varchar', 'bpchar', 'int2', 'int4', 'int8', 'numeric']::text[]),
      ('tags', array['_uuid', '_text', '_varchar', 'text', 'varchar', 'json', 'jsonb']::text[])
  )
  select array_agg(required.column_name order by required.column_name)
  into missing_columns
  from required
  left join pg_catalog.pg_attribute attribute
    on attribute.attrelid = relation_oid
   and attribute.attname = required.column_name
   and attribute.attnum > 0
   and not attribute.attisdropped
  where attribute.attnum is null;

  if cardinality(missing_columns) > 0 then
    return jsonb_build_object(
      'valid', false,
      'reason', 'missing_required_columns',
      'tableName', p_table_name,
      'missingColumns', to_jsonb(missing_columns)
    );
  end if;

  with required(column_name, allowed_types) as (
    values
      ('id', array['uuid', 'text', 'varchar', 'int2', 'int4', 'int8']::text[]),
      ('name', array['text', 'varchar', 'bpchar']::text[]),
      ('attendance', array['text', 'varchar', 'bpchar']::text[]),
      ('created_at', array['timestamptz', 'timestamp']::text[]),
      ('dietary_preferences', array['_text', '_varchar', 'text', 'varchar', 'json', 'jsonb']::text[]),
      ('favorite_song', array['_text', '_varchar', 'text', 'varchar', 'json', 'jsonb']::text[]),
      ('drink', array['_text', '_varchar', 'text', 'varchar', 'json', 'jsonb']::text[]),
      ('table_number', array['text', 'varchar', 'bpchar', 'int2', 'int4', 'int8', 'numeric']::text[]),
      ('tags', array['_uuid', '_text', '_varchar', 'text', 'varchar', 'json', 'jsonb']::text[])
  )
  select array_agg(
    required.column_name || ':' || column_type.typname
    order by required.column_name
  )
  into invalid_columns
  from required
  join pg_catalog.pg_attribute attribute
    on attribute.attrelid = relation_oid
   and attribute.attname = required.column_name
   and attribute.attnum > 0
   and not attribute.attisdropped
  join pg_catalog.pg_type column_type on column_type.oid = attribute.atttypid
  where column_type.typname <> all(required.allowed_types);

  if cardinality(invalid_columns) > 0 then
    return jsonb_build_object(
      'valid', false,
      'reason', 'invalid_column_types',
      'tableName', p_table_name,
      'invalidColumns', to_jsonb(invalid_columns)
    );
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint primary_key
    join pg_catalog.pg_attribute id_column
      on id_column.attrelid = relation_oid
     and id_column.attname = 'id'
     and id_column.attnum > 0
     and not id_column.attisdropped
    where primary_key.conrelid = relation_oid
      and primary_key.contype = 'p'
      and primary_key.conkey = array[id_column.attnum]::smallint[]
  ) then
    return jsonb_build_object(
      'valid', false,
      'reason', 'id_not_primary_key',
      'tableName', p_table_name
    );
  end if;

  return jsonb_build_object(
    'valid', true,
    'reason', 'ok',
    'tableName', p_table_name,
    'relationOid', relation_oid::text
  );
end;
$$;

create table if not exists public.legacy_rsvp_relations (
  table_name text primary key,
  relation_oid oid not null,
  contract_version smallint not null default 1 check (contract_version = 1),
  source text not null check (
    source in ('admin_backfill', 'event_backfill', 'canonical_seed', 'manual_review')
  ),
  status text not null default 'active'
    check (status in ('active', 'needs_review', 'revoked')),
  details jsonb not null default '{}'::jsonb,
  first_validated_at timestamptz not null default now(),
  last_validated_at timestamptz not null default now(),
  approved_by text
);

alter table public.legacy_rsvp_relations enable row level security;

create or replace function public.authorize_legacy_rsvp_relation(p_table_name text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  relation_inspection jsonb;
  inventory_row public.legacy_rsvp_relations%rowtype;
begin
  relation_inspection := public.inspect_legacy_rsvp_relation(p_table_name);
  if not (relation_inspection ->> 'valid')::boolean then
    return relation_inspection;
  end if;

  select inventory.* into inventory_row
  from public.legacy_rsvp_relations inventory
  where inventory.table_name = p_table_name;
  if not found or inventory_row.status <> 'active' then
    return relation_inspection || jsonb_build_object(
      'valid', false,
      'reason', 'relation_not_registered'
    );
  end if;
  if inventory_row.relation_oid::text is distinct from
     relation_inspection ->> 'relationOid' then
    return relation_inspection || jsonb_build_object(
      'valid', false,
      'reason', 'relation_replaced',
      'registeredRelationOid', inventory_row.relation_oid::text
    );
  end if;

  return relation_inspection || jsonb_build_object(
    'inventorySource', inventory_row.source,
    'contractVersion', inventory_row.contract_version
  );
end;
$$;

create table if not exists public.legacy_rsvp_mapping_reviews (
  id bigint generated by default as identity primary key,
  admin_id uuid references public.admin(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  candidate_table_name text not null,
  source text not null check (
    source in ('admin.username_fallback', 'admin.table_name', 'events.legacy_table_name')
  ),
  reason text not null,
  diagnostics jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text,
  constraint legacy_rsvp_mapping_review_resolution_check check (
    (status = 'pending' and resolved_at is null and resolved_by is null)
    or (
      status <> 'pending'
      and resolved_at is not null
      and nullif(btrim(resolved_by), '') is not null
    )
  )
);

create unique index if not exists legacy_rsvp_mapping_reviews_pending_unique_idx
  on public.legacy_rsvp_mapping_reviews (
    source,
    coalesce(admin_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid),
    candidate_table_name,
    reason
  )
  where status = 'pending';

alter table public.legacy_rsvp_mapping_reviews enable row level security;

revoke all on function public.inspect_legacy_rsvp_relation(text)
  from public, anon, authenticated;
grant execute on function public.inspect_legacy_rsvp_relation(text)
  to service_role;
revoke all on function public.authorize_legacy_rsvp_relation(text)
  from public, anon, authenticated;
grant execute on function public.authorize_legacy_rsvp_relation(text)
  to service_role;

create table if not exists public.event_admins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  admin_id uuid not null references public.admin(id) on delete cascade,
  role text not null default 'couple_admin'
    check (role in ('platform_admin', 'couple_admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, admin_id)
);

create index if not exists event_admins_admin_id_idx
  on public.event_admins (admin_id) where active;

drop trigger if exists event_admins_set_updated_at on public.event_admins;
create trigger event_admins_set_updated_at
before update on public.event_admins
for each row execute function public.set_updated_at();

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admin(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  user_agent_hash text,
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint admin_sessions_token_hash_format check (
    token_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint admin_sessions_expiry_after_creation check (expires_at > created_at)
);

create index if not exists admin_sessions_active_lookup_idx
  on public.admin_sessions (token_hash, expires_at)
  where revoked_at is null;
create index if not exists admin_sessions_admin_id_idx
  on public.admin_sessions (admin_id, created_at desc);

create table if not exists public.invitation_groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  display_name text not null,
  phone_e164 text,
  group_key text,
  invitation_token_hash text,
  invitation_token_last4 text,
  consent_at timestamptz,
  consent_source text,
  legacy_table text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  constraint invitation_groups_display_name_not_blank
    check (length(btrim(display_name)) > 0),
  constraint invitation_groups_phone_e164_format
    check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint invitation_groups_token_hash_format
    check (invitation_token_hash is null or invitation_token_hash ~ '^[a-f0-9]{64}$'),
  constraint invitation_groups_token_last4_format
    check (invitation_token_last4 is null or invitation_token_last4 ~ '^[A-Za-z0-9_-]{4}$')
);

create unique index if not exists invitation_groups_event_group_key_unique_idx
  on public.invitation_groups (event_id, group_key)
  where group_key is not null;
create unique index if not exists invitation_groups_event_token_hash_unique_idx
  on public.invitation_groups (event_id, invitation_token_hash)
  where invitation_token_hash is not null;
create unique index if not exists invitation_groups_legacy_unique_idx
  on public.invitation_groups (event_id, legacy_table, legacy_id)
  where legacy_table is not null and legacy_id is not null;
create index if not exists invitation_groups_event_phone_idx
  on public.invitation_groups (event_id, phone_e164);
create unique index if not exists invitation_groups_event_phone_unique_idx
  on public.invitation_groups (event_id, phone_e164)
  where phone_e164 is not null;

drop trigger if exists invitation_groups_set_updated_at on public.invitation_groups;
create trigger invitation_groups_set_updated_at
before update on public.invitation_groups
for each row execute function public.set_updated_at();

create table if not exists public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  code text not null,
  label text not null,
  capacity integer not null default 10 check (capacity >= 0),
  shape text not null default 'circle',
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 96 check (width > 0),
  height double precision not null default 96 check (height > 0),
  rotation double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  constraint seating_tables_code_not_blank check (length(btrim(code)) > 0),
  constraint seating_tables_label_not_blank check (length(btrim(label)) > 0)
);

create unique index if not exists seating_tables_event_code_unique_idx
  on public.seating_tables (event_id, lower(code));

drop trigger if exists seating_tables_set_updated_at on public.seating_tables;
create trigger seating_tables_set_updated_at
before update on public.seating_tables
for each row execute function public.set_updated_at();

create or replace function public.is_canonical_floor_plan_background_path(
  p_event_id uuid,
  p_background_path text
)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select
    p_background_path !~ '[[:cntrl:]]'
    and p_background_path ~ (
      '^' || p_event_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp)$'
    );
$$;

create table if not exists public.floor_plans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  logical_width integer not null default 1200 check (logical_width between 320 and 10000),
  logical_height integer not null default 800 check (logical_height between 320 and 10000),
  background_path text,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint floor_plans_background_path_canonical check (
    background_path is null
    or public.is_canonical_floor_plan_background_path(event_id, background_path)
  )
);

drop trigger if exists floor_plans_set_updated_at on public.floor_plans;
create trigger floor_plans_set_updated_at
before update on public.floor_plans
for each row execute function public.set_updated_at();

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  group_id uuid not null,
  name text not null,
  email text,
  attendance_status text not null default 'pending'
    check (attendance_status in ('pending', 'attending', 'declined')),
  attendance_source text not null default 'import',
  table_id uuid references public.seating_tables(id) on delete set null,
  dietary_preferences text[] not null default '{}'::text[],
  favorite_song text,
  drink_preferences text[] not null default '{}'::text[],
  legacy_table text,
  legacy_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  constraint guests_group_same_event_fk
    foreign key (event_id, group_id)
    references public.invitation_groups(event_id, id)
    on delete cascade,
  constraint guests_name_not_blank check (length(btrim(name)) > 0)
);

create unique index if not exists guests_legacy_unique_idx
  on public.guests (event_id, legacy_table, legacy_id)
  where legacy_table is not null and legacy_id is not null;
create index if not exists guests_event_attendance_idx
  on public.guests (event_id, attendance_status);
create index if not exists guests_group_id_idx on public.guests (group_id);
create index if not exists guests_table_id_idx on public.guests (table_id);

create or replace function public.enforce_guest_table_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_event_id uuid;
begin
  if new.attendance_status = 'declined' then
    new.table_id := null;
  end if;

  if new.table_id is null then
    return new;
  end if;

  select event_id into target_event_id
  from public.seating_tables
  where id = new.table_id;

  if target_event_id is null or target_event_id <> new.event_id then
    raise exception 'La mesa no pertenece al evento del invitado'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists guests_enforce_table_event on public.guests;
create trigger guests_enforce_table_event
before insert or update of event_id, table_id, attendance_status on public.guests
for each row execute function public.enforce_guest_table_event();

drop trigger if exists guests_set_updated_at on public.guests;
create trigger guests_set_updated_at
before update on public.guests
for each row execute function public.set_updated_at();

-- `table_name` remains nullable for compatibility with the legacy admin API.
-- New code must scope tags with event_id.
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  legacy_id text,
  event_id uuid references public.events(id) on delete cascade,
  table_name text,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tags add column if not exists legacy_id text;

-- Legacy tags also used integer IDs, which are still present as strings in the
-- RSVP tables. Keep that value and convert only the canonical primary key.
do $$
declare
  tag_id_type text;
begin
  select type.typname into tag_id_type
  from pg_catalog.pg_attribute attribute
  join pg_catalog.pg_class relation on relation.oid = attribute.attrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  join pg_catalog.pg_type type on type.oid = attribute.atttypid
  where namespace.nspname = 'public'
    and relation.relname = 'tags'
    and attribute.attname = 'id'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if tag_id_type in ('int2', 'int4', 'int8') then
    update public.tags
    set legacy_id = id::text
    where legacy_id is null;

    alter table public.tags alter column id drop identity if exists;
    alter table public.tags alter column id drop default;
    alter table public.tags alter column id type uuid
      using md5('invitia:legacy:tag:' || id::text)::uuid;
    alter table public.tags alter column id set default gen_random_uuid();
  elsif tag_id_type <> 'uuid' then
    raise exception 'Unsupported public.tags.id type: %', tag_id_type
      using errcode = '42804';
  end if;
end;
$$;

alter table public.tags add column if not exists event_id uuid;
alter table public.tags add column if not exists table_name text;
alter table public.tags add column if not exists created_at timestamptz default now();
alter table public.tags add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tags_event_id_fk'
      and conrelid = 'public.tags'::regclass
  ) then
    alter table public.tags
      add constraint tags_event_id_fk
      foreign key (event_id) references public.events(id) on delete cascade
      not valid;
  end if;
end;
$$;

create unique index if not exists tags_event_name_unique_idx
  on public.tags (event_id, lower(name))
  where event_id is not null;

drop trigger if exists tags_set_updated_at on public.tags;
create trigger tags_set_updated_at
before update on public.tags
for each row execute function public.set_updated_at();

create table if not exists public.guest_tags (
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (guest_id, tag_id),
  constraint guest_tags_guest_same_event_fk
    foreign key (event_id, guest_id)
    references public.guests(event_id, id)
    on delete cascade,
  constraint guest_tags_tag_fk
    foreign key (tag_id) references public.tags(id) on delete cascade
);

create index if not exists guest_tags_event_id_idx on public.guest_tags (event_id);
create index if not exists guest_tags_tag_id_idx on public.guest_tags (tag_id);

create or replace function public.enforce_guest_tag_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_event_id uuid;
begin
  select event_id into target_event_id from public.tags where id = new.tag_id;
  if target_event_id is null or target_event_id <> new.event_id then
    raise exception 'La etiqueta no pertenece al evento del invitado'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists guest_tags_enforce_event on public.guest_tags;
create trigger guest_tags_enforce_event
before insert or update on public.guest_tags
for each row execute function public.enforce_guest_tag_event();

create table if not exists public.attendance_history (
  id bigint generated by default as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  previous_status text check (
    previous_status is null or previous_status in ('pending', 'attending', 'declined')
  ),
  new_status text not null check (new_status in ('pending', 'attending', 'declined')),
  source text not null,
  changed_by_admin_id uuid references public.admin(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists attendance_history_guest_idx
  on public.attendance_history (guest_id, created_at desc);
create index if not exists attendance_history_event_idx
  on public.attendance_history (event_id, created_at desc);

create or replace function public.record_guest_attendance_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor_id uuid;
begin
  if tg_op = 'INSERT' or old.attendance_status is distinct from new.attendance_status then
    begin
      actor_id := nullif(current_setting('app.admin_id', true), '')::uuid;
    exception when invalid_text_representation then
      actor_id := null;
    end;

    insert into public.attendance_history (
      event_id,
      guest_id,
      previous_status,
      new_status,
      source,
      changed_by_admin_id
    ) values (
      new.event_id,
      new.id,
      case when tg_op = 'INSERT' then null else old.attendance_status end,
      new.attendance_status,
      new.attendance_source,
      actor_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists guests_record_attendance on public.guests;
create trigger guests_record_attendance
after insert or update of attendance_status on public.guests
for each row execute function public.record_guest_attendance_change();

create or replace function public.set_guest_attendance(
  p_event_id uuid,
  p_guest_id uuid,
  p_status text,
  p_source text,
  p_admin_id uuid default null
)
returns public.guests
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.guests;
begin
  if p_status not in ('pending', 'attending', 'declined') then
    raise exception 'Estado de asistencia inválido' using errcode = '22023';
  end if;

  if p_admin_id is not null and not exists (
    select 1
    from public.event_admins ea
    where ea.admin_id = p_admin_id
      and ea.active
      and (
        ea.event_id = p_event_id
        or ea.role = 'platform_admin'
      )
  ) then
    raise exception 'El administrador no tiene acceso al evento'
      using errcode = '42501';
  end if;

  perform set_config('app.admin_id', coalesce(p_admin_id::text, ''), true);

  update public.guests
  set attendance_status = p_status,
      attendance_source = coalesce(nullif(btrim(p_source), ''), 'unknown')
  where id = p_guest_id and event_id = p_event_id
  returning * into result;

  if result.id is null then
    raise exception 'Invitado no encontrado' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

revoke all on function public.set_guest_attendance(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.set_guest_attendance(uuid, uuid, text, text, uuid)
  to service_role;

create or replace function public.save_seating_layout(
  p_event_id uuid,
  p_expected_revision bigint,
  p_floor_plan jsonb,
  p_tables jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_revision bigint;
  next_revision bigint;
  table_value jsonb;
  table_id_value uuid;
  logical_width_value integer;
  logical_height_value integer;
  background_path_value text;
begin
  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;
  if p_expected_revision is null
     or p_expected_revision < 0
     or jsonb_typeof(p_floor_plan) is distinct from 'object'
     or jsonb_typeof(p_tables) is distinct from 'array' then
    raise exception 'invalid_seating_layout' using errcode = '22023';
  end if;
  if jsonb_array_length(p_tables) > 300 then
    raise exception 'invalid_seating_layout' using errcode = '22023';
  end if;

  logical_width_value := (p_floor_plan ->> 'logical_width')::integer;
  logical_height_value := (p_floor_plan ->> 'logical_height')::integer;
  if logical_width_value not between 480 and 4000
     or logical_height_value not between 320 and 3000 then
    raise exception 'invalid_floor_plan_dimensions' using errcode = '22023';
  end if;

  background_path_value := nullif(btrim(p_floor_plan ->> 'background_path'), '');
  if background_path_value is not null
     and not public.is_canonical_floor_plan_background_path(
       p_event_id,
       background_path_value
     ) then
    raise exception 'invalid_floor_plan_background_path' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('floor-plan:' || p_event_id::text, 0));

  -- Lock every existing table before validating removals. Guest assignment takes
  -- the same row lock, so an assignment cannot race a layout deletion and be
  -- silently cleared by the ON DELETE SET NULL foreign key.
  perform 1
  from public.seating_tables
  where event_id = p_event_id
  order by id
  for update;

  select revision into current_revision
  from public.floor_plans
  where event_id = p_event_id
  for update;

  if current_revision is null then
    if p_expected_revision is distinct from 0 then
      raise exception 'revision_conflict' using errcode = '40001';
    end if;
    next_revision := 1;
    insert into public.floor_plans (
      event_id,
      logical_width,
      logical_height,
      background_path,
      revision
    ) values (
      p_event_id,
      logical_width_value,
      logical_height_value,
      background_path_value,
      next_revision
    );
  else
    if current_revision is distinct from p_expected_revision then
      raise exception 'revision_conflict' using errcode = '40001';
    end if;
    next_revision := current_revision + 1;
    update public.floor_plans set
      logical_width = logical_width_value,
      logical_height = logical_height_value,
      background_path = background_path_value,
      revision = next_revision
    where event_id = p_event_id;
  end if;

  for table_value in select value from jsonb_array_elements(p_tables)
  loop
    table_id_value := (table_value ->> 'id')::uuid;
    if exists (
      select 1 from public.seating_tables
      where id = table_id_value and event_id <> p_event_id
    ) then
      raise exception 'table_belongs_to_another_event' using errcode = '42501';
    end if;
    if nullif(btrim(table_value ->> 'code'), '') is null
       or nullif(btrim(table_value ->> 'label'), '') is null
       or (table_value ->> 'capacity')::integer not between 1 and 200
       or table_value ->> 'shape' not in ('circle', 'rectangle')
       or (table_value ->> 'x')::double precision - (table_value ->> 'width')::double precision / 2 < 0
       or (table_value ->> 'y')::double precision - (table_value ->> 'height')::double precision / 2 < 0
       or (table_value ->> 'width')::double precision not between 32 and 600
       or (table_value ->> 'height')::double precision not between 32 and 600
       or (table_value ->> 'x')::double precision + (table_value ->> 'width')::double precision / 2 > logical_width_value
       or (table_value ->> 'y')::double precision + (table_value ->> 'height')::double precision / 2 > logical_height_value then
      raise exception 'invalid_seating_table' using errcode = '22023';
    end if;

    insert into public.seating_tables (
      id, event_id, code, label, capacity, shape, x, y, width, height, rotation
    ) values (
      table_id_value,
      p_event_id,
      upper(regexp_replace(btrim(table_value ->> 'code'), '[[:space:]]+', ' ', 'g')),
      btrim(table_value ->> 'label'),
      (table_value ->> 'capacity')::integer,
      table_value ->> 'shape',
      (table_value ->> 'x')::double precision,
      (table_value ->> 'y')::double precision,
      (table_value ->> 'width')::double precision,
      (table_value ->> 'height')::double precision,
      (table_value ->> 'rotation')::double precision
    )
    on conflict (id) do update set
      code = excluded.code,
      label = excluded.label,
      capacity = excluded.capacity,
      shape = excluded.shape,
      x = excluded.x,
      y = excluded.y,
      width = excluded.width,
      height = excluded.height,
      rotation = excluded.rotation
    where public.seating_tables.event_id = p_event_id;
  end loop;

  if exists (
    select 1
    from public.seating_tables existing_table
    join public.guests assigned_guest
      on assigned_guest.table_id = existing_table.id
    where existing_table.event_id = p_event_id
      and not exists (
        select 1
        from jsonb_array_elements(p_tables) table_item
        where table_item ->> 'id' = existing_table.id::text
      )
  ) then
    raise exception 'occupied_table_removal' using errcode = '23503';
  end if;

  delete from public.seating_tables existing_table
  where existing_table.event_id = p_event_id
    and not exists (
      select 1
      from jsonb_array_elements(p_tables) table_item
      where table_item ->> 'id' = existing_table.id::text
    );

  return next_revision;
end;
$$;

create or replace function public.assign_guest_to_table(
  p_event_id uuid,
  p_guest_id uuid,
  p_table_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  guest_row public.guests%rowtype;
  table_row public.seating_tables%rowtype;
  occupied_count integer;
begin
  -- Layout saves and assignments share this event-scoped lock. Besides making
  -- capacity checks deterministic, this establishes one lock order and avoids
  -- a deadlock between deleting a table and moving a guest at the same time.
  perform pg_advisory_xact_lock(hashtextextended('floor-plan:' || p_event_id::text, 0));

  select * into guest_row
  from public.guests
  where id = p_guest_id and event_id = p_event_id
  for update;
  if not found then
    raise exception 'guest_not_found' using errcode = 'P0002';
  end if;
  if guest_row.attendance_status = 'declined' then
    raise exception 'guest_not_eligible' using errcode = '23514';
  end if;

  if p_table_id is not null then
    select * into table_row
    from public.seating_tables
    where id = p_table_id and event_id = p_event_id
    for update;
    if not found then
      raise exception 'table_not_found' using errcode = 'P0002';
    end if;

    select count(*) into occupied_count
    from public.guests
    where table_id = p_table_id
      and attendance_status <> 'declined'
      and id <> p_guest_id;

    if occupied_count >= table_row.capacity and not coalesce(p_force, false) then
      raise exception 'table_capacity_exceeded' using errcode = '23514';
    end if;
  end if;

  update public.guests
  set table_id = p_table_id
  where id = p_guest_id and event_id = p_event_id
  returning * into guest_row;

  return jsonb_build_object(
    'guestId', guest_row.id,
    'tableId', guest_row.table_id,
    'forced', coalesce(p_force, false)
  );
end;
$$;

revoke all on function public.save_seating_layout(uuid, bigint, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_seating_layout(uuid, bigint, jsonb, jsonb)
  to service_role;
revoke all on function public.assign_guest_to_table(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.assign_guest_to_table(uuid, uuid, uuid, boolean)
  to service_role;

-- The application uses a service-role client. Enabling RLS with no public
-- policies prevents direct anon/authenticated access to private event data.
alter table public.admin enable row level security;
alter table public.events enable row level security;
alter table public.event_admins enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.invitation_groups enable row level security;
alter table public.seating_tables enable row level security;
alter table public.floor_plans enable row level security;
alter table public.guests enable row level security;
alter table public.tags enable row level security;
alter table public.guest_tags enable row level security;
alter table public.attendance_history enable row level security;

comment on table public.events is 'Canonical event configuration and tenant boundary.';
comment on table public.event_admins is 'Event-scoped administrator access. A platform_admin mapping grants platform-wide access.';
comment on table public.admin_sessions is 'Opaque administrator sessions; only SHA-256 token hashes are persisted.';
comment on column public.events.legacy_table_name is 'Temporary pointer to the per-event RSVP table used during migration.';
comment on column public.floor_plans.revision is 'Optimistic concurrency revision; clients must reject stale writes.';
