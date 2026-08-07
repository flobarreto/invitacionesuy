-- Restore the real production legacy RSVP contracts after the stricter v2
-- preflight quarantined valid, older table variants.

begin;

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
  has_standard_contract boolean;
  has_save_the_date_contract boolean;
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
      ('created_at', array['timestamptz', 'timestamp']::text[])
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

  select
    count(*) filter (where attribute.attname in ('name', 'attendance')) = 2,
    count(*) filter (where attribute.attname in ('favorite_song', 'drink')) = 2
  into has_standard_contract, has_save_the_date_contract
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = relation_oid
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if not has_standard_contract and not has_save_the_date_contract then
    return jsonb_build_object(
      'valid', false,
      'reason', 'unsupported_rsvp_contract',
      'tableName', p_table_name
    );
  end if;

  with recognized(column_name, allowed_types) as (
    values
      ('id', array['uuid', 'text', 'varchar', 'int2', 'int4', 'int8']::text[]),
      ('name', array['text', 'varchar', 'bpchar']::text[]),
      ('attendance', array['text', 'varchar', 'bpchar']::text[]),
      ('created_at', array['timestamptz', 'timestamp']::text[]),
      ('email', array['text', 'varchar', 'bpchar']::text[]),
      ('phone', array['text', 'varchar', 'bpchar']::text[]),
      ('phone_e164', array['text', 'varchar', 'bpchar']::text[]),
      ('telefono', array['text', 'varchar', 'bpchar']::text[]),
      ('dietary_preferences', array['_text', '_varchar', 'text', 'varchar', 'json', 'jsonb']::text[]),
      ('favorite_song', array['_text', '_varchar', 'text', 'varchar', 'json', 'jsonb']::text[]),
      ('drink', array['_text', '_varchar', 'text', 'varchar', 'json', 'jsonb']::text[]),
      ('table_number', array['text', 'varchar', 'bpchar', 'int2', 'int4', 'int8', 'numeric']::text[]),
      ('tags', array['_uuid', '_text', '_varchar', 'text', 'varchar', 'json', 'jsonb']::text[])
  )
  select array_agg(
    recognized.column_name || ':' || column_type.typname
    order by recognized.column_name
  )
  into invalid_columns
  from recognized
  join pg_catalog.pg_attribute attribute
    on attribute.attrelid = relation_oid
   and attribute.attname = recognized.column_name
   and attribute.attnum > 0
   and not attribute.attisdropped
  join pg_catalog.pg_type column_type on column_type.oid = attribute.atttypid
  where column_type.typname <> all(recognized.allowed_types);

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
    'relationOid', relation_oid::text,
    'contractProfile', case
      when has_standard_contract then 'rsvp'
      else 'save_the_date'
    end
  );
end;
$$;

-- Mica & Santi still writes its live save-the-date form to the historical
-- save_the_date table. Keep the canonical slug bound to that existing source.
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
      when 'mica-santi' then 'save_the_date_mica_santi'
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

  relation_inspection := public.authorize_legacy_rsvp_relation(candidate_table_name);
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

with candidates as (
  select distinct review.candidate_table_name
  from public.legacy_rsvp_mapping_reviews review
  where review.status = 'pending'
    and review.source = 'admin.table_name'
), inspected as (
  select
    candidate.candidate_table_name,
    public.inspect_legacy_rsvp_relation(candidate.candidate_table_name) as diagnostics
  from candidates candidate
)
insert into public.legacy_rsvp_relations (
  table_name,
  relation_oid,
  source,
  status,
  details,
  approved_by
)
select
  inspected.candidate_table_name,
  (inspected.diagnostics ->> 'relationOid')::oid,
  'manual_review',
  'active',
  jsonb_build_object('inspection', inspected.diagnostics, 'restoredBy', 'migration-012'),
  'migration-012'
from inspected
where (inspected.diagnostics ->> 'valid')::boolean
on conflict (table_name) do update
set relation_oid = excluded.relation_oid,
    source = excluded.source,
    status = 'active',
    details = public.legacy_rsvp_relations.details || excluded.details,
    approved_by = excluded.approved_by,
    last_validated_at = now();

with canonical_mapping(slug, table_name) as (
  values
    ('domi-diego', 'boda_domi_diego'),
    ('mica-santi', 'save_the_date_mica_santi')
)
update public.events event
set legacy_table_name = mapping.table_name,
    metadata = event.metadata || jsonb_build_object(
      'legacy_mapping_restored_at', now(),
      'legacy_mapping_restored_by', 'migration-012'
    ),
    updated_at = now()
from canonical_mapping mapping
where event.slug = mapping.slug
  and exists (
    select 1
    from public.legacy_rsvp_relations relation
    where relation.table_name = mapping.table_name
      and relation.status = 'active'
  );

with recovered as (
  select distinct on (review.candidate_table_name)
    review.candidate_table_name,
    administrator.event_name
  from public.legacy_rsvp_mapping_reviews review
  join public.admin administrator on administrator.id = review.admin_id
  where review.status = 'pending'
    and review.source = 'admin.table_name'
    and review.candidate_table_name not in (
      'boda_domi_diego',
      'save_the_date_mica_santi'
    )
  order by review.candidate_table_name, review.created_at
)
insert into public.events (
  slug,
  display_name,
  rsvp_status,
  legacy_table_name,
  metadata
)
select
  'legacy-' || substr(md5(recovered.candidate_table_name), 1, 16),
  coalesce(nullif(btrim(recovered.event_name), ''), recovered.candidate_table_name),
  'closed',
  recovered.candidate_table_name,
  jsonb_build_object(
    'migration_source', 'legacy_rsvp_mapping_reviews',
    'legacy_mapping_restored_by', 'migration-012'
  )
from recovered
where exists (
  select 1
  from public.legacy_rsvp_relations relation
  where relation.table_name = recovered.candidate_table_name
    and relation.status = 'active'
)
  and not exists (
    select 1 from public.events event
    where event.legacy_table_name = recovered.candidate_table_name
  )
on conflict (slug) do update
set display_name = excluded.display_name,
    legacy_table_name = excluded.legacy_table_name,
    metadata = public.events.metadata || excluded.metadata,
    updated_at = now();

update public.admin administrator
set table_name = review.candidate_table_name
from public.legacy_rsvp_mapping_reviews review
where review.admin_id = administrator.id
  and review.status = 'pending'
  and review.source = 'admin.table_name'
  and administrator.table_name is null
  and (
    public.authorize_legacy_rsvp_relation(review.candidate_table_name) ->> 'valid'
  )::boolean;

insert into public.event_admins (event_id, admin_id, role, active)
select event.id, administrator.id, 'couple_admin', true
from public.admin administrator
join public.events event on event.legacy_table_name = administrator.table_name
where administrator.table_name is not null
on conflict (event_id, admin_id) do update
set active = true,
    updated_at = now();

insert into public.event_migration_state (
  event_id,
  legacy_reads_enabled,
  legacy_dual_write_enabled,
  cutover_completed_at
)
select event.id, true, true, null
from public.events event
where event.legacy_table_name is not null
  and (
    public.authorize_legacy_rsvp_relation(event.legacy_table_name) ->> 'valid'
  )::boolean
on conflict (event_id) do update
set legacy_reads_enabled = true,
    legacy_dual_write_enabled = true,
    cutover_completed_at = null,
    updated_at = now();

update public.tags tag
set event_id = event.id
from public.events event
where tag.event_id is null
  and tag.table_name = event.legacy_table_name;

insert into public.legacy_tag_aliases (event_id, legacy_tag_id, canonical_tag_id)
select tag.event_id, tag.id, tag.id
from public.tags tag
where tag.event_id is not null
on conflict (event_id, legacy_tag_id) do update
set canonical_tag_id = excluded.canonical_tag_id;

-- Migration 011 joins a table that also has a `source_table` column. Install
-- the function-local compiler directive on databases that already ran 011.
do $patch_migrate_function$
declare
  function_definition text;
  patched_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.migrate_legacy_event(uuid)'::regprocedure
  ) into function_definition;

  if position('#variable_conflict use_variable' in function_definition) = 0 then
    patched_definition := replace(
      function_definition,
      E'AS $function$\n',
      E'AS $function$\n#variable_conflict use_variable\n'
    );
    if patched_definition = function_definition then
      raise exception 'Unable to patch migrate_legacy_event compiler directive'
        using errcode = '55000';
    end if;
    execute patched_definition;
  end if;
end;
$patch_migrate_function$;

do $$
declare
  event_record record;
  migration_result jsonb;
begin
  for event_record in
    select event.id
    from public.events event
    where event.legacy_table_name is not null
      and (
        public.authorize_legacy_rsvp_relation(event.legacy_table_name) ->> 'valid'
      )::boolean
  loop
    migration_result := public.migrate_legacy_event(event_record.id);
    if migration_result ->> 'status' <> 'completed' then
      raise exception 'Legacy RSVP migration failed for event %: %',
        event_record.id,
        migration_result
        using errcode = '55000';
    end if;
  end loop;
end;
$$;

do $$
declare
  event_record record;
begin
  for event_record in
    select event.legacy_table_name
    from public.events event
    join public.event_migration_state state on state.event_id = event.id
    where event.legacy_table_name is not null
      and state.legacy_reads_enabled
      and state.legacy_dual_write_enabled
  loop
    execute format(
      'drop trigger if exists invitia_legacy_write_guard on public.%I',
      event_record.legacy_table_name
    );
    execute format(
      'create trigger invitia_legacy_write_guard before insert or update or delete on public.%I for each row execute function public.guard_legacy_rsvp_write_window()',
      event_record.legacy_table_name
    );
    execute format(
      'drop trigger if exists invitia_legacy_dual_write on public.%I',
      event_record.legacy_table_name
    );
    execute format(
      'create trigger invitia_legacy_dual_write after insert or update or delete on public.%I for each row execute function public.sync_legacy_rsvp_to_core()',
      event_record.legacy_table_name
    );
  end loop;
end;
$$;

select public.migrate_legacy_floor_plans();

update public.legacy_rsvp_mapping_reviews review
set status = 'resolved',
    resolved_at = now(),
    resolved_by = 'migration-012',
    resolution_note = 'Restored after validating the production RSVP/save-the-date contract.'
where review.status = 'pending'
  and review.source = 'admin.table_name'
  and (
    public.authorize_legacy_rsvp_relation(review.candidate_table_name) ->> 'valid'
  )::boolean;

revoke all on function public.inspect_legacy_rsvp_relation(text)
  from public, anon, authenticated;
grant execute on function public.inspect_legacy_rsvp_relation(text)
  to service_role;
revoke all on function public.enforce_legacy_rsvp_mapping()
  from public, anon, authenticated;

commit;
