-- End-to-end database contract for canonical CRM, campaign idempotency and
-- seating. It deliberately avoids provider/network calls.

begin;

do $$
declare
  event_id_value uuid := '73000000-0000-4000-8000-000000000001';
  table_id_value uuid := '73000000-0000-4000-8000-000000000002';
  group_id_value uuid;
  first_guest_id uuid;
  second_guest_id uuid;
  mutation jsonb;
  replay jsonb;
  campaign jsonb;
  campaign_id_value uuid;
  claimed public.message_deliveries%rowtype;
  revision_value bigint;
begin
  insert into public.events(
    id, slug, display_name, event_at, rsvp_deadline, rsvp_status,
    messaging_enabled
  ) values (
    event_id_value,
    'fixture-canonical-workflow',
    'Fixture canonical workflow',
    now() + interval '60 days',
    now() + interval '45 days',
    'open',
    true
  );

  mutation := public.crm_create_invitation_group_idempotent(
    event_id_value,
    'Familia Fixture',
    'familia-fixture',
    '+59899222222',
    now(),
    'manual',
    repeat('a', 64),
    'abcd',
    repeat('e', 32),
    '[{"name":"Ana","attendanceStatus":"attending"},{"name":"Bruno","attendanceStatus":"pending"}]'::jsonb,
    '["Familia","Amigos"]'::jsonb,
    'fixture-manual-group',
    repeat('b', 64)
  );
  replay := public.crm_create_invitation_group_idempotent(
    event_id_value,
    'Familia Fixture',
    'familia-fixture',
    '+59899222222',
    now(),
    'manual',
    repeat('a', 64),
    'abcd',
    repeat('e', 32),
    '[{"name":"Ana","attendanceStatus":"attending"},{"name":"Bruno","attendanceStatus":"pending"}]'::jsonb,
    '["Familia","Amigos"]'::jsonb,
    'fixture-manual-group',
    repeat('b', 64)
  );

  group_id_value := (mutation -> 'result' ->> 'groupId')::uuid;
  if (mutation ->> 'idempotentReplay')::boolean
     or not (replay ->> 'idempotentReplay')::boolean
     or group_id_value is distinct from (replay -> 'result' ->> 'groupId')::uuid
     or (select count(*) from public.invitation_groups where event_id = event_id_value) <> 1
     or (select count(*) from public.guests where event_id = event_id_value) <> 2
     or (select count(*) from public.tags where event_id = event_id_value) <> 2 then
    raise exception 'canonical CRM group creation was not idempotent';
  end if;

  select id into first_guest_id
  from public.guests
  where group_id = group_id_value and name = 'Ana';
  select id into second_guest_id
  from public.guests
  where group_id = group_id_value and name = 'Bruno';

  revision_value := public.save_seating_layout(
    event_id_value,
    0,
    '{"logical_width":1200,"logical_height":700,"background_path":null}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', table_id_value,
      'code', 'A1',
      'label', 'Mesa A1',
      'capacity', 1,
      'shape', 'circle',
      'x', 200,
      'y', 200,
      'width', 100,
      'height', 100,
      'rotation', 0
    ))
  );
  if revision_value <> 1 then raise exception 'initial seating revision was not 1'; end if;

  begin
    perform public.save_seating_layout(
      event_id_value,
      0,
      '{"logical_width":1200,"logical_height":700,"background_path":null}'::jsonb,
      '[]'::jsonb
    );
    raise exception 'stale seating revision was accepted';
  exception when serialization_failure then
    null;
  end;

  begin
    perform public.save_seating_layout(
      event_id_value,
      null::bigint,
      '{"logical_width":1200,"logical_height":700,"background_path":null}'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'id', table_id_value,
        'code', 'A1',
        'label', 'Mesa A1',
        'capacity', 1,
        'shape', 'circle',
        'x', 200,
        'y', 200,
        'width', 100,
        'height', 100,
        'rotation', 0
      ))
    );
    raise exception 'NULL seating revision bypassed optimistic concurrency';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.save_seating_layout(
      event_id_value,
      1,
      '{"logical_width":1200,"logical_height":700,"background_path":null}'::jsonb,
      null::jsonb
    );
    raise exception 'NULL seating table list was accepted';
  exception when invalid_parameter_value then
    null;
  end;
  if (select revision from public.floor_plans where event_id = event_id_value) is distinct from 1
     or not exists (
       select 1 from public.seating_tables
       where id = table_id_value and event_id = event_id_value
     ) then
    raise exception 'invalid NULL layout mutated canonical seating data';
  end if;

  perform public.assign_guest_to_table(event_id_value, first_guest_id, table_id_value, false);
  begin
    perform public.assign_guest_to_table(event_id_value, second_guest_id, table_id_value, false);
    raise exception 'table capacity was exceeded without confirmation';
  exception when check_violation then
    null;
  end;
  begin
    perform public.assign_guest_to_table(
      event_id_value,
      second_guest_id,
      table_id_value,
      null::boolean
    );
    raise exception 'NULL force bypassed table capacity';
  exception when check_violation then
    null;
  end;
  if (select table_id from public.guests where id = second_guest_id) is not null then
    raise exception 'NULL force assigned a guest despite table capacity';
  end if;
  perform public.assign_guest_to_table(event_id_value, second_guest_id, table_id_value, true);
  update public.guests set attendance_status = 'declined' where id = second_guest_id;
  if (select table_id from public.guests where id = second_guest_id) is not null then
    raise exception 'declined guest remained assigned to a table';
  end if;

  revision_value := public.save_seating_layout(
    event_id_value,
    1,
    '{"logical_width":1200,"logical_height":700,"background_path":null}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', table_id_value,
      'code', 'A1',
      'label', 'Mesa Principal',
      'capacity', 2,
      'shape', 'circle',
      'x', 240,
      'y', 220,
      'width', 100,
      'height', 100,
      'rotation', 0
    ))
  );
  if revision_value <> 2
     or (select table_id from public.guests where id = first_guest_id) is distinct from table_id_value then
    raise exception 'renaming/moving a table broke its stable assignment';
  end if;

  campaign := public.create_message_campaign(
    event_id_value,
    'invitation',
    array[group_id_value],
    'fixture-invitation-campaign',
    repeat('c', 64),
    null,
    null,
    repeat('d', 64),
    null
  );
  replay := public.create_message_campaign(
    event_id_value,
    'invitation',
    array[group_id_value],
    'fixture-invitation-campaign',
    repeat('c', 64),
    null,
    null,
    repeat('d', 64),
    null
  );
  campaign_id_value := (campaign -> 'campaign' ->> 'id')::uuid;
  if (campaign ->> 'idempotentReplay')::boolean
     or not (replay ->> 'idempotentReplay')::boolean
     or campaign_id_value is distinct from (replay -> 'campaign' ->> 'id')::uuid
     or (select count(*) from public.message_deliveries where campaign_id = campaign_id_value) <> 1 then
    raise exception 'double-click campaign created duplicate work';
  end if;

  select * into claimed
  from public.claim_message_deliveries('fixture-worker-a', 1);
  if claimed.id is null or claimed.status <> 'sending' then
    raise exception 'first worker did not claim the delivery';
  end if;
  if exists (
    select 1 from public.claim_message_deliveries('fixture-worker-b', 1)
  ) then
    raise exception 'second worker claimed the same/simultaneous campaign delivery';
  end if;
  perform public.mark_message_delivery_sent(
    claimed.id,
    'fixture-canonical-provider-id',
    '{}'::jsonb
  );
  update public.message_campaigns
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = campaign_id_value;

  campaign := public.create_message_campaign(
    event_id_value,
    'table_notice',
    array[group_id_value],
    'fixture-table-notice',
    repeat('e', 64),
    'Nos vemos mañana',
    null,
    repeat('f', 64),
    null
  );
  campaign_id_value := (campaign -> 'campaign' ->> 'id')::uuid;
  select * into claimed
  from public.claim_message_deliveries('fixture-worker-a', 1);
  if claimed.id is null then
    raise exception 'table notice delivery was not claimable';
  end if;
  perform public.mark_message_delivery_sent(
    claimed.id,
    'fixture-table-provider-id',
    jsonb_build_object('tableSnapshot', jsonb_build_array(
      jsonb_build_object('name', 'Ana', 'tableLabel', 'Mesa Principal')
    ))
  );

  perform public.save_seating_layout(
    event_id_value,
    2,
    '{"logical_width":1200,"logical_height":700,"background_path":null}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', table_id_value,
      'code', 'A1',
      'label', 'Mesa Nueva',
      'capacity', 2,
      'shape', 'circle',
      'x', 240,
      'y', 220,
      'width', 100,
      'height', 100,
      'rotation', 0
    ))
  );
  if not exists (
    select 1 from public.message_deliveries
    where id = claimed.id and is_stale and stale_at is not null
  ) then
    raise exception 'table rename did not mark the sent notice as stale';
  end if;

  campaign := public.create_message_campaign(
    event_id_value,
    'table_correction',
    array[group_id_value],
    'fixture-table-correction',
    repeat('1', 64),
    'Actualizamos tu mesa',
    null,
    repeat('2', 64),
    null
  );
  if (campaign -> 'campaign' ->> 'id') is null then
    raise exception 'stale table notice could not create a correction campaign';
  end if;
end;
$$;

rollback;
