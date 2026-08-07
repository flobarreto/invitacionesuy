-- Run after migrations 000-007 in an isolated database. Mutations are rolled
-- back so this fixture can be repeated against the same schema.

begin;

create table public.fixture_unregistered_rsvps (
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

do $$
declare
  fixture_event_id uuid;
  fixture_guest_id uuid;
  fixture_group_id uuid;
  fixture_campaign_id uuid;
  fixture_delivery_id uuid;
  history_count_before_delete bigint;
  migration_result jsonb;
  cutover_result jsonb;
  previous_sync_setting text := current_setting('app.legacy_to_core', true);
begin
  if not (
    public.authorize_legacy_rsvp_relation('fixture_legacy_rsvps') ->> 'valid'
  )::boolean then
    raise exception 'valid legacy RSVP relation was rejected';
  end if;
  if (
    public.inspect_legacy_rsvp_relation('events') ->> 'valid'
  )::boolean then
    raise exception 'canonical events relation was accepted as legacy RSVP';
  end if;
  if not (
    public.inspect_legacy_rsvp_relation('fixture_unregistered_rsvps') ->> 'valid'
  )::boolean then
    raise exception 'schema-valid unregistered fixture was not recognized';
  end if;
  if (
    public.authorize_legacy_rsvp_relation('fixture_unregistered_rsvps') ->> 'valid'
  )::boolean or
     public.authorize_legacy_rsvp_relation('fixture_unregistered_rsvps') ->> 'reason'
       <> 'relation_not_registered' then
    raise exception 'unregistered schema-valid relation was authorized';
  end if;

  if exists (
    select 1
    from public.events event
    where event.legacy_table_name = 'admin'
  ) then
    raise exception 'unsafe admin.table_name was converted into an event';
  end if;
  if not exists (
    select 1
    from public.admin administrator
    where administrator.id = '71000000-0000-4000-8000-000000000004'
      and administrator.table_name is null
  ) then
    raise exception 'unsafe administrator mapping was not quarantined';
  end if;
  if not exists (
    select 1
    from public.legacy_rsvp_mapping_reviews review
    where review.admin_id = '71000000-0000-4000-8000-000000000004'
      and review.candidate_table_name = 'admin'
      and review.reason = 'blocked_relation'
      and review.status = 'pending'
  ) then
    raise exception 'unsafe administrator mapping was not queued for review';
  end if;

  begin
    update public.admin
    set table_name = 'events'
    where id = '71000000-0000-4000-8000-000000000004';
    raise exception 'unsafe administrator mapping should have been rejected';
  exception
    when check_violation then
      if sqlerrm <> 'unsafe_legacy_rsvp_mapping' then raise; end if;
  end;

  begin
    update public.events
    set legacy_table_name = 'fixture_legacy_rsvps'
    where slug = 'calas';
    raise exception 'cross-event legacy mapping should have been rejected';
  exception
    when check_violation then
      if sqlerrm <> 'canonical_legacy_rsvp_mapping_mismatch' then raise; end if;
  end;

  if to_regclass('public.floor_plans_legacy_admin') is null then
    raise exception 'migration 000 did not preserve the legacy plural floor plan';
  end if;
  if to_regclass('public.floor_plans') is null then
    raise exception 'migration 001 did not create the canonical floor plan';
  end if;

  select event.id into fixture_event_id
  from public.events event
  where event.legacy_table_name = 'fixture_legacy_rsvps';
  if fixture_event_id is null then
    raise exception 'legacy admin event was not backfilled';
  end if;

  if not exists (
    select 1
    from public.event_admins event_admin
    where event_admin.event_id = fixture_event_id
      and event_admin.admin_id = '71000000-0000-4000-8000-000000000001'
      and event_admin.active
  ) then
    raise exception 'legacy administrator was not scoped to the event';
  end if;

  select guest.id into fixture_guest_id
  from public.guests guest
  where guest.event_id = fixture_event_id
    and guest.legacy_table = 'fixture_legacy_rsvps'
    and guest.legacy_id = '71000000-0000-4000-8000-000000000003';
  if fixture_guest_id is null then
    raise exception 'legacy RSVP was not backfilled';
  end if;

  if not exists (
    select 1
    from public.guests guest
    join public.invitation_groups invitation_group
      on invitation_group.id = guest.group_id
     and invitation_group.event_id = guest.event_id
    join public.seating_tables seating_table
      on seating_table.id = guest.table_id
     and seating_table.event_id = guest.event_id
    where guest.id = fixture_guest_id
      and guest.attendance_status = 'attending'
      and guest.dietary_preferences = array['Vegetariana']::text[]
      and guest.drink_preferences = array['Agua']::text[]
      and invitation_group.phone_e164 = '+59899123456'
      and seating_table.code = '9'
      and seating_table.label = 'Mesa 9'
      and seating_table.x = 360
      and seating_table.y = 240
  ) then
    raise exception 'legacy RSVP fields or reconciled table differ from the source';
  end if;

  if not exists (
    select 1
    from public.guest_tags guest_tag
    join public.tags tag on tag.id = guest_tag.tag_id
    where guest_tag.guest_id = fixture_guest_id
      and guest_tag.event_id = fixture_event_id
      and tag.event_id = fixture_event_id
      and tag.name = 'Familia'
  ) then
    raise exception 'legacy tag was not tenant-scoped and attached';
  end if;

  if not exists (
    select 1
    from (
      select latest_audit.*
      from public.legacy_migration_audit latest_audit
      where latest_audit.event_id = fixture_event_id
      order by latest_audit.migrated_at desc, latest_audit.id desc
      limit 1
    ) audit
    where audit.status = 'completed'
      and audit.source_count = 1
      and audit.migrated_guest_count = 1
      and audit.source_checksum = audit.target_checksum
  ) then
    raise exception 'legacy core counts/checksum audit is not clean';
  end if;

  if not exists (
    select 1
    from (
      select latest_run.*
      from public.legacy_floor_plan_migration_runs latest_run
      order by latest_run.started_at desc, latest_run.id desc
      limit 1
    ) migration_run
    where migration_run.status = 'completed'
      and migration_run.unresolved_issue_count = 0
      and migration_run.source_checksum ~ '^[a-f0-9]{64}$'
      and migration_run.target_checksum ~ '^[a-f0-9]{64}$'
  ) then
    raise exception 'legacy floor-plan reconciliation did not complete cleanly';
  end if;

  begin
    insert into public.invitation_groups (event_id, display_name)
    values (fixture_event_id, 'Should be blocked');
    raise exception 'canonical write should have been blocked before cutover';
  exception
    when sqlstate '55000' then
      if sqlerrm <> 'canonical_write_blocked_until_legacy_cutover' then
        raise;
      end if;
  end;

  -- Migration 006 must propagate a delta from the real legacy table.
  update public.fixture_legacy_rsvps
  set attendance = 'No'
  where id = '71000000-0000-4000-8000-000000000003';

  if not exists (
    select 1
    from public.guests guest
    where guest.id = fixture_guest_id
      and guest.event_id = fixture_event_id
      and guest.attendance_status = 'declined'
      and guest.table_id is null
  ) then
    raise exception 'legacy dual-write did not persist the attendance delta';
  end if;

  -- Restore attendance, queue a delivery, and prove that a real legacy DELETE
  -- retires the canonical guest without deleting its append-only history.
  update public.fixture_legacy_rsvps
  set attendance = 'Sí', table_number = '9'
  where id = '71000000-0000-4000-8000-000000000003';

  select guest.group_id into fixture_group_id
  from public.guests guest
  where guest.id = fixture_guest_id;

  perform set_config('app.legacy_to_core', 'on', true);
  update public.invitation_groups invitation_group
  set consent_at = now(), consent_source = 'legacy'
  where invitation_group.id = fixture_group_id;
  perform set_config('app.legacy_to_core', coalesce(previous_sync_setting, ''), true);

  insert into public.message_campaigns (
    event_id, kind, status, idempotency_key, preview_hash
  ) values (
    fixture_event_id, 'invitation', 'queued',
    'fixture-legacy-delete-campaign', repeat('0', 64)
  ) returning id into fixture_campaign_id;
  insert into public.message_deliveries (
    campaign_id, event_id, group_id, status
  ) values (
    fixture_campaign_id, fixture_event_id, fixture_group_id, 'queued'
  ) returning id into fixture_delivery_id;

  select count(*) into history_count_before_delete
  from public.attendance_history history
  where history.guest_id = fixture_guest_id;

  delete from public.fixture_legacy_rsvps
  where id = '71000000-0000-4000-8000-000000000003';

  if not exists (
    select 1 from public.guests guest
    where guest.id = fixture_guest_id
      and guest.attendance_status = 'declined'
      and guest.table_id is null
      and guest.metadata #>> '{legacy_deleted,source}' = 'legacy_trigger'
      and guest.metadata #>> '{legacy_deleted,payloadFingerprint}' ~ '^[a-f0-9]{64}$'
  ) then
    raise exception 'legacy DELETE did not retire the canonical guest';
  end if;
  if not exists (
    select 1 from public.invitation_groups invitation_group
    where invitation_group.id = fixture_group_id
      and invitation_group.consent_at is null
      and invitation_group.metadata #>> '{legacy_deleted,source}' = 'legacy_trigger'
  ) then
    raise exception 'legacy DELETE did not retire the canonical group from messaging';
  end if;
  if not exists (
    select 1 from public.message_deliveries delivery
    where delivery.id = fixture_delivery_id
      and delivery.status = 'cancelled'
      and delivery.error_code = 'LEGACY_GUEST_DELETED'
  ) then
    raise exception 'legacy DELETE did not cancel pending delivery work';
  end if;
  if not exists (
    select 1 from public.legacy_rsvp_deletion_audit audit
    where audit.event_id = fixture_event_id
      and audit.guest_id = fixture_guest_id
      and audit.source = 'legacy_trigger'
      and audit.outcome = 'retired'
      and audit.legacy_id_hash ~ '^[a-f0-9]{64}$'
      and audit.cancelled_delivery_count = 1
  ) then
    raise exception 'legacy DELETE audit was not persisted';
  end if;
  if (
    select count(*) from public.attendance_history history
    where history.guest_id = fixture_guest_id
  ) <= history_count_before_delete then
    raise exception 'legacy DELETE erased history or failed to append retirement attendance';
  end if;

  -- Reappearance is explicit and restores only the consent snapshot captured
  -- by the retirement transaction.
  insert into public.fixture_legacy_rsvps (
    id, name, email, phone, attendance, dietary_preferences,
    favorite_song, drink, table_number, tags
  ) values (
    '71000000-0000-4000-8000-000000000003',
    'Invitada Fixture', 'fixture@example.invalid', '+59899123456', 'Sí',
    array['Vegetariana'], 'Canción Fixture', array['Agua'], '9',
    array['71000000-0000-4000-8000-000000000002'::uuid]
  );
  if not exists (
    select 1
    from public.guests guest
    join public.invitation_groups invitation_group on invitation_group.id = guest.group_id
    where guest.id = fixture_guest_id
      and guest.attendance_status = 'attending'
      and not (guest.metadata ? 'legacy_deleted')
      and not (invitation_group.metadata ? 'legacy_deleted')
      and invitation_group.consent_at is not null
  ) then
    raise exception 'reinserted legacy RSVP was not reactivated safely';
  end if;

  -- Simulate a missed AFTER trigger. The delta pass must reconcile an absent
  -- source row and still produce a zero-row clean checksum.
  drop trigger invitia_legacy_dual_write on public.fixture_legacy_rsvps;
  delete from public.fixture_legacy_rsvps
  where id = '71000000-0000-4000-8000-000000000003';
  if not exists (
    select 1 from public.guests guest
    where guest.id = fixture_guest_id
      and guest.attendance_status = 'attending'
      and not (guest.metadata ? 'legacy_deleted')
  ) then
    raise exception 'missed-trigger fixture unexpectedly changed canonical data';
  end if;

  migration_result := public.migrate_legacy_event(fixture_event_id);
  if migration_result ->> 'status' <> 'completed'
     or (migration_result ->> 'source_count')::integer <> 0
     or (migration_result ->> 'migrated_guest_count')::integer <> 0
     or (migration_result ->> 'retired_guest_count')::integer <> 1
     or migration_result ->> 'source_checksum' is distinct from migration_result ->> 'target_checksum' then
    raise exception 'delta migration did not produce a clean cutover audit: %', migration_result;
  end if;
  if not exists (
    select 1 from public.legacy_rsvp_deletion_audit audit
    where audit.event_id = fixture_event_id
      and audit.guest_id = fixture_guest_id
      and audit.source = 'legacy_reconciliation'
      and audit.outcome = 'retired'
  ) then
    raise exception 'delta migration did not audit the missed legacy DELETE';
  end if;

  cutover_result := public.complete_legacy_event_cutover(fixture_event_id);
  if (cutover_result ->> 'legacyReadsEnabled')::boolean
     or (cutover_result ->> 'legacyDualWriteEnabled')::boolean
     or (cutover_result ->> 'idempotentReplay')::boolean then
    raise exception 'first cutover result is invalid: %', cutover_result;
  end if;

  if exists (
    select 1 from public.event_migration_state state
    where state.event_id = fixture_event_id
      and (state.legacy_reads_enabled or state.legacy_dual_write_enabled)
  ) then
    raise exception 'cutover did not disable both legacy reads and writes';
  end if;

  begin
    update public.event_migration_state
    set legacy_reads_enabled = true, legacy_dual_write_enabled = true
    where event_id = fixture_event_id;
    raise exception 'completed cutover should not be reversible by flags';
  exception
    when sqlstate '55000' then
      if sqlerrm <> 'legacy_cutover_is_one_way' then raise; end if;
  end;

  begin
    insert into public.fixture_legacy_rsvps (
      id, name, attendance, dietary_preferences, favorite_song,
      drink, table_number, tags
    ) values (
      '71000000-0000-4000-8000-000000000005', 'Blocked after cutover', 'Sí',
      '{}'::text[], null, '{}'::text[], null, '{}'::uuid[]
    );
    raise exception 'legacy write should have been blocked after cutover';
  exception
    when sqlstate '55000' then
      if sqlerrm <> 'legacy_writes_disabled_after_cutover' then raise; end if;
  end;

  insert into public.invitation_groups (event_id, display_name)
  values (fixture_event_id, 'Canonical after cutover');

  cutover_result := public.complete_legacy_event_cutover(fixture_event_id);
  if not (cutover_result ->> 'idempotentReplay')::boolean
     or (cutover_result ->> 'legacyDualWriteEnabled')::boolean then
    raise exception 'repeat cutover was not idempotent: %', cutover_result;
  end if;
end;
$$;

rollback;
