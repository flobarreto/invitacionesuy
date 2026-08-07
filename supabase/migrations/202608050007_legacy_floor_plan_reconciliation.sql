-- Reconcile both discarded floor-plan prototypes into the canonical event
-- model. Source relations remain untouched (the plural prototype was archived
-- by migration 000), and every source row is snapshotted with a checksum.

create table if not exists public.legacy_floor_plan_migration_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running'
    check (status in ('running', 'completed', 'needs_review', 'failed')),
  source_count integer not null default 0 check (source_count >= 0),
  mapped_source_count integer not null default 0 check (mapped_source_count >= 0),
  imported_table_count integer not null default 0 check (imported_table_count >= 0),
  matched_table_count integer not null default 0 check (matched_table_count >= 0),
  unresolved_issue_count integer not null default 0 check (unresolved_issue_count >= 0),
  source_checksum text,
  target_checksum text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint legacy_floor_plan_run_source_checksum_format
    check (source_checksum is null or source_checksum ~ '^[a-f0-9]{64}$'),
  constraint legacy_floor_plan_run_target_checksum_format
    check (target_checksum is null or target_checksum ~ '^[a-f0-9]{64}$')
);

create table if not exists public.legacy_floor_plan_sources (
  id uuid primary key default gen_random_uuid(),
  source_relation text not null,
  source_kind text not null
    check (source_kind in ('table_name_layout', 'admin_floor_tables')),
  source_key text not null,
  raw_payload jsonb not null,
  source_checksum text not null,
  event_candidates uuid[] not null default '{}'::uuid[],
  event_id uuid references public.events(id) on delete restrict,
  mapping_status text not null
    check (mapping_status in ('mapped', 'unmapped', 'ambiguous')),
  first_captured_at timestamptz not null default now(),
  last_captured_at timestamptz not null default now(),
  last_seen_run_id uuid references public.legacy_floor_plan_migration_runs(id)
    on delete set null,
  unique (source_relation, source_key),
  constraint legacy_floor_plan_source_checksum_format
    check (source_checksum ~ '^[a-f0-9]{64}$'),
  constraint legacy_floor_plan_source_mapping_consistency check (
    (mapping_status = 'mapped' and event_id is not null and cardinality(event_candidates) = 1)
    or (mapping_status = 'unmapped' and event_id is null and cardinality(event_candidates) = 0)
    or (mapping_status = 'ambiguous' and event_id is null and cardinality(event_candidates) > 1)
  )
);

create index if not exists legacy_floor_plan_sources_event_idx
  on public.legacy_floor_plan_sources(event_id)
  where event_id is not null;

create table if not exists public.legacy_floor_plan_source_versions (
  id bigint generated always as identity primary key,
  source_id uuid not null references public.legacy_floor_plan_sources(id)
    on delete cascade,
  source_checksum text not null,
  raw_payload jsonb not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_seen_run_id uuid references public.legacy_floor_plan_migration_runs(id)
    on delete set null,
  unique (source_id, source_checksum),
  constraint legacy_floor_plan_source_version_checksum_format
    check (source_checksum ~ '^[a-f0-9]{64}$')
);

create table if not exists public.legacy_floor_plan_reconciliation_audit (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.legacy_floor_plan_migration_runs(id)
    on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  source_id uuid references public.legacy_floor_plan_sources(id) on delete set null,
  table_code text,
  canonical_table_id uuid references public.seating_tables(id) on delete set null,
  status text not null check (status in ('imported', 'matched', 'issue', 'skipped')),
  issue_code text,
  details jsonb not null default '{}'::jsonb,
  issue_fingerprint text generated always as (
    encode(
      extensions.digest(
        coalesce(event_id::text, '') || '|' ||
        coalesce(source_id::text, '') || '|' ||
        coalesce(table_code, '') || '|' ||
        coalesce(issue_code, '') || '|' ||
        details::text,
        'sha256'
      ),
      'hex'
    )
  ) stored,
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text,
  created_at timestamptz not null default now(),
  constraint legacy_floor_plan_audit_issue_consistency check (
    (status = 'issue' and issue_code is not null)
    or (status <> 'issue' and issue_code is null)
  ),
  constraint legacy_floor_plan_audit_resolution_consistency check (
    (resolved_at is null and resolved_by is null and resolution_note is null)
    or (
      resolved_at is not null
      and nullif(btrim(resolved_by), '') is not null
      and nullif(btrim(resolution_note), '') is not null
    )
  )
);

create index if not exists legacy_floor_plan_audit_run_idx
  on public.legacy_floor_plan_reconciliation_audit(run_id, status);
create index if not exists legacy_floor_plan_audit_unresolved_idx
  on public.legacy_floor_plan_reconciliation_audit(issue_fingerprint)
  where status = 'issue' and resolved_at is null;

alter table public.legacy_floor_plan_migration_runs enable row level security;
alter table public.legacy_floor_plan_sources enable row level security;
alter table public.legacy_floor_plan_source_versions enable row level security;
alter table public.legacy_floor_plan_reconciliation_audit enable row level security;

create or replace function public.normalize_legacy_floor_table_code(p_code text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select nullif(
    upper(regexp_replace(btrim(coalesce(p_code, '')), '[[:space:]]+', ' ', 'g')),
    ''
  );
$$;

create or replace function public.legacy_floor_plan_number(p_value jsonb)
returns double precision
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  value_text text;
begin
  if p_value is null or jsonb_typeof(p_value) not in ('number', 'string') then
    return null;
  end if;

  value_text := btrim(p_value #>> '{}');
  if value_text !~ '^-?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' then
    return null;
  end if;

  return value_text::double precision;
exception
  when numeric_value_out_of_range then
    return null;
end;
$$;

create or replace function public.normalize_legacy_floor_table(
  p_source_kind text,
  p_table jsonb,
  p_logical_width integer,
  p_logical_height integer
)
returns jsonb
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  table_code text;
  table_label text;
  source_shape text;
  canonical_shape text;
  raw_x double precision;
  raw_y double precision;
  scaled_x double precision;
  scaled_y double precision;
  position_x double precision;
  position_y double precision;
  raw_size double precision;
  raw_width double precision;
  raw_height double precision;
  table_width double precision;
  table_height double precision;
  raw_capacity double precision;
  table_capacity integer;
  table_rotation double precision;
  adjustments jsonb := '[]'::jsonb;
  valid boolean := true;
  issue_code text;
begin
  if jsonb_typeof(p_table) <> 'object' then
    return jsonb_build_object(
      'valid', false,
      'issue_code', 'table_entry_not_object',
      'adjustments', adjustments
    );
  end if;

  table_code := public.normalize_legacy_floor_table_code(coalesce(
    p_table ->> 'tableNumber',
    p_table ->> 'table_number',
    p_table ->> 'code'
  ));
  if table_code is null then
    valid := false;
    issue_code := 'missing_table_code';
  elsif length(table_code) > 40 then
    valid := false;
    issue_code := 'table_code_too_long';
  end if;

  table_label := nullif(btrim(coalesce(p_table ->> 'name', p_table ->> 'label')), '');
  table_label := coalesce(table_label, table_code, 'Mesa sin código');
  if length(table_label) > 80 then
    table_label := left(table_label, 80);
    adjustments := adjustments || jsonb_build_array('label_truncated_to_80_characters');
  end if;

  source_shape := lower(btrim(coalesce(p_table ->> 'shape', '')));
  if source_shape in ('circle', 'round') then
    canonical_shape := 'circle';
  elsif source_shape in ('rectangle', 'rect') then
    canonical_shape := 'rectangle';
  else
    canonical_shape := 'circle';
    adjustments := adjustments || jsonb_build_array('shape_defaulted_to_circle');
  end if;

  raw_x := public.legacy_floor_plan_number(p_table -> 'x');
  raw_y := public.legacy_floor_plan_number(p_table -> 'y');
  if raw_x is null or raw_y is null then
    valid := false;
    issue_code := coalesce(issue_code, 'missing_table_position');
  end if;

  if p_source_kind = 'admin_floor_tables' then
    scaled_x := case when raw_x is null then null else
      greatest(-1000000, least(raw_x, 1000000)) * p_logical_width / 100.0
    end;
    scaled_y := case when raw_y is null then null else
      greatest(-1000000, least(raw_y, 1000000)) * p_logical_height / 100.0
    end;
  else
    scaled_x := raw_x;
    scaled_y := raw_y;
  end if;

  raw_size := public.legacy_floor_plan_number(p_table -> 'size');
  raw_width := public.legacy_floor_plan_number(p_table -> 'width');
  raw_height := public.legacy_floor_plan_number(p_table -> 'height');

  if canonical_shape = 'circle' then
    table_width := coalesce(
      raw_size,
      public.legacy_floor_plan_number(p_table -> 'radius') * 2,
      raw_width,
      96
    );
    table_width := greatest(
      32,
      least(table_width, 600, p_logical_width::double precision, p_logical_height::double precision)
    );
    table_height := table_width;
  else
    table_width := greatest(
      32,
      least(coalesce(raw_width, raw_size, 120), 600, p_logical_width::double precision)
    );
    table_height := greatest(
      32,
      least(coalesce(raw_height, raw_size, 80), 600, p_logical_height::double precision)
    );
  end if;

  if (raw_size is not null and canonical_shape = 'circle' and raw_size <> table_width)
     or (raw_width is not null and canonical_shape = 'rectangle' and raw_width <> table_width)
     or (raw_height is not null and canonical_shape = 'rectangle' and raw_height <> table_height) then
    adjustments := adjustments || jsonb_build_array('size_clamped_to_canonical_bounds');
  end if;

  if scaled_x is not null and scaled_y is not null then
    position_x := least(
      greatest(scaled_x, table_width / 2),
      p_logical_width - table_width / 2
    );
    position_y := least(
      greatest(scaled_y, table_height / 2),
      p_logical_height - table_height / 2
    );
    if position_x <> scaled_x or position_y <> scaled_y then
      adjustments := adjustments || jsonb_build_array('position_clamped_to_plan_bounds');
    end if;
  end if;

  raw_capacity := coalesce(
    public.legacy_floor_plan_number(p_table -> 'maxPeople'),
    public.legacy_floor_plan_number(p_table -> 'max_people'),
    public.legacy_floor_plan_number(p_table -> 'seats'),
    public.legacy_floor_plan_number(p_table -> 'capacity')
  );
  if raw_capacity is null then
    table_capacity := 10;
    adjustments := adjustments || jsonb_build_array('capacity_defaulted_to_10');
  else
    table_capacity := round(greatest(1, least(raw_capacity, 200)))::integer;
    if table_capacity::double precision <> raw_capacity then
      adjustments := adjustments || jsonb_build_array('capacity_clamped_to_canonical_bounds');
    end if;
  end if;

  table_rotation := greatest(
    -360,
    least(coalesce(public.legacy_floor_plan_number(p_table -> 'rotation'), 0), 360)
  );
  if public.legacy_floor_plan_number(p_table -> 'rotation') is not null
     and table_rotation <> public.legacy_floor_plan_number(p_table -> 'rotation') then
    adjustments := adjustments || jsonb_build_array('rotation_clamped_to_canonical_bounds');
  end if;

  return jsonb_build_object(
    'valid', valid,
    'issue_code', issue_code,
    'code', table_code,
    'label', table_label,
    'capacity', table_capacity,
    'shape', canonical_shape,
    'x', position_x,
    'y', position_y,
    'width', table_width,
    'height', table_height,
    'rotation', table_rotation,
    'adjustments', adjustments
  );
end;
$$;

create or replace function public.migrate_legacy_floor_plans()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  migration_run_id uuid;
  source_record record;
  plan_record record;
  table_record record;
  table_group record;
  canonical_plan public.floor_plans%rowtype;
  canonical_table public.seating_tables%rowtype;
  candidate_event_ids uuid[];
  mapped_event_id uuid;
  source_snapshot_id uuid;
  source_payload jsonb;
  source_key_value text;
  source_checksum_value text;
  source_count_value integer := 0;
  mapped_source_count_value integer := 0;
  imported_table_count_value integer := 0;
  matched_table_count_value integer := 0;
  unresolved_issue_count_value integer := 0;
  source_checksum_aggregate text;
  target_checksum_aggregate text;
  relation_has_expected_shape boolean;
  layout_value jsonb;
  tables_value jsonb;
  logical_width_value integer;
  logical_height_value integer;
  raw_width_value double precision;
  raw_height_value double precision;
  background_ref_value text;
  background_opacity_value double precision;
  background_definition jsonb;
  background_definition_count integer;
  safe_background_path text;
  plan_definition jsonb;
  normalized_table jsonb;
  table_definition jsonb;
  canonical_definition jsonb;
  canonical_table_ids uuid[];
  chosen_table_id uuid;
  source_refs jsonb;
  table_is_default_backfill boolean;
  migration_status text;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('legacy-floor-plan-reconciliation', 0)
  );

  insert into public.legacy_floor_plan_migration_runs(status)
  values ('running')
  returning id into migration_run_id;

  -- Temporary working sets are session-local and disappear with the migration
  -- transaction. Persistent source snapshots and audit rows remain available.
  drop table if exists pg_temp.legacy_floor_plan_candidates;
  drop table if exists pg_temp.legacy_floor_plan_event_decisions;
  drop table if exists pg_temp.legacy_floor_table_candidates;

  create temporary table legacy_floor_plan_candidates (
    source_id uuid primary key,
    source_kind text not null,
    source_key text not null,
    event_id uuid not null,
    source_checksum text not null,
    logical_width integer not null,
    logical_height integer not null,
    background_ref text,
    background_opacity double precision not null,
    plan_definition jsonb not null,
    tables jsonb not null
  ) on commit drop;

  create temporary table legacy_floor_plan_event_decisions (
    event_id uuid primary key,
    source_count integer not null,
    distinct_definition_count integer not null,
    chosen_definition jsonb,
    source_refs jsonb not null,
    can_import boolean not null default false
  ) on commit drop;

  create temporary table legacy_floor_table_candidates (
    source_id uuid not null,
    source_kind text not null,
    source_key text not null,
    source_checksum text not null,
    event_id uuid not null,
    ordinal integer not null,
    table_code text,
    raw_table jsonb not null,
    normalized_table jsonb not null,
    canonical_definition jsonb,
    valid boolean not null,
    primary key (source_id, ordinal)
  ) on commit drop;

  -- Prototype A: singular floor_plan(table_name, layout jsonb).
  if to_regclass('public.floor_plan') is not null then
    select count(*) = 2
    into relation_has_expected_shape
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'floor_plan'
      and (
        (column_name = 'table_name' and udt_name = 'text')
        or (column_name = 'layout' and udt_name = 'jsonb')
      );

    if relation_has_expected_shape then
      execute 'lock table public.floor_plan in share mode';
      for source_record in execute
        'select source.table_name::text as source_key, to_jsonb(source) as payload
           from public.floor_plan source
          order by source.table_name::text'
      loop
        source_payload := source_record.payload;
        source_checksum_value := encode(extensions.digest(source_payload::text, 'sha256'), 'hex');
        source_key_value := coalesce(
          nullif(btrim(source_record.source_key), ''),
          '<missing>:' || substr(source_checksum_value, 1, 16)
        );

        select coalesce(array_agg(event.id order by event.id), '{}'::uuid[])
        into candidate_event_ids
        from public.events event
        where event.legacy_table_name = nullif(btrim(source_record.source_key), '');

        mapped_event_id := case
          when cardinality(candidate_event_ids) = 1 then candidate_event_ids[1]
          else null
        end;

        insert into public.legacy_floor_plan_sources (
          source_relation,
          source_kind,
          source_key,
          raw_payload,
          source_checksum,
          event_candidates,
          event_id,
          mapping_status,
          last_captured_at,
          last_seen_run_id
        ) values (
          'public.floor_plan',
          'table_name_layout',
          source_key_value,
          source_payload,
          source_checksum_value,
          candidate_event_ids,
          mapped_event_id,
          case
            when cardinality(candidate_event_ids) = 0 then 'unmapped'
            when cardinality(candidate_event_ids) = 1 then 'mapped'
            else 'ambiguous'
          end,
          now(),
          migration_run_id
        )
        on conflict (source_relation, source_key) do update set
          source_kind = excluded.source_kind,
          raw_payload = excluded.raw_payload,
          source_checksum = excluded.source_checksum,
          event_candidates = excluded.event_candidates,
          event_id = excluded.event_id,
          mapping_status = excluded.mapping_status,
          last_captured_at = now(),
          last_seen_run_id = excluded.last_seen_run_id
        returning id into source_snapshot_id;

        insert into public.legacy_floor_plan_source_versions (
          source_id, source_checksum, raw_payload, last_seen_at, last_seen_run_id
        ) values (
          source_snapshot_id,
          source_checksum_value,
          source_payload,
          now(),
          migration_run_id
        )
        on conflict (source_id, source_checksum) do update set
          last_seen_at = now(),
          last_seen_run_id = excluded.last_seen_run_id;

        source_count_value := source_count_value + 1;
        if mapped_event_id is not null then
          mapped_source_count_value := mapped_source_count_value + 1;
        else
          insert into public.legacy_floor_plan_reconciliation_audit (
            run_id, source_id, status, issue_code, details
          ) values (
            migration_run_id,
            source_snapshot_id,
            'issue',
            case
              when cardinality(candidate_event_ids) = 0 then 'source_event_unmapped'
              else 'source_event_ambiguous'
            end,
            jsonb_build_object(
              'source_relation', 'public.floor_plan',
              'source_key', source_key_value,
              'event_candidates', to_jsonb(candidate_event_ids),
              'source_checksum', source_checksum_value
            )
          );
        end if;
      end loop;
    else
      insert into public.legacy_floor_plan_reconciliation_audit (
        run_id, status, issue_code, details
      ) values (
        migration_run_id,
        'issue',
        'unsupported_source_shape',
        jsonb_build_object('source_relation', 'public.floor_plan')
      );
    end if;
  end if;

  -- Prototype B: the plural relation was renamed by migration 000 so the
  -- canonical public.floor_plans relation could be created safely.
  if to_regclass('public.floor_plans_legacy_admin') is not null then
    select count(*) = 4
    into relation_has_expected_shape
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'floor_plans_legacy_admin'
      and (
        (column_name in ('admin_username', 'image_url') and udt_name = 'text')
        or (column_name = 'opacity' and udt_name in ('float4', 'float8', 'numeric'))
        or (column_name = 'floor_tables' and udt_name = 'jsonb')
      );

    if relation_has_expected_shape then
      execute 'lock table public.floor_plans_legacy_admin in share mode';
      for source_record in execute
        'select source.admin_username::text as source_key, to_jsonb(source) as payload
           from public.floor_plans_legacy_admin source
          order by source.admin_username::text'
      loop
        source_payload := source_record.payload;
        source_checksum_value := encode(extensions.digest(source_payload::text, 'sha256'), 'hex');
        source_key_value := coalesce(
          nullif(btrim(source_record.source_key), ''),
          '<missing>:' || substr(source_checksum_value, 1, 16)
        );

        select coalesce(array_agg(distinct candidate.event_id order by candidate.event_id), '{}'::uuid[])
        into candidate_event_ids
        from (
          select event_admin.event_id
          from public.admin administrator
          join public.event_admins event_admin
            on event_admin.admin_id = administrator.id
           and event_admin.active
          where lower(btrim(administrator.username)) = lower(btrim(source_record.source_key))

          union

          select event.id
          from public.admin administrator
          join public.events event
            on event.legacy_table_name = administrator.table_name
          where lower(btrim(administrator.username)) = lower(btrim(source_record.source_key))
        ) candidate;

        mapped_event_id := case
          when cardinality(candidate_event_ids) = 1 then candidate_event_ids[1]
          else null
        end;

        insert into public.legacy_floor_plan_sources (
          source_relation,
          source_kind,
          source_key,
          raw_payload,
          source_checksum,
          event_candidates,
          event_id,
          mapping_status,
          last_captured_at,
          last_seen_run_id
        ) values (
          'public.floor_plans_legacy_admin',
          'admin_floor_tables',
          source_key_value,
          source_payload,
          source_checksum_value,
          candidate_event_ids,
          mapped_event_id,
          case
            when cardinality(candidate_event_ids) = 0 then 'unmapped'
            when cardinality(candidate_event_ids) = 1 then 'mapped'
            else 'ambiguous'
          end,
          now(),
          migration_run_id
        )
        on conflict (source_relation, source_key) do update set
          source_kind = excluded.source_kind,
          raw_payload = excluded.raw_payload,
          source_checksum = excluded.source_checksum,
          event_candidates = excluded.event_candidates,
          event_id = excluded.event_id,
          mapping_status = excluded.mapping_status,
          last_captured_at = now(),
          last_seen_run_id = excluded.last_seen_run_id
        returning id into source_snapshot_id;

        insert into public.legacy_floor_plan_source_versions (
          source_id, source_checksum, raw_payload, last_seen_at, last_seen_run_id
        ) values (
          source_snapshot_id,
          source_checksum_value,
          source_payload,
          now(),
          migration_run_id
        )
        on conflict (source_id, source_checksum) do update set
          last_seen_at = now(),
          last_seen_run_id = excluded.last_seen_run_id;

        source_count_value := source_count_value + 1;
        if mapped_event_id is not null then
          mapped_source_count_value := mapped_source_count_value + 1;
        else
          insert into public.legacy_floor_plan_reconciliation_audit (
            run_id, source_id, status, issue_code, details
          ) values (
            migration_run_id,
            source_snapshot_id,
            'issue',
            case
              when cardinality(candidate_event_ids) = 0 then 'source_admin_unmapped'
              else 'source_admin_ambiguous'
            end,
            jsonb_build_object(
              'source_relation', 'public.floor_plans_legacy_admin',
              'admin_username', source_key_value,
              'event_candidates', to_jsonb(candidate_event_ids),
              'source_checksum', source_checksum_value
            )
          );
        end if;
      end loop;
    else
      insert into public.legacy_floor_plan_reconciliation_audit (
        run_id, status, issue_code, details
      ) values (
        migration_run_id,
        'issue',
        'unsupported_source_shape',
        jsonb_build_object('source_relation', 'public.floor_plans_legacy_admin')
      );
    end if;
  end if;

  insert into public.legacy_floor_plan_reconciliation_audit (
    run_id, event_id, source_id, status, issue_code, details
  )
  select
    migration_run_id,
    source.event_id,
    source.id,
    'issue',
    'source_missing_on_current_run',
    jsonb_build_object(
      'source_relation', source.source_relation,
      'source_key', source.source_key,
      'last_source_checksum', source.source_checksum
    )
  from public.legacy_floor_plan_sources source
  where source.last_seen_run_id is distinct from migration_run_id;

  -- Convert each mapped source plan into a common logical coordinate system.
  for source_record in
    select source.*
    from public.legacy_floor_plan_sources source
    where source.last_seen_run_id = migration_run_id
      and source.mapping_status = 'mapped'
    order by source.source_relation, source.source_key
  loop
    if source_record.source_kind = 'table_name_layout' then
      layout_value := source_record.raw_payload -> 'layout';
      if jsonb_typeof(layout_value) <> 'object' then
        insert into public.legacy_floor_plan_reconciliation_audit (
          run_id, event_id, source_id, status, issue_code, details
        ) values (
          migration_run_id,
          source_record.event_id,
          source_record.id,
          'issue',
          'layout_payload_not_object',
          jsonb_build_object('source_checksum', source_record.source_checksum)
        );
        continue;
      end if;
      raw_width_value := public.legacy_floor_plan_number(layout_value -> 'width');
      raw_height_value := public.legacy_floor_plan_number(layout_value -> 'height');
      logical_width_value := round(
        greatest(480, least(coalesce(raw_width_value, 1200), 4000))
      )::integer;
      logical_height_value := round(
        greatest(320, least(coalesce(raw_height_value, 800), 3000))
      )::integer;
      tables_value := layout_value -> 'tables';
      background_ref_value := case jsonb_typeof(layout_value -> 'background')
        when 'object' then coalesce(
          layout_value #>> '{background,url}',
          layout_value #>> '{background,path}'
        )
        when 'string' then layout_value #>> '{background}'
        else null
      end;
      background_opacity_value := coalesce(
        public.legacy_floor_plan_number(layout_value #> '{background,opacity}'),
        0.7
      );
    else
      logical_width_value := 1200;
      logical_height_value := 800;
      raw_width_value := logical_width_value;
      raw_height_value := logical_height_value;
      tables_value := source_record.raw_payload -> 'floor_tables';
      background_ref_value := nullif(btrim(source_record.raw_payload ->> 'image_url'), '');
      background_opacity_value := coalesce(
        public.legacy_floor_plan_number(source_record.raw_payload -> 'opacity'),
        0.7
      );
    end if;

    background_ref_value := nullif(btrim(background_ref_value), '');
    background_opacity_value := greatest(0, least(1, background_opacity_value));

    if jsonb_typeof(tables_value) <> 'array' then
      insert into public.legacy_floor_plan_reconciliation_audit (
        run_id, event_id, source_id, status, issue_code, details
      ) values (
        migration_run_id,
        source_record.event_id,
        source_record.id,
        'issue',
        'tables_payload_not_array',
        jsonb_build_object('source_checksum', source_record.source_checksum)
      );
      tables_value := '[]'::jsonb;
    end if;

    plan_definition := jsonb_build_object(
      'logical_width', logical_width_value,
      'logical_height', logical_height_value
    );

    insert into pg_temp.legacy_floor_plan_candidates (
      source_id,
      source_kind,
      source_key,
      event_id,
      source_checksum,
      logical_width,
      logical_height,
      background_ref,
      background_opacity,
      plan_definition,
      tables
    ) values (
      source_record.id,
      source_record.source_kind,
      source_record.source_key,
      source_record.event_id,
      source_record.source_checksum,
      logical_width_value,
      logical_height_value,
      background_ref_value,
      background_opacity_value,
      plan_definition,
      tables_value
    );
  end loop;

  insert into pg_temp.legacy_floor_plan_event_decisions (
    event_id,
    source_count,
    distinct_definition_count,
    chosen_definition,
    source_refs,
    can_import
  )
  select
    candidate.event_id,
    count(*)::integer,
    count(distinct candidate.plan_definition)::integer,
    (array_agg(candidate.plan_definition order by candidate.source_id))[1],
    jsonb_agg(
      jsonb_build_object(
        'source_id', candidate.source_id,
        'source_kind', candidate.source_kind,
        'source_key', candidate.source_key,
        'source_checksum', candidate.source_checksum,
        'definition', candidate.plan_definition,
        'background_ref', candidate.background_ref,
        'background_opacity', candidate.background_opacity
      )
      order by candidate.source_kind, candidate.source_key
    ),
    count(distinct candidate.plan_definition) = 1
  from pg_temp.legacy_floor_plan_candidates candidate
  group by candidate.event_id;

  insert into public.legacy_floor_plan_reconciliation_audit (
    run_id, event_id, status, issue_code, details
  )
  select
    migration_run_id,
    decision.event_id,
    'issue',
    'conflicting_plan_definitions',
    jsonb_build_object('sources', decision.source_refs)
  from pg_temp.legacy_floor_plan_event_decisions decision
  where decision.distinct_definition_count > 1;

  -- Establish a revision-zero baseline only when no canonical editor save has
  -- happened. A positive revision belongs to the new editor and is never
  -- overwritten by legacy reconciliation.
  for plan_record in
    select decision.*
    from pg_temp.legacy_floor_plan_event_decisions decision
    where decision.can_import
    order by decision.event_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('floor-plan:' || plan_record.event_id::text, 0)
    );

    select * into canonical_plan
    from public.floor_plans floor_plan
    where floor_plan.event_id = plan_record.event_id
    for update;

    if found and canonical_plan.revision > 0 then
      update pg_temp.legacy_floor_plan_event_decisions
      set can_import = false
      where event_id = plan_record.event_id;

      insert into public.legacy_floor_plan_reconciliation_audit (
        run_id, event_id, status, issue_code, details
      ) values (
        migration_run_id,
        plan_record.event_id,
        'issue',
        'canonical_plan_already_edited',
        jsonb_build_object(
          'canonical_revision', canonical_plan.revision,
          'legacy_sources', plan_record.source_refs
        )
      );
      continue;
    end if;

    select
      count(distinct case
        when candidate.background_ref is null
          then jsonb_build_object('background_ref', null)
        else jsonb_build_object(
          'background_ref', candidate.background_ref,
          'background_opacity', candidate.background_opacity
        )
      end)::integer,
      (array_agg(
        case
          when candidate.background_ref is null
            then jsonb_build_object('background_ref', null)
          else jsonb_build_object(
            'background_ref', candidate.background_ref,
            'background_opacity', candidate.background_opacity
          )
        end
        order by candidate.source_id
      ))[1]
    into background_definition_count, background_definition
    from pg_temp.legacy_floor_plan_candidates candidate
    where candidate.event_id = plan_record.event_id;

    if background_definition_count > 1 then
      insert into public.legacy_floor_plan_reconciliation_audit (
        run_id, event_id, status, issue_code, details
      ) values (
        migration_run_id,
        plan_record.event_id,
        'issue',
        'conflicting_background_definitions',
        jsonb_build_object('legacy_sources', plan_record.source_refs)
      );
      background_ref_value := null;
      background_opacity_value := null;
    else
      background_ref_value := nullif(background_definition ->> 'background_ref', '');
      background_opacity_value := public.legacy_floor_plan_number(
        background_definition -> 'background_opacity'
      );
    end if;
    safe_background_path := case
      when public.is_canonical_floor_plan_background_path(
        plan_record.event_id,
        background_ref_value
      )
      then background_ref_value
      else null
    end;

    if canonical_plan.id is null then
      insert into public.floor_plans (
        event_id, logical_width, logical_height, background_path, revision
      ) values (
        plan_record.event_id,
        (plan_record.chosen_definition ->> 'logical_width')::integer,
        (plan_record.chosen_definition ->> 'logical_height')::integer,
        safe_background_path,
        0
      )
      returning * into canonical_plan;
    else
      update public.floor_plans floor_plan set
        logical_width = (plan_record.chosen_definition ->> 'logical_width')::integer,
        logical_height = (plan_record.chosen_definition ->> 'logical_height')::integer,
        background_path = coalesce(safe_background_path, floor_plan.background_path),
        updated_at = now()
      where floor_plan.event_id = plan_record.event_id
      returning * into canonical_plan;
    end if;

    insert into public.legacy_floor_plan_reconciliation_audit (
      run_id, event_id, status, details
    ) values (
      migration_run_id,
      plan_record.event_id,
      'imported',
      jsonb_build_object(
        'entity', 'floor_plan',
        'canonical_floor_plan_id', canonical_plan.id,
        'definition', plan_record.chosen_definition,
        'legacy_sources', plan_record.source_refs
      )
    );

    if background_ref_value is not null and safe_background_path is null then
      if canonical_plan.background_path is null then
        insert into public.legacy_floor_plan_reconciliation_audit (
          run_id, event_id, status, issue_code, details
        ) values (
          migration_run_id,
          plan_record.event_id,
          'issue',
          'background_requires_private_copy',
          jsonb_build_object(
            'legacy_background_ref', background_ref_value,
            'legacy_sources', plan_record.source_refs,
            'required_format',
              plan_record.event_id::text || '/<uuid-v4>.(jpg|png|webp)'
          )
        );
      else
        insert into public.legacy_floor_plan_reconciliation_audit (
          run_id, event_id, status, details
        ) values (
          migration_run_id,
          plan_record.event_id,
          'matched',
          jsonb_build_object(
            'entity', 'background',
            'legacy_background_ref', background_ref_value,
            'canonical_background_path', canonical_plan.background_path
          )
        );
      end if;
    end if;

    if background_ref_value is not null
       and background_opacity_value is not null
       and background_opacity_value <> 1 then
      insert into public.legacy_floor_plan_reconciliation_audit (
        run_id, event_id, status, issue_code, details
      ) values (
        migration_run_id,
        plan_record.event_id,
        'issue',
        'background_opacity_requires_visual_review',
        jsonb_build_object(
          'legacy_opacity', background_opacity_value,
          'legacy_background_ref', background_ref_value,
          'legacy_sources', plan_record.source_refs
        )
      );
    end if;
  end loop;

  -- Normalize both table JSON shapes. The singular prototype uses logical
  -- pixels; the admin prototype stores centre coordinates as percentages.
  for plan_record in
    select candidate.*
    from pg_temp.legacy_floor_plan_candidates candidate
    order by candidate.event_id, candidate.source_kind, candidate.source_key
  loop
    for table_record in
      select item.value as raw_table, item.ordinality::integer as ordinal
      from jsonb_array_elements(plan_record.tables) with ordinality item(value, ordinality)
    loop
      normalized_table := public.normalize_legacy_floor_table(
        plan_record.source_kind,
        table_record.raw_table,
        plan_record.logical_width,
        plan_record.logical_height
      );

      table_definition := case
        when coalesce((normalized_table ->> 'valid')::boolean, false) then
          normalized_table - 'valid' - 'issue_code' - 'adjustments'
        else null
      end;

      insert into pg_temp.legacy_floor_table_candidates (
        source_id,
        source_kind,
        source_key,
        source_checksum,
        event_id,
        ordinal,
        table_code,
        raw_table,
        normalized_table,
        canonical_definition,
        valid
      ) values (
        plan_record.source_id,
        plan_record.source_kind,
        plan_record.source_key,
        plan_record.source_checksum,
        plan_record.event_id,
        table_record.ordinal,
        normalized_table ->> 'code',
        table_record.raw_table,
        normalized_table,
        table_definition,
        coalesce((normalized_table ->> 'valid')::boolean, false)
      );

      if not coalesce((normalized_table ->> 'valid')::boolean, false) then
        insert into public.legacy_floor_plan_reconciliation_audit (
          run_id, event_id, source_id, table_code, status, issue_code, details
        ) values (
          migration_run_id,
          plan_record.event_id,
          plan_record.source_id,
          normalized_table ->> 'code',
          'issue',
          normalized_table ->> 'issue_code',
          jsonb_build_object(
            'ordinal', table_record.ordinal,
            'raw_table', table_record.raw_table,
            'source_checksum', plan_record.source_checksum
          )
        );
      end if;
    end loop;
  end loop;

  for table_group in
    select candidate.event_id, count(distinct candidate.table_code)::integer as table_count
    from pg_temp.legacy_floor_table_candidates candidate
    where candidate.valid
    group by candidate.event_id
    having count(distinct candidate.table_code) > 300
  loop
    update pg_temp.legacy_floor_plan_event_decisions
    set can_import = false
    where event_id = table_group.event_id;

    insert into public.legacy_floor_plan_reconciliation_audit (
      run_id, event_id, status, issue_code, details
    ) values (
      migration_run_id,
      table_group.event_id,
      'issue',
      'too_many_tables_for_canonical_editor',
      jsonb_build_object('distinct_table_count', table_group.table_count, 'maximum', 300)
    );
  end loop;

  for table_group in
    select
      candidate.event_id,
      candidate.table_code,
      count(*)::integer as candidate_count,
      count(distinct candidate.canonical_definition)::integer as definition_count,
      jsonb_agg(
        jsonb_build_object(
          'source_id', candidate.source_id,
          'source_kind', candidate.source_kind,
          'source_key', candidate.source_key,
          'source_checksum', candidate.source_checksum,
          'ordinal', candidate.ordinal,
          'definition', candidate.canonical_definition,
          'adjustments', candidate.normalized_table -> 'adjustments'
        )
        order by candidate.source_kind, candidate.source_key, candidate.ordinal
      ) as source_refs
    from pg_temp.legacy_floor_table_candidates candidate
    where candidate.valid
    group by candidate.event_id, candidate.table_code
    order by candidate.event_id, candidate.table_code
  loop
    if exists (
      select 1
      from pg_temp.legacy_floor_table_candidates duplicate
      where duplicate.event_id = table_group.event_id
        and duplicate.table_code = table_group.table_code
        and duplicate.valid
      group by duplicate.source_id
      having count(*) > 1
    ) then
      insert into public.legacy_floor_plan_reconciliation_audit (
        run_id, event_id, table_code, status, issue_code, details
      ) values (
        migration_run_id,
        table_group.event_id,
        table_group.table_code,
        'issue',
        'duplicate_table_code_within_source',
        jsonb_build_object('sources', table_group.source_refs)
      );
      continue;
    end if;

    if table_group.definition_count > 1 then
      insert into public.legacy_floor_plan_reconciliation_audit (
        run_id, event_id, table_code, status, issue_code, details
      ) values (
        migration_run_id,
        table_group.event_id,
        table_group.table_code,
        'issue',
        'conflicting_table_definitions',
        jsonb_build_object('sources', table_group.source_refs)
      );
      continue;
    end if;

    if not coalesce((
      select decision.can_import
      from pg_temp.legacy_floor_plan_event_decisions decision
      where decision.event_id = table_group.event_id
    ), false) then
      insert into public.legacy_floor_plan_reconciliation_audit (
        run_id, event_id, table_code, status, details
      ) values (
        migration_run_id,
        table_group.event_id,
        table_group.table_code,
        'skipped',
        jsonb_build_object(
          'reason', 'event_plan_not_importable',
          'sources', table_group.source_refs
        )
      );
      continue;
    end if;

    select candidate.canonical_definition
    into table_definition
    from pg_temp.legacy_floor_table_candidates candidate
    where candidate.event_id = table_group.event_id
      and candidate.table_code = table_group.table_code
      and candidate.valid
    order by candidate.source_kind, candidate.source_key, candidate.ordinal
    limit 1;

    select coalesce(array_agg(seating_table.id order by seating_table.id), '{}'::uuid[])
    into canonical_table_ids
    from public.seating_tables seating_table
    where seating_table.event_id = table_group.event_id
      and public.normalize_legacy_floor_table_code(seating_table.code) = table_group.table_code;

    if cardinality(canonical_table_ids) > 1 then
      insert into public.legacy_floor_plan_reconciliation_audit (
        run_id, event_id, table_code, status, issue_code, details
      ) values (
        migration_run_id,
        table_group.event_id,
        table_group.table_code,
        'issue',
        'multiple_canonical_code_matches',
        jsonb_build_object(
          'canonical_table_ids', to_jsonb(canonical_table_ids),
          'sources', table_group.source_refs
        )
      );
      continue;
    end if;

    chosen_table_id := case
      when cardinality(canonical_table_ids) = 1 then canonical_table_ids[1]
      else null
    end;

    if chosen_table_id is not null then
      select * into canonical_table
      from public.seating_tables seating_table
      where seating_table.id = chosen_table_id
        and seating_table.event_id = table_group.event_id
      for update;

      canonical_definition := jsonb_build_object(
        'code', public.normalize_legacy_floor_table_code(canonical_table.code),
        'label', canonical_table.label,
        'capacity', canonical_table.capacity,
        'shape', canonical_table.shape,
        'x', canonical_table.x,
        'y', canonical_table.y,
        'width', canonical_table.width,
        'height', canonical_table.height,
        'rotation', canonical_table.rotation
      );

      if canonical_definition = table_definition then
        matched_table_count_value := matched_table_count_value + 1;
        insert into public.legacy_floor_plan_reconciliation_audit (
          run_id, event_id, table_code, canonical_table_id, status, details
        ) values (
          migration_run_id,
          table_group.event_id,
          table_group.table_code,
          canonical_table.id,
          'matched',
          jsonb_build_object('entity', 'seating_table', 'sources', table_group.source_refs)
        );
        continue;
      end if;

      table_is_default_backfill :=
        canonical_table.capacity = 10
        and canonical_table.shape = 'circle'
        and canonical_table.x = 80
        and canonical_table.y = 80
        and canonical_table.width = 96
        and canonical_table.height = 96
        and canonical_table.rotation = 0
        and canonical_table.label in (
          canonical_table.code,
          'Mesa ' || canonical_table.code
        );

      if not table_is_default_backfill then
        insert into public.legacy_floor_plan_reconciliation_audit (
          run_id, event_id, table_code, canonical_table_id, status, issue_code, details
        ) values (
          migration_run_id,
          table_group.event_id,
          table_group.table_code,
          canonical_table.id,
          'issue',
          'canonical_table_has_nondefault_values',
          jsonb_build_object(
            'canonical_definition', canonical_definition,
            'legacy_definition', table_definition,
            'sources', table_group.source_refs
          )
        );
        continue;
      end if;

      update public.seating_tables seating_table set
        label = table_definition ->> 'label',
        capacity = (table_definition ->> 'capacity')::integer,
        shape = table_definition ->> 'shape',
        x = (table_definition ->> 'x')::double precision,
        y = (table_definition ->> 'y')::double precision,
        width = (table_definition ->> 'width')::double precision,
        height = (table_definition ->> 'height')::double precision,
        rotation = (table_definition ->> 'rotation')::double precision,
        updated_at = now()
      where seating_table.id = canonical_table.id
        and seating_table.event_id = table_group.event_id;

      chosen_table_id := canonical_table.id;
    else
      insert into public.seating_tables (
        event_id, code, label, capacity, shape, x, y, width, height, rotation
      ) values (
        table_group.event_id,
        table_definition ->> 'code',
        table_definition ->> 'label',
        (table_definition ->> 'capacity')::integer,
        table_definition ->> 'shape',
        (table_definition ->> 'x')::double precision,
        (table_definition ->> 'y')::double precision,
        (table_definition ->> 'width')::double precision,
        (table_definition ->> 'height')::double precision,
        (table_definition ->> 'rotation')::double precision
      )
      returning id into chosen_table_id;
    end if;

    imported_table_count_value := imported_table_count_value + 1;
    insert into public.legacy_floor_plan_reconciliation_audit (
      run_id, event_id, table_code, canonical_table_id, status, details
    ) values (
      migration_run_id,
      table_group.event_id,
      table_group.table_code,
      chosen_table_id,
      'imported',
      jsonb_build_object(
        'entity', 'seating_table',
        'definition', table_definition,
        'sources', table_group.source_refs
      )
    );
  end loop;

  -- If an operator already reviewed the exact same issue payload, preserve the
  -- resolution on a repeatable delta run. Changed source checksums produce a
  -- different fingerprint and must be reviewed again.
  with prior_resolution as (
    select distinct on (audit.issue_fingerprint)
      audit.issue_fingerprint,
      audit.resolved_at,
      audit.resolved_by,
      audit.resolution_note
    from public.legacy_floor_plan_reconciliation_audit audit
    where audit.run_id <> migration_run_id
      and audit.status = 'issue'
      and audit.resolved_at is not null
    order by audit.issue_fingerprint, audit.resolved_at desc, audit.id desc
  )
  update public.legacy_floor_plan_reconciliation_audit current_audit set
    resolved_at = prior_resolution.resolved_at,
    resolved_by = prior_resolution.resolved_by,
    resolution_note = prior_resolution.resolution_note
  from prior_resolution
  where current_audit.run_id = migration_run_id
    and current_audit.status = 'issue'
    and current_audit.issue_fingerprint = prior_resolution.issue_fingerprint;

  select count(*)::integer
  into unresolved_issue_count_value
  from public.legacy_floor_plan_reconciliation_audit audit
  where audit.run_id = migration_run_id
    and audit.status = 'issue'
    and audit.resolved_at is null;

  select encode(
    extensions.digest(
      coalesce(
        string_agg(
          source.source_relation || '|' || source.source_key || '|' || source.source_checksum,
          E'\n'
          order by source.source_relation, source.source_key
        ),
        ''
      ),
      'sha256'
    ),
    'hex'
  )
  into source_checksum_aggregate
  from public.legacy_floor_plan_sources source
  where source.last_seen_run_id = migration_run_id;

  select encode(
    extensions.digest(
      coalesce(string_agg(target.payload::text, E'\n' order by target.sort_key), ''),
      'sha256'
    ),
    'hex'
  )
  into target_checksum_aggregate
  from (
    select
      event.id::text || '|plan' as sort_key,
      jsonb_build_object(
        'event_id', event.id,
        'logical_width', floor_plan.logical_width,
        'logical_height', floor_plan.logical_height,
        'background_path', floor_plan.background_path,
        'revision', floor_plan.revision
      ) as payload
    from public.events event
    join public.floor_plans floor_plan on floor_plan.event_id = event.id
    where exists (
      select 1
      from public.legacy_floor_plan_sources source
      where source.last_seen_run_id = migration_run_id
        and source.event_id = event.id
    )

    union all

    select
      seating_table.event_id::text || '|table|' || lower(seating_table.code) as sort_key,
      jsonb_build_object(
        'event_id', seating_table.event_id,
        'id', seating_table.id,
        'code', seating_table.code,
        'label', seating_table.label,
        'capacity', seating_table.capacity,
        'shape', seating_table.shape,
        'x', seating_table.x,
        'y', seating_table.y,
        'width', seating_table.width,
        'height', seating_table.height,
        'rotation', seating_table.rotation
      ) as payload
    from public.seating_tables seating_table
    where exists (
      select 1
      from public.legacy_floor_plan_sources source
      where source.last_seen_run_id = migration_run_id
        and source.event_id = seating_table.event_id
    )
  ) target;

  migration_status := case
    when unresolved_issue_count_value = 0 then 'completed'
    else 'needs_review'
  end;

  update public.legacy_floor_plan_migration_runs migration_run set
    status = migration_status,
    source_count = source_count_value,
    mapped_source_count = mapped_source_count_value,
    imported_table_count = imported_table_count_value,
    matched_table_count = matched_table_count_value,
    unresolved_issue_count = unresolved_issue_count_value,
    source_checksum = source_checksum_aggregate,
    target_checksum = target_checksum_aggregate,
    finished_at = now()
  where migration_run.id = migration_run_id;

  return jsonb_build_object(
    'run_id', migration_run_id,
    'status', migration_status,
    'source_count', source_count_value,
    'mapped_source_count', mapped_source_count_value,
    'imported_table_count', imported_table_count_value,
    'matched_table_count', matched_table_count_value,
    'unresolved_issue_count', unresolved_issue_count_value,
    'source_checksum', source_checksum_aggregate,
    'target_checksum', target_checksum_aggregate
  );
end;
$$;

create or replace function public.guard_legacy_floor_plan_cutover()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_run_id uuid;
  blocking_issue_count integer;
begin
  if old.legacy_reads_enabled and not new.legacy_reads_enabled then
    select migration_run.id
    into latest_run_id
    from public.legacy_floor_plan_migration_runs migration_run
    where migration_run.finished_at is not null
    order by migration_run.started_at desc, migration_run.id desc
    limit 1;

    if latest_run_id is null then
      raise exception using
        errcode = '55000',
        message = 'legacy_floor_plan_reconciliation_missing',
        hint = 'Run migrate_legacy_floor_plans before event cutover.';
    end if;

    select count(*)::integer
    into blocking_issue_count
    from public.legacy_floor_plan_reconciliation_audit audit
    where audit.run_id = latest_run_id
      and audit.status = 'issue'
      and audit.resolved_at is null
      and (audit.event_id = new.event_id or audit.event_id is null);

    if blocking_issue_count > 0 then
      raise exception using
        errcode = '55000',
        message = 'legacy_floor_plan_reconciliation_not_clean',
        detail = format(
          'event_id=%s run_id=%s unresolved_issues=%s',
          new.event_id,
          latest_run_id,
          blocking_issue_count
        ),
        hint = 'Resolve the latest floor-plan reconciliation report and rerun it before cutover.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists event_migration_state_guard_floor_plan_cutover
  on public.event_migration_state;
create trigger event_migration_state_guard_floor_plan_cutover
before update of legacy_reads_enabled on public.event_migration_state
for each row execute function public.guard_legacy_floor_plan_cutover();

create or replace view public.legacy_floor_plan_reconciliation_report
with (security_invoker = true)
as
select
  audit.id as audit_id,
  migration_run.id as run_id,
  migration_run.status as run_status,
  migration_run.started_at,
  migration_run.finished_at,
  event.slug as event_slug,
  source.source_relation,
  source.source_key,
  source.source_checksum,
  audit.table_code,
  audit.canonical_table_id,
  audit.status,
  audit.issue_code,
  audit.issue_fingerprint,
  audit.details,
  audit.resolved_at,
  audit.resolved_by,
  audit.resolution_note,
  audit.created_at
from public.legacy_floor_plan_reconciliation_audit audit
join public.legacy_floor_plan_migration_runs migration_run
  on migration_run.id = audit.run_id
left join public.events event on event.id = audit.event_id
left join public.legacy_floor_plan_sources source on source.id = audit.source_id;

revoke all on table public.legacy_floor_plan_migration_runs
  from public, anon, authenticated;
revoke all on table public.legacy_floor_plan_sources
  from public, anon, authenticated;
revoke all on table public.legacy_floor_plan_source_versions
  from public, anon, authenticated;
revoke all on table public.legacy_floor_plan_reconciliation_audit
  from public, anon, authenticated;
revoke all on table public.legacy_floor_plan_reconciliation_report
  from public, anon, authenticated;
revoke all on function public.normalize_legacy_floor_table_code(text)
  from public, anon, authenticated;
revoke all on function public.legacy_floor_plan_number(jsonb)
  from public, anon, authenticated;
revoke all on function public.normalize_legacy_floor_table(text, jsonb, integer, integer)
  from public, anon, authenticated;
revoke all on function public.migrate_legacy_floor_plans()
  from public, anon, authenticated;
revoke all on function public.guard_legacy_floor_plan_cutover()
  from public, anon, authenticated;

grant select, update on table public.legacy_floor_plan_migration_runs to service_role;
grant select, update on table public.legacy_floor_plan_sources to service_role;
grant select on table public.legacy_floor_plan_source_versions to service_role;
grant select, update on table public.legacy_floor_plan_reconciliation_audit to service_role;
grant select on table public.legacy_floor_plan_reconciliation_report to service_role;
grant execute on function public.normalize_legacy_floor_table_code(text) to service_role;
grant execute on function public.legacy_floor_plan_number(jsonb) to service_role;
grant execute on function public.normalize_legacy_floor_table(text, jsonb, integer, integer)
  to service_role;
grant execute on function public.migrate_legacy_floor_plans() to service_role;

comment on table public.legacy_floor_plan_sources is
  'Current checksummed snapshot of each legacy floor-plan source; raw JSON is retained even when mapping or reconciliation is ambiguous.';
comment on table public.legacy_floor_plan_source_versions is
  'Append-only evidence for every distinct source checksum observed across repeatable floor-plan reconciliation runs.';
comment on table public.legacy_floor_plan_reconciliation_audit is
  'Per-run table-code reconciliation decisions and reviewable ambiguities. Resolutions only carry forward while the issue fingerprint remains identical.';
comment on function public.migrate_legacy_floor_plans() is
  'Repeatable, non-destructive reconciliation of floor_plan and floor_plans_legacy_admin into canonical floor_plans/seating_tables.';
comment on function public.guard_legacy_floor_plan_cutover() is
  'Prevents event cutover while the latest floor-plan reconciliation has an unresolved event-specific or globally unmapped issue.';

select public.migrate_legacy_floor_plans();
