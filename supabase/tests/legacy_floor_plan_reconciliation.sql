-- Run only against an isolated database after all migrations. Every fixture is
-- wrapped in a transaction and rolled back.

begin;

create table if not exists public.floor_plan (
  table_name text primary key,
  layout jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.floor_plans_legacy_admin (
  admin_username text primary key,
  image_url text,
  opacity double precision,
  floor_tables jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.fixture_planos_legacy_rsvps (
  id uuid primary key,
  name text not null,
  attendance text,
  dietary_preferences text[],
  favorite_song text,
  drink text[],
  table_number text,
  tags uuid[],
  created_at timestamptz not null default now()
);

insert into public.legacy_rsvp_relations (
  table_name,
  relation_oid,
  source,
  approved_by,
  details
)
select
  'fixture_planos_legacy_rsvps',
  (inspection.diagnostics ->> 'relationOid')::oid,
  'manual_review',
  'migration-test',
  jsonb_build_object('inspection', inspection.diagnostics)
from (
  select public.inspect_legacy_rsvp_relation(
    'fixture_planos_legacy_rsvps'
  ) as diagnostics
) inspection
where (inspection.diagnostics ->> 'valid')::boolean;

insert into public.events (
  id, slug, display_name, legacy_table_name, rsvp_status
) values (
  '70000000-0000-4000-8000-000000000001',
  'fixture-planos-legacy',
  'Fixture planos legacy',
  'fixture_planos_legacy_rsvps',
  'closed'
)
on conflict (id) do update set
  slug = excluded.slug,
  display_name = excluded.display_name,
  legacy_table_name = excluded.legacy_table_name;

insert into public.admin (
  id, username, password, table_name
) values (
  '70000000-0000-4000-8000-000000000002',
  'fixture-planos-admin',
  'not-a-real-login-hash',
  'fixture_planos_legacy_rsvps'
)
on conflict (id) do update set
  username = excluded.username,
  table_name = excluded.table_name;

insert into public.event_admins (event_id, admin_id, role, active)
values (
  '70000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000002',
  'couple_admin',
  true
)
on conflict (event_id, admin_id) do update set active = true;

insert into public.event_migration_state (
  event_id, legacy_reads_enabled, legacy_dual_write_enabled
) values (
  '70000000-0000-4000-8000-000000000001', true, true
)
on conflict (event_id) do update set
  legacy_reads_enabled = true,
  legacy_dual_write_enabled = true;

insert into public.floor_plan (table_name, layout)
values (
  'fixture_planos_legacy_rsvps',
  jsonb_build_object(
    'width', 1200,
    'height', 800,
    'background', jsonb_build_object(
      'path', '70000000-0000-4000-8000-000000000001/../70000000-0000-4000-8000-000000000099/80000000-0000-4000-8000-000000000001.png',
      'opacity', 0.7
    ),
    'tables', jsonb_build_array(
      jsonb_build_object(
        'tableNumber', 'MESA 12',
        'name', 'Mesa 12',
        'x', 300,
        'y', 200,
        'maxPeople', 10,
        'shape', 'circle',
        'size', 96
      ),
      jsonb_build_object(
        'tableNumber', 'MESA 13',
        'name', 'Mesa 13',
        'x', 400,
        'y', 240,
        'maxPeople', 10,
        'shape', 'circle',
        'size', 96
      )
    )
  )
)
on conflict (table_name) do update set layout = excluded.layout;

insert into public.floor_plans_legacy_admin (
  admin_username, image_url, opacity, floor_tables
) values (
  'fixture-planos-admin',
  '70000000-0000-4000-8000-000000000001/../70000000-0000-4000-8000-000000000099/80000000-0000-4000-8000-000000000001.png',
  0.7,
  jsonb_build_array(
    jsonb_build_object(
      'tableNumber', '  mesa   12 ',
      'name', 'Mesa 12',
      'x', 25,
      'y', 25,
      'maxPeople', 10,
      'shape', 'circle',
      'size', 96
    ),
    jsonb_build_object(
      'tableNumber', 'MESA 13',
      'name', 'Mesa 13',
      'x', 50,
      'y', 30,
      'maxPeople', 10,
      'shape', 'circle',
      'size', 96
    )
  )
)
on conflict (admin_username) do update set
  image_url = excluded.image_url,
  opacity = excluded.opacity,
  floor_tables = excluded.floor_tables;

do $$
declare
  first_result jsonb;
  second_result jsonb;
  first_run_id uuid;
  fixture_event_id constant uuid := '70000000-0000-4000-8000-000000000001';
begin
  first_result := public.migrate_legacy_floor_plans();
  first_run_id := (first_result ->> 'run_id')::uuid;

  if first_result ->> 'status' <> 'needs_review'
     or (first_result ->> 'unresolved_issue_count')::integer < 1 then
    raise exception 'conflicting legacy definitions must produce a reviewable run: %', first_result;
  end if;

  if not exists (
    select 1
    from public.floor_plans plan
    where plan.event_id = fixture_event_id
      and plan.logical_width = 1200
      and plan.logical_height = 800
      and plan.background_path is null
      and plan.revision = 0
  ) then
    raise exception 'expected a revision-zero canonical floor plan without the traversable background';
  end if;

  if not exists (
    select 1
    from public.legacy_floor_plan_reconciliation_audit audit
    where audit.run_id = first_run_id
      and audit.event_id = fixture_event_id
      and audit.issue_code = 'background_requires_private_copy'
      and audit.details ->> 'legacy_background_ref' =
        '70000000-0000-4000-8000-000000000001/../70000000-0000-4000-8000-000000000099/80000000-0000-4000-8000-000000000001.png'
      and audit.resolved_at is null
  ) then
    raise exception 'traversable legacy background was not quarantined for private copy';
  end if;

  if (
    select count(*)
    from public.seating_tables seating_table
    where seating_table.event_id = fixture_event_id
  ) <> 1 then
    raise exception 'only the unambiguous table should be imported';
  end if;

  if not exists (
    select 1
    from public.seating_tables seating_table
    where seating_table.event_id = fixture_event_id
      and seating_table.code = 'MESA 12'
      and seating_table.x = 300
      and seating_table.y = 200
  ) then
    raise exception 'percentage and logical coordinates were not reconciled';
  end if;

  if not exists (
    select 1
    from public.legacy_floor_plan_reconciliation_audit audit
    where audit.run_id = first_run_id
      and audit.event_id = fixture_event_id
      and audit.table_code = 'MESA 13'
      and audit.issue_code = 'conflicting_table_definitions'
      and audit.resolved_at is null
  ) then
    raise exception 'expected a reviewable conflict for MESA 13';
  end if;

  begin
    update public.event_migration_state
    set legacy_reads_enabled = false
    where event_id = fixture_event_id;
    raise exception 'cutover should have been blocked by the unresolved floor-plan conflict';
  exception
    when sqlstate '55000' then
      if sqlerrm <> 'legacy_floor_plan_reconciliation_not_clean' then
        raise;
      end if;
  end;

  update public.legacy_floor_plan_reconciliation_audit audit set
    resolved_at = now(),
    resolved_by = 'fixture-reviewer',
    resolution_note = 'Fixture conflict reviewed; canonical MESA 13 intentionally omitted.'
  where audit.run_id = first_run_id
    and audit.event_id = fixture_event_id
    and audit.status = 'issue'
    and audit.resolved_at is null;

  update public.event_migration_state
  set legacy_reads_enabled = false
  where event_id = fixture_event_id;

  if (
    select state.legacy_reads_enabled
    from public.event_migration_state state
    where state.event_id = fixture_event_id
  ) then
    raise exception 'resolved reconciliation should allow the cutover state change';
  end if;

  if (
    select count(*)
    from public.legacy_floor_plan_sources source
    where source.event_id = fixture_event_id
      and source.source_key in (
        'fixture_planos_legacy_rsvps',
        'fixture-planos-admin'
      )
      and source.mapping_status = 'mapped'
      and source.raw_payload is not null
  ) <> 2 then
    raise exception 'both raw source plans must remain snapshotted';
  end if;

  if (
    select count(*)
    from public.legacy_floor_plan_source_versions source_version
    join public.legacy_floor_plan_sources source
      on source.id = source_version.source_id
    where source.event_id = fixture_event_id
      and source.source_key in (
        'fixture_planos_legacy_rsvps',
        'fixture-planos-admin'
      )
  ) <> 2 then
    raise exception 'each distinct raw source version must remain append-only';
  end if;

  second_result := public.migrate_legacy_floor_plans();
  if second_result ->> 'status' <> 'completed'
     or (second_result ->> 'unresolved_issue_count')::integer <> 0 then
    raise exception 'an unchanged, resolved conflict must remain resolved: %', second_result;
  end if;
  if (
    select count(*)
    from public.seating_tables seating_table
    where seating_table.event_id = fixture_event_id
      and seating_table.code = 'MESA 12'
  ) <> 1 then
    raise exception 'repeat migration duplicated an existing table';
  end if;

  if (second_result ->> 'matched_table_count')::integer < 1 then
    raise exception 'repeat migration did not recognise the canonical match';
  end if;
end;
$$;

rollback;
