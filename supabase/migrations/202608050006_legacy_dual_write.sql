-- Temporary legacy -> canonical synchronization used during the cutover.
--
-- This is deliberately one-way because the legacy tables do not share a
-- reliable schema. While legacy reads are enabled, a guard rejects direct
-- canonical CRM writes; only this trigger may write through. After a verified
-- source/target checksum gate flips legacy_reads_enabled=false, the application
-- may use canonical writes and must no longer serve legacy reads. Legacy writes
-- can remain synchronized for the compatibility release.

begin;

create table if not exists public.event_migration_state (
  event_id uuid primary key references public.events(id) on delete cascade,
  legacy_reads_enabled boolean not null default true,
  legacy_dual_write_enabled boolean not null default true,
  cutover_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.event_migration_state enable row level security;

insert into public.event_migration_state (event_id)
select id from public.events where legacy_table_name is not null
on conflict (event_id) do nothing;

create or replace function public.guard_legacy_read_canonical_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
  previous_event_id uuid;
begin
  if current_setting('app.legacy_to_core', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  previous_event_id := case when tg_op = 'UPDATE' then old.event_id else null end;
  if exists (
    select 1
    from public.event_migration_state state
    where state.event_id in (target_event_id, previous_event_id)
      and state.legacy_reads_enabled
  ) then
    raise exception using
      errcode = '55000',
      message = 'canonical_write_blocked_until_legacy_cutover',
      hint = 'Run complete_legacy_event_cutover after source/target validation, then switch all reads to canonical.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists invitation_groups_guard_legacy_read_canonical_write
  on public.invitation_groups;
create trigger invitation_groups_guard_legacy_read_canonical_write
before insert or update or delete on public.invitation_groups
for each row execute function public.guard_legacy_read_canonical_write();

drop trigger if exists guests_guard_legacy_read_canonical_write on public.guests;
create trigger guests_guard_legacy_read_canonical_write
before insert or update or delete on public.guests
for each row execute function public.guard_legacy_read_canonical_write();

drop trigger if exists guest_tags_guard_legacy_read_canonical_write on public.guest_tags;
create trigger guest_tags_guard_legacy_read_canonical_write
before insert or update or delete on public.guest_tags
for each row execute function public.guard_legacy_read_canonical_write();

create or replace function public.sync_legacy_rsvp_to_core()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.events%rowtype;
begin
  if tg_op = 'DELETE' then
    -- Canonical attendance history is retained when a legacy row is removed.
    return old;
  end if;

  if not (
    public.authorize_legacy_rsvp_relation(tg_table_name) ->> 'valid'
  )::boolean then
    raise exception using
      errcode = '55000',
      message = 'unsafe_legacy_rsvp_relation';
  end if;

  select event.* into event_row
  from public.events event
  join public.event_migration_state state on state.event_id = event.id
  where event.legacy_table_name = tg_table_name
    and state.legacy_dual_write_enabled;

  if not found then return new; end if;

  perform public.sync_legacy_payload_to_core(
    event_row.id,
    tg_table_name,
    to_jsonb(new),
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    null,
    'legacy'
  );
  return new;
end;
$$;

create or replace function public.complete_legacy_event_cutover(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.events%rowtype;
  state_row public.event_migration_state%rowtype;
  audit_row public.legacy_migration_audit%rowtype;
  source_relation regclass;
  relation_inspection jsonb;
  current_source_count bigint;
  current_source_checksum text;
begin
  select * into event_row
  from public.events
  where id = p_event_id
  for update;
  if not found or event_row.legacy_table_name is null then
    raise exception using errcode = 'P0002', message = 'legacy_event_not_found';
  end if;

  relation_inspection := public.authorize_legacy_rsvp_relation(
    event_row.legacy_table_name
  );
  if not (relation_inspection ->> 'valid')::boolean then
    raise exception using
      errcode = '55000',
      message = 'unsafe_legacy_rsvp_relation',
      detail = relation_inspection::text;
  end if;

  select * into state_row
  from public.event_migration_state
  where event_id = p_event_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'migration_state_not_found';
  end if;
  if not state_row.legacy_reads_enabled then
    return jsonb_build_object(
      'eventId', p_event_id,
      'legacyReadsEnabled', false,
      'idempotentReplay', true,
      'cutoverCompletedAt', state_row.cutover_completed_at
    );
  end if;

  -- Lock the source before taking the sync advisory lock. Legacy writes already
  -- hold a RowExclusive lock when their AFTER trigger takes that advisory lock;
  -- this order avoids a lock inversion while closing the checksum TOCTOU window.
  source_relation := to_regclass(format('%I.%I', 'public', event_row.legacy_table_name));
  if source_relation is null then
    raise exception using errcode = '55000', message = 'legacy_source_missing_at_cutover';
  end if;
  execute format('lock table %s in share mode', source_relation);
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':legacy-sync', 0));

  select * into audit_row
  from public.legacy_migration_audit
  where event_id = p_event_id
  order by migrated_at desc, id desc
  limit 1;

  if not found or audit_row.status <> 'completed' or
     audit_row.source_count <> audit_row.migrated_guest_count or
     audit_row.source_checksum is distinct from audit_row.target_checksum or
     jsonb_typeof(audit_row.ambiguities) <> 'array' or
     jsonb_array_length(audit_row.ambiguities) > 0 then
    raise exception using
      errcode = '55000',
      message = 'legacy_cutover_audit_not_clean',
      hint = 'Resolve migration ambiguities and rerun migrate_legacy_event before cutover.';
  end if;

  execute format(
    'select count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '''' order by md5(to_jsonb(t)::text)), '''')) from %s t',
    source_relation
  ) into current_source_count, current_source_checksum;

  if current_source_count <> audit_row.source_count or
     current_source_checksum is distinct from audit_row.source_checksum then
    raise exception using
      errcode = '40001',
      message = 'legacy_source_changed_after_audit',
      hint = 'Run migrate_legacy_event again before cutover.';
  end if;

  update public.event_migration_state set
    legacy_reads_enabled = false,
    cutover_completed_at = now(),
    updated_at = now()
  where event_id = p_event_id
  returning * into state_row;

  return jsonb_build_object(
    'eventId', p_event_id,
    'legacyReadsEnabled', state_row.legacy_reads_enabled,
    'legacyDualWriteEnabled', state_row.legacy_dual_write_enabled,
    'idempotentReplay', false,
    'cutoverCompletedAt', state_row.cutover_completed_at,
    'sourceCount', audit_row.source_count,
    'checksum', audit_row.source_checksum
  );
end;
$$;

do $$
declare
  event_record record;
begin
  for event_record in
    select id, legacy_table_name
    from public.events
    where legacy_table_name is not null
  loop
    if (
      public.authorize_legacy_rsvp_relation(event_record.legacy_table_name)
        ->> 'valid'
    )::boolean then
      execute format(
        'drop trigger if exists invitia_legacy_dual_write on public.%I',
        event_record.legacy_table_name
      );
      execute format(
        'create trigger invitia_legacy_dual_write after insert or update on public.%I for each row execute function public.sync_legacy_rsvp_to_core()',
        event_record.legacy_table_name
      );
      -- This closes the small window between 004 and trigger installation. The
      -- same identity and compare-and-set function is used by both paths.
      perform public.migrate_legacy_event(event_record.id);
    end if;
  end loop;
end;
$$;

revoke all on function public.guard_legacy_read_canonical_write()
  from public, anon, authenticated;
revoke all on function public.sync_legacy_rsvp_to_core()
  from public, anon, authenticated;
revoke all on function public.complete_legacy_event_cutover(uuid)
  from public, anon, authenticated;
grant execute on function public.complete_legacy_event_cutover(uuid) to service_role;

comment on table public.event_migration_state is
  'Cutover gate: canonical CRM writes stay blocked until legacy reads are explicitly disabled after a clean audit.';

commit;
