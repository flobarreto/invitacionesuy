-- Transactional verification for the durable inbound -> outbound WhatsApp
-- workflow. Run after all migrations; no provider or network is involved.

begin;

do $$
declare
  event_id_value uuid := '72000000-0000-4000-8000-000000000001';
  group_id_value uuid := '72000000-0000-4000-8000-000000000002';
  first_guest_id uuid := '72000000-0000-4000-8000-000000000003';
  second_guest_id uuid := '72000000-0000-4000-8000-000000000004';
  campaign_id_value uuid := '72000000-0000-4000-8000-000000000005';
  delivery_id_value uuid := '72000000-0000-4000-8000-000000000006';
  conversation_id_value uuid := '72000000-0000-4000-8000-000000000007';
  answer_inbound_id uuid := '72000000-0000-4000-8000-000000000008';
  change_inbound_id uuid := '72000000-0000-4000-8000-000000000009';
  stop_inbound_id uuid := '72000000-0000-4000-8000-000000000010';
  retry_inbound_id uuid := '72000000-0000-4000-8000-000000000011';
  exhausted_inbound_id uuid := '72000000-0000-4000-8000-000000000012';
  claimed_job public.whatsapp_outbound_jobs%rowtype;
begin
  insert into public.events(
    id, slug, display_name, event_at, messaging_enabled
  ) values (
    event_id_value, 'fixture-whatsapp-outbox', 'Fixture WhatsApp',
    now() + interval '30 days', true
  );

  insert into public.invitation_groups(
    id, event_id, display_name, phone_e164, consent_at, consent_source,
    invitation_token_hash, invitation_token_last4
  ) values (
    group_id_value, event_id_value, 'Familia Fixture', '+59899111111', now(), 'manual',
    repeat('c', 64), 'cccc'
  );

  insert into public.guests(id, event_id, group_id, name)
  values
    (first_guest_id, event_id_value, group_id_value, 'Ana'),
    (second_guest_id, event_id_value, group_id_value, 'Bruno');

  insert into public.message_campaigns(
    id, event_id, kind, status, idempotency_key, preview_hash
  ) values (
    campaign_id_value, event_id_value, 'reminder', 'running',
    'fixture-outbox-campaign', repeat('a', 64)
  );

  insert into public.message_deliveries(
    id, campaign_id, event_id, group_id, status, locked_at, locked_by
  ) values (
    delivery_id_value, campaign_id_value, event_id_value, group_id_value,
    'sending', now(), 'fixture-worker'
  );

  -- Receipt-before-mark is the race seen in Baileys: it must be durable even
  -- though no delivery has the provider id yet.
  perform public.record_whatsapp_provider_status(
    'fixture-initial-question', 'delivered', now()
  );
  perform public.mark_message_delivery_sent(
    delivery_id_value, 'fixture-initial-question', '{"fixture":true}'::jsonb
  );
  if not exists (
    select 1
    from public.message_deliveries
    where id = delivery_id_value
      and status = 'delivered'
      and delivered_at is not null
      and payload @> '{"fixture":true}'::jsonb
  ) then
    raise exception 'provider status arriving before delivery acceptance was lost';
  end if;

  insert into public.whatsapp_conversations(
    id, event_id, group_id, delivery_id, state, current_guest_id,
    last_outbound_message_id
  ) values (
    conversation_id_value, event_id_value, group_id_value, delivery_id_value,
    'awaiting_attendance', first_guest_id, 'fixture-initial-question'
  );

  insert into public.whatsapp_inbound_events(
    id, provider_message_id, phone_hash, phone_ciphertext, quoted_message_id, command, received_at
  ) values (
    answer_inbound_id, 'fixture-answer-1', repeat('b', 64), repeat('e', 32),
    'fixture-initial-question', 'accept', now()
  );

  insert into public.whatsapp_inbound_events(
    id, provider_message_id, phone_hash, phone_ciphertext, command, received_at,
    attempt_count, locked_at, locked_by
  ) values (
    retry_inbound_id, 'fixture-transient', repeat('b', 64), repeat('e', 32),
    'accept', now(), 2, now(), 'fixture-worker'
  );
  if public.retry_whatsapp_inbound_event(
    retry_inbound_id,
    'fixture-worker',
    'DATABASE_UNAVAILABLE',
    now() + interval '1 minute',
    null
  ) <> 'retry' or not exists (
    select 1 from public.whatsapp_inbound_events
    where id = retry_inbound_id
      and resolution = 'pending'
      and locked_at is null
      and processing_error_code = 'DATABASE_UNAVAILABLE'
      and next_attempt_at > now()
  ) then
    raise exception 'transient inbound failure was terminalized instead of scheduled';
  end if;

  perform public.advance_whatsapp_attendance(
    conversation_id_value,
    first_guest_id,
    'attending',
    'awaiting_attendance',
    second_guest_id,
    0,
    answer_inbound_id,
    'ask_attendance',
    second_guest_id
  );

  if not exists (
    select 1
    from public.guests guest
    where guest.id = first_guest_id
      and guest.attendance_status = 'attending'
      and guest.attendance_source = 'whatsapp'
  ) then
    raise exception 'attendance and source were not persisted atomically';
  end if;

  if not exists (
    select 1
    from public.whatsapp_inbound_events inbound_event
    join public.whatsapp_outbound_jobs outbound_job
      on outbound_job.source_inbound_event_id = inbound_event.id
    where inbound_event.id = answer_inbound_id
      and inbound_event.resolution = 'applied'
      and inbound_event.conversation_id = conversation_id_value
      and outbound_job.action = 'ask_attendance'
      and outbound_job.guest_id = second_guest_id
      and outbound_job.status = 'queued'
  ) then
    raise exception 'inbound resolution and semantic outbox action were not committed together';
  end if;

  select * into claimed_job
  from public.claim_whatsapp_outbound_jobs('fixture-worker', 1);
  if claimed_job.id is null or claimed_job.status <> 'sending' then
    raise exception 'follow-up job was not claimed';
  end if;

  perform public.record_whatsapp_provider_status(
    'fixture-question-2', 'delivered', now()
  );
  perform public.mark_whatsapp_outbound_sent(claimed_job.id, 'fixture-question-2');
  if not exists (
    select 1
    from public.whatsapp_outbound_jobs outbound_job
    join public.whatsapp_conversations conversation
      on conversation.id = outbound_job.conversation_id
    where outbound_job.id = claimed_job.id
      and outbound_job.status = 'delivered'
      and outbound_job.provider_message_id = 'fixture-question-2'
      and conversation.last_outbound_message_id = 'fixture-question-2'
  ) then
    raise exception 'outbox acceptance and conversation correlation were not atomic';
  end if;

  -- Late/out-of-order receipts may advance but never regress. Read is
  -- definitive and remains stronger than a later failure notification.
  perform public.record_whatsapp_provider_status('fixture-question-2', 'sent', now());
  if (select status from public.whatsapp_outbound_jobs where id = claimed_job.id) <> 'delivered' then
    raise exception 'out-of-order sent receipt regressed delivered';
  end if;
  perform public.record_whatsapp_provider_status('fixture-question-2', 'read', now());
  perform public.record_whatsapp_provider_status('fixture-question-2', 'failed', now());
  if (select status from public.whatsapp_outbound_jobs where id = claimed_job.id) <> 'read' then
    raise exception 'definitive read receipt was regressed by a later status';
  end if;

  update public.whatsapp_conversations
  set state = 'completed', current_guest_id = null, invalid_attempts = 0,
      last_outbound_message_id = 'fixture-summary', completed_at = now()
  where id = conversation_id_value;

  insert into public.whatsapp_inbound_events(
    id, provider_message_id, phone_hash, phone_ciphertext, quoted_message_id, command, received_at
  ) values (
    change_inbound_id, 'fixture-change', repeat('b', 64), repeat('e', 32),
    'fixture-summary', 'change', now()
  );

  if not public.advance_whatsapp_conversation(
    conversation_id_value,
    'completed',
    null,
    0,
    'awaiting_change_selection',
    null,
    0,
    change_inbound_id,
    'ask_change_selection',
    null
  ) then
    raise exception 'CAMBIAR did not reopen a completed conversation';
  end if;

  if not exists (
    select 1
    from public.whatsapp_outbound_jobs
    where source_inbound_event_id = change_inbound_id
      and action = 'ask_change_selection'
      and status = 'queued'
  ) then
    raise exception 'CAMBIAR did not enqueue the selection prompt';
  end if;

  perform public.submit_token_rsvp(
    'fixture-whatsapp-outbox',
    repeat('c', 64),
    jsonb_build_array(
      jsonb_build_object('guestId', first_guest_id, 'attendanceStatus', 'attending'),
      jsonb_build_object('guestId', second_guest_id, 'attendanceStatus', 'attending')
    )
  );
  if not exists (
    select 1 from public.whatsapp_outbound_jobs
    where source_inbound_event_id = change_inbound_id
      and status = 'cancelled'
      and error_code = 'RSVP_SUPERSEDED'
  ) or not exists (
    select 1 from public.whatsapp_conversations
    where id = conversation_id_value
      and state = 'completed'
      and not requires_review
  ) then
    raise exception 'web RSVP did not supersede the queued reminder prompt';
  end if;

  insert into public.whatsapp_inbound_events(
    id, provider_message_id, phone_hash, phone_ciphertext, command, received_at
  ) values (
    stop_inbound_id, 'fixture-stop', repeat('b', 64), repeat('e', 32), 'stop', now()
  );

  perform public.suppress_whatsapp_phone(
    '+59899111111', repeat('b', 64), event_id_value, stop_inbound_id
  );

  if not exists (
    select 1
    from public.phone_suppressions
    where phone_e164 = '+59899111111'
  ) or not exists (
    select 1
    from public.whatsapp_inbound_events
    where id = stop_inbound_id and resolution = 'opted_out'
  ) or not exists (
    select 1
    from public.whatsapp_conversations
    where id = conversation_id_value and state = 'opted_out' and not requires_review
  ) or not exists (
    select 1
    from public.whatsapp_outbound_jobs
    where source_inbound_event_id = stop_inbound_id
      and action = 'opt_out_confirmation'
      and status = 'queued'
  ) then
    raise exception 'STOP was not committed atomically';
  end if;

  select * into claimed_job
  from public.claim_whatsapp_outbound_jobs('fixture-worker', 1);
  if claimed_job.source_inbound_event_id <> stop_inbound_id
     or claimed_job.action <> 'opt_out_confirmation'
     or claimed_job.status <> 'sending' then
    raise exception 'suppression incorrectly blocked the opt-out confirmation';
  end if;

  -- If a worker dies on the fifth processing attempt, stale-lock recovery must
  -- make both the inbound event and its conversation visible for review.
  update public.whatsapp_conversations
  set state = 'awaiting_attendance', current_guest_id = second_guest_id,
      requires_review = false, completed_at = null
  where id = conversation_id_value;
  insert into public.whatsapp_inbound_events(
    id, provider_message_id, phone_hash, phone_ciphertext, command, received_at,
    conversation_id, attempt_count, locked_at, locked_by
  ) values (
    exhausted_inbound_id, 'fixture-worker-lost', repeat('b', 64), repeat('e', 32),
    'accept', now(), conversation_id_value, 5, now() - interval '3 minutes',
    'dead-worker'
  );
  perform * from public.claim_whatsapp_inbound_events('fixture-worker', 1);
  if not exists (
    select 1 from public.whatsapp_inbound_events
    where id = exhausted_inbound_id
      and resolution = 'review'
      and processing_error_code = 'WORKER_LOST_RETRY_EXHAUSTED'
  ) or not exists (
    select 1 from public.whatsapp_conversations
    where id = conversation_id_value
      and state = 'review'
      and requires_review
  ) then
    raise exception 'exhausted stale inbound was not escalated to conversation review';
  end if;
end;
$$;

rollback;
