begin;

-- Close the scan/install race: no mapping write can commit between quarantine
-- and creation of the permanent validation triggers below.
lock table public.admin, public.events in share row exclusive mode;

-- Reinstall the catalog inspection for databases where migrations 001-007
-- were already applied before this guard existed.
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

-- Preserve every currently configured, schema-valid legacy relation, but make
-- that finite inventory independent from the mutable mapping columns.
with validated_relations as (
  select distinct on (administrator.table_name)
    administrator.table_name,
    public.inspect_legacy_rsvp_relation(administrator.table_name) as diagnostics
  from public.admin administrator
  where administrator.table_name is not null
  order by administrator.table_name
)
insert into public.legacy_rsvp_relations (
  table_name,
  relation_oid,
  source,
  details
)
select
  candidate.table_name,
  (candidate.diagnostics ->> 'relationOid')::oid,
  'admin_backfill',
  jsonb_build_object('inspection', candidate.diagnostics)
from validated_relations candidate
where (candidate.diagnostics ->> 'valid')::boolean
on conflict (table_name) do update
set relation_oid = excluded.relation_oid,
    details = public.legacy_rsvp_relations.details || excluded.details,
    last_validated_at = now()
where public.legacy_rsvp_relations.status = 'active';

with expected_mappings(slug, table_name) as (
  values
    ('sofi-gonchi', 'boda_sofi_gonchi_rsvps'),
    ('mica-tincho', 'boda_mica_tincho_rsvps'),
    ('vir-jere', 'boda_vir_jere'),
    ('andres-lucre', 'boda_andres_lucre'),
    ('calas', 'boda_calas'),
    ('domi-diego', 'boda_domi_diego'),
    ('mica-santi', 'boda_mica_santi')
), validated_relations as (
  select
    event.legacy_table_name as table_name,
    public.inspect_legacy_rsvp_relation(event.legacy_table_name) as diagnostics
  from public.events event
  join expected_mappings expected
    on expected.slug = event.slug
   and expected.table_name = event.legacy_table_name
)
insert into public.legacy_rsvp_relations (
  table_name,
  relation_oid,
  source,
  details
)
select
  candidate.table_name,
  (candidate.diagnostics ->> 'relationOid')::oid,
  'canonical_seed',
  jsonb_build_object('inspection', candidate.diagnostics)
from validated_relations candidate
where (candidate.diagnostics ->> 'valid')::boolean
on conflict (table_name) do update
set relation_oid = excluded.relation_oid,
    details = public.legacy_rsvp_relations.details || excluded.details,
    last_validated_at = now()
where public.legacy_rsvp_relations.status = 'active';

with canonical_slugs(slug) as (
  values
    ('sofi-gonchi'),
    ('mica-tincho'),
    ('vir-jere'),
    ('andres-lucre'),
    ('calas'),
    ('domi-diego'),
    ('mica-santi')
), validated_relations as (
  select
    event.legacy_table_name as table_name,
    public.inspect_legacy_rsvp_relation(event.legacy_table_name) as diagnostics
  from public.events event
  left join canonical_slugs canonical on canonical.slug = event.slug
  where canonical.slug is null
    and event.legacy_table_name is not null
)
insert into public.legacy_rsvp_relations (
  table_name,
  relation_oid,
  source,
  details
)
select
  candidate.table_name,
  (candidate.diagnostics ->> 'relationOid')::oid,
  'event_backfill',
  jsonb_build_object('inspection', candidate.diagnostics)
from validated_relations candidate
where (candidate.diagnostics ->> 'valid')::boolean
on conflict (table_name) do update
set relation_oid = excluded.relation_oid,
    details = public.legacy_rsvp_relations.details || excluded.details,
    last_validated_at = now()
where public.legacy_rsvp_relations.status = 'active';

with configured_candidates as (
  select
    administrator.id as admin_id,
    administrator.table_name as candidate_table_name,
    public.authorize_legacy_rsvp_relation(administrator.table_name) as diagnostics
  from public.admin administrator
  where administrator.table_name is not null
)
insert into public.legacy_rsvp_mapping_reviews (
  admin_id,
  candidate_table_name,
  source,
  reason,
  diagnostics
)
select
  candidate.admin_id,
  candidate.candidate_table_name,
  'admin.table_name',
  candidate.diagnostics ->> 'reason',
  candidate.diagnostics
from configured_candidates candidate
where not (candidate.diagnostics ->> 'valid')::boolean
on conflict do nothing;

with event_candidates as (
  select
    event.id as event_id,
    event.legacy_table_name as candidate_table_name,
    public.authorize_legacy_rsvp_relation(event.legacy_table_name) as diagnostics
  from public.events event
  where event.legacy_table_name is not null
)
insert into public.legacy_rsvp_mapping_reviews (
  event_id,
  candidate_table_name,
  source,
  reason,
  diagnostics
)
select
  candidate.event_id,
  candidate.candidate_table_name,
  'events.legacy_table_name',
  candidate.diagnostics ->> 'reason',
  candidate.diagnostics
from event_candidates candidate
where not (candidate.diagnostics ->> 'valid')::boolean
on conflict do nothing;

with expected_mappings(slug, table_name) as (
  values
    ('sofi-gonchi', 'boda_sofi_gonchi_rsvps'),
    ('mica-tincho', 'boda_mica_tincho_rsvps'),
    ('vir-jere', 'boda_vir_jere'),
    ('andres-lucre', 'boda_andres_lucre'),
    ('calas', 'boda_calas'),
    ('domi-diego', 'boda_domi_diego'),
    ('mica-santi', 'boda_mica_santi')
)
insert into public.legacy_rsvp_mapping_reviews (
  event_id,
  candidate_table_name,
  source,
  reason,
  diagnostics
)
select
  event.id,
  event.legacy_table_name,
  'events.legacy_table_name',
  'canonical_table_mismatch',
  jsonb_build_object(
    'valid', false,
    'reason', 'canonical_table_mismatch',
    'tableName', event.legacy_table_name,
    'expectedTable', expected.table_name
  )
from public.events event
join expected_mappings expected on expected.slug = event.slug
where event.legacy_table_name is not null
  and event.legacy_table_name is distinct from expected.table_name
on conflict do nothing;

-- A schema-valid RSVP table can still belong to another wedding. Quarantine
-- those cross-event mappings before handling generic catalog failures.
do $$
declare
  candidate record;
  candidate_relation regclass;
begin
  for candidate in
    with expected_mappings(slug, table_name) as (
      values
        ('sofi-gonchi', 'boda_sofi_gonchi_rsvps'),
        ('mica-tincho', 'boda_mica_tincho_rsvps'),
        ('vir-jere', 'boda_vir_jere'),
        ('andres-lucre', 'boda_andres_lucre'),
        ('calas', 'boda_calas'),
        ('domi-diego', 'boda_domi_diego'),
        ('mica-santi', 'boda_mica_santi')
    )
    select distinct event.legacy_table_name
    from public.events event
    join expected_mappings expected on expected.slug = event.slug
    where event.legacy_table_name is not null
      and event.legacy_table_name is distinct from expected.table_name
  loop
    candidate_relation := to_regclass(
      format('%I.%I', 'public', candidate.legacy_table_name)
    );
    if candidate_relation is not null then
      execute format(
        'drop trigger if exists invitia_legacy_dual_write on %s',
        candidate_relation
      );
    end if;
  end loop;
end;
$$;

with expected_mappings(slug, table_name) as (
  values
    ('sofi-gonchi', 'boda_sofi_gonchi_rsvps'),
    ('mica-tincho', 'boda_mica_tincho_rsvps'),
    ('vir-jere', 'boda_vir_jere'),
    ('andres-lucre', 'boda_andres_lucre'),
    ('calas', 'boda_calas'),
    ('domi-diego', 'boda_domi_diego'),
    ('mica-santi', 'boda_mica_santi')
)
update public.event_admins event_admin
set active = false,
    updated_at = now()
from public.events event
join expected_mappings expected on expected.slug = event.slug
where event.id = event_admin.event_id
  and event_admin.role = 'couple_admin'
  and event.legacy_table_name is not null
  and event.legacy_table_name is distinct from expected.table_name;

with expected_mappings(slug, table_name) as (
  values
    ('sofi-gonchi', 'boda_sofi_gonchi_rsvps'),
    ('mica-tincho', 'boda_mica_tincho_rsvps'),
    ('vir-jere', 'boda_vir_jere'),
    ('andres-lucre', 'boda_andres_lucre'),
    ('calas', 'boda_calas'),
    ('domi-diego', 'boda_domi_diego'),
    ('mica-santi', 'boda_mica_santi')
)
update public.event_migration_state migration_state
set legacy_reads_enabled = false,
    legacy_dual_write_enabled = false,
    updated_at = now()
from public.events event
join expected_mappings expected on expected.slug = event.slug
where event.id = migration_state.event_id
  and event.legacy_table_name is not null
  and event.legacy_table_name is distinct from expected.table_name;

with expected_mappings(slug, table_name) as (
  values
    ('sofi-gonchi', 'boda_sofi_gonchi_rsvps'),
    ('mica-tincho', 'boda_mica_tincho_rsvps'),
    ('vir-jere', 'boda_vir_jere'),
    ('andres-lucre', 'boda_andres_lucre'),
    ('calas', 'boda_calas'),
    ('domi-diego', 'boda_domi_diego'),
    ('mica-santi', 'boda_mica_santi')
)
update public.events event
set
  metadata = event.metadata || jsonb_build_object(
    'legacy_mapping_review',
    jsonb_build_object(
      'candidate', event.legacy_table_name,
      'reason', 'canonical_table_mismatch',
      'expected', expected.table_name,
      'quarantined_at', now()
    )
  ),
  legacy_table_name = null
from expected_mappings expected
where expected.slug = event.slug
  and event.legacy_table_name is not null
  and event.legacy_table_name is distinct from expected.table_name;

-- Remove a trigger that an older migration may have installed on a canonical
-- or malformed relation before quarantining its pointer.
do $$
declare
  candidate record;
  candidate_relation regclass;
begin
  for candidate in
    select distinct event.legacy_table_name
    from public.events event
    where event.legacy_table_name is not null
      and not (
        public.authorize_legacy_rsvp_relation(event.legacy_table_name)
          ->> 'valid'
      )::boolean
  loop
    candidate_relation := to_regclass(
      format('%I.%I', 'public', candidate.legacy_table_name)
    );
    if candidate_relation is not null then
      execute format(
        'drop trigger if exists invitia_legacy_dual_write on %s',
        candidate_relation
      );
    end if;
  end loop;
end;
$$;

update public.event_admins event_admin
set active = false,
    updated_at = now()
from public.events event
where event.id = event_admin.event_id
  and event_admin.role = 'couple_admin'
  and event.legacy_table_name is not null
  and public.authorize_legacy_rsvp_relation(event.legacy_table_name) ->> 'reason'
      <> 'relation_missing'
  and not (
    public.authorize_legacy_rsvp_relation(event.legacy_table_name) ->> 'valid'
  )::boolean;

update public.event_migration_state migration_state
set legacy_reads_enabled = false,
    legacy_dual_write_enabled = false,
    updated_at = now()
from public.events event
where event.id = migration_state.event_id
  and event.legacy_table_name is not null
  and not (
    public.authorize_legacy_rsvp_relation(event.legacy_table_name) ->> 'valid'
  )::boolean;

update public.events event
set
  metadata = event.metadata || jsonb_build_object(
    'legacy_mapping_review',
    jsonb_build_object(
      'candidate', event.legacy_table_name,
      'quarantined_at', now()
    )
  ),
  legacy_table_name = null
where event.legacy_table_name is not null
  and not (
    public.authorize_legacy_rsvp_relation(event.legacy_table_name) ->> 'valid'
  )::boolean;

update public.admin administrator
set table_name = null
where administrator.table_name is not null
  and not (
    public.authorize_legacy_rsvp_relation(administrator.table_name) ->> 'valid'
  )::boolean;

-- Prevent a later configuration change from reintroducing a confused deputy.
-- Provision and validate the physical RSVP relation before binding its name.
create or replace function public.enforce_legacy_rsvp_mapping()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  candidate_table_name text;
  expected_table_name text;
  relation_inspection jsonb;
begin
  candidate_table_name := case
    when tg_table_name = 'admin' then to_jsonb(new) ->> 'table_name'
    when tg_table_name = 'events' then to_jsonb(new) ->> 'legacy_table_name'
    else null
  end;

  if candidate_table_name is null then return new; end if;

  if tg_table_name = 'events' then
    expected_table_name := case to_jsonb(new) ->> 'slug'
      when 'sofi-gonchi' then 'boda_sofi_gonchi_rsvps'
      when 'mica-tincho' then 'boda_mica_tincho_rsvps'
      when 'vir-jere' then 'boda_vir_jere'
      when 'andres-lucre' then 'boda_andres_lucre'
      when 'calas' then 'boda_calas'
      when 'domi-diego' then 'boda_domi_diego'
      when 'mica-santi' then 'boda_mica_santi'
      else null
    end;
    if expected_table_name is not null
       and candidate_table_name is distinct from expected_table_name then
      raise exception using
        errcode = '23514',
        message = 'canonical_legacy_rsvp_mapping_mismatch',
        detail = jsonb_build_object(
          'eventSlug', to_jsonb(new) ->> 'slug',
          'candidate', candidate_table_name,
          'expected', expected_table_name
        )::text;
    end if;
  end if;

  relation_inspection := public.authorize_legacy_rsvp_relation(
    candidate_table_name
  );
  if not (relation_inspection ->> 'valid')::boolean then
    raise exception using
      errcode = '23514',
      message = 'unsafe_legacy_rsvp_mapping',
      detail = relation_inspection::text,
      hint = 'Provision a reviewed legacy RSVP relation before assigning its table name.';
  end if;

  return new;
end;
$$;

drop trigger if exists admin_enforce_legacy_rsvp_mapping on public.admin;
create trigger admin_enforce_legacy_rsvp_mapping
before insert or update of table_name on public.admin
for each row execute function public.enforce_legacy_rsvp_mapping();

drop trigger if exists events_enforce_legacy_rsvp_mapping on public.events;
create trigger events_enforce_legacy_rsvp_mapping
before insert or update of legacy_table_name, slug on public.events
for each row execute function public.enforce_legacy_rsvp_mapping();

revoke all on function public.inspect_legacy_rsvp_relation(text)
  from public, anon, authenticated;
grant execute on function public.inspect_legacy_rsvp_relation(text)
  to service_role;
revoke all on function public.authorize_legacy_rsvp_relation(text)
  from public, anon, authenticated;
grant execute on function public.authorize_legacy_rsvp_relation(text)
  to service_role;
revoke all on function public.enforce_legacy_rsvp_mapping()
  from public, anon, authenticated;

comment on table public.legacy_rsvp_mapping_reviews is
  'Rejected legacy relation candidates. They require explicit schema review before a mapping can be restored.';

commit;
