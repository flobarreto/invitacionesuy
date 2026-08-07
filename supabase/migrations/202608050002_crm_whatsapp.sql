begin;

create extension if not exists pgcrypto;

alter table public.invitation_groups
  add column if not exists invitation_token_ciphertext text;

-- 001 owns attendance_history and its single write trigger. 002 only adds the
-- optional reference used to correlate a WhatsApp-originated change.
alter table public.attendance_history
  add column if not exists source_reference uuid;

create table if not exists public.message_campaigns (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null,
  status text not null default 'queued',
  scheduled_for timestamptz not null default now(),
  custom_message text,
  idempotency_key text not null,
  preview_hash text not null,
  requested_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint message_campaigns_kind_check check (
    kind in ('invitation', 'reminder', 'table_notice', 'table_correction')
  ),
  constraint message_campaigns_status_check check (
    status in ('draft', 'queued', 'running', 'paused', 'completed', 'cancelled')
  ),
  constraint message_campaigns_custom_message_length check (
    custom_message is null or char_length(custom_message) <= 1500
  ),
  unique (event_id, id),
  unique (event_id, idempotency_key)
);

create table if not exists public.message_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  event_id uuid not null references public.events(id) on delete cascade,
  group_id uuid not null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  provider_message_id text,
  error_code text,
  error_detail text,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  is_stale boolean not null default false,
  stale_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_deliveries_status_check check (
    status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'uncertain')
  ),
  constraint message_deliveries_attempt_count_check check (attempt_count between 0 and 20),
  constraint message_deliveries_error_detail_length check (
    error_detail is null or char_length(error_detail) <= 500
  ),
  constraint message_deliveries_campaign_same_event_fk
    foreign key (event_id, campaign_id)
    references public.message_campaigns(event_id, id)
    on delete cascade,
  constraint message_deliveries_group_same_event_fk
    foreign key (event_id, group_id)
    references public.invitation_groups(event_id, id)
    on delete cascade,
  unique (campaign_id, group_id),
  unique (provider_message_id)
);

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  group_id uuid not null,
  delivery_id uuid references public.message_deliveries(id) on delete set null,
  state text not null default 'awaiting_attendance',
  current_guest_id uuid references public.guests(id) on delete set null,
  invalid_attempts integer not null default 0,
  last_outbound_message_id text,
  requires_review boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint whatsapp_conversations_state_check check (
    state in ('awaiting_attendance', 'awaiting_change_selection', 'completed', 'review', 'opted_out')
  ),
  constraint whatsapp_conversations_invalid_attempts_check check (invalid_attempts between 0 and 100),
  constraint whatsapp_conversations_group_same_event_fk
    foreign key (event_id, group_id)
    references public.invitation_groups(event_id, id)
    on delete cascade
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'attendance_history_source_reference_fk'
      and conrelid = 'public.attendance_history'::regclass
  ) then
    alter table public.attendance_history
      add constraint attendance_history_source_reference_fk
      foreign key (source_reference)
      references public.whatsapp_conversations(id)
      on delete set null;
  end if;
end;
$$;

create table if not exists public.message_campaign_alerts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  event_id uuid not null references public.events(id) on delete cascade,
  group_id uuid not null,
  guest_id uuid references public.guests(id) on delete cascade,
  code text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint message_campaign_alerts_group_same_event_fk
    foreign key (event_id, group_id)
    references public.invitation_groups(event_id, id)
    on delete cascade,
  constraint message_campaign_alerts_campaign_same_event_fk
    foreign key (event_id, campaign_id)
    references public.message_campaigns(event_id, id)
    on delete cascade,
  constraint message_campaign_alerts_code_check check (
    code in ('missing_table', 'delivery_uncertain', 'requires_review')
  ),
  unique (campaign_id, guest_id, code)
);

create unique index if not exists whatsapp_conversations_one_active_per_group
  on public.whatsapp_conversations(group_id)
  where state in ('awaiting_attendance', 'awaiting_change_selection');

create table if not exists public.whatsapp_inbound_events (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text not null unique,
  phone_hash text not null,
  phone_ciphertext text not null,
  quoted_message_id text,
  command text not null,
  command_payload jsonb not null default '{}'::jsonb,
  resolution text not null default 'pending',
  conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  received_at timestamptz not null,
  processed_at timestamptz,
  attempt_count integer not null default 1,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  processing_error_code text,
  created_at timestamptz not null default now(),
  constraint whatsapp_inbound_resolution_check check (
    resolution in ('pending', 'applied', 'duplicate', 'ambiguous', 'ignored', 'review', 'opted_out')
  ),
  constraint whatsapp_inbound_command_length check (char_length(command) <= 32),
  constraint whatsapp_inbound_attempt_count_check check (attempt_count between 1 and 20),
  constraint whatsapp_inbound_phone_ciphertext_length check (
    char_length(phone_ciphertext) between 16 and 4096
  )
);

-- Follow-up questions, summaries and opt-out confirmations are durable work.
-- Inbound handlers only persist state plus one semantic action; the single
-- leased dispatcher renders and sends it under the same cap/delay/allowlist as
-- campaign deliveries. Message bodies are intentionally not stored here.
create table if not exists public.whatsapp_outbound_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  group_id uuid,
  conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  source_inbound_event_id uuid not null unique
    references public.whatsapp_inbound_events(id) on delete restrict,
  recipient_phone_e164 text not null,
  action text not null,
  guest_id uuid references public.guests(id) on delete set null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  provider_message_id text unique,
  error_code text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_outbound_jobs_status_check check (
    status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'uncertain')
  ),
  constraint whatsapp_outbound_jobs_action_check check (
    action in (
      'ask_attendance', 'ask_change_selection', 'send_summary',
      'invalid_prompt', 'review_notice', 'opt_out_confirmation'
    )
  ),
  constraint whatsapp_outbound_jobs_attempt_count_check check (attempt_count between 0 and 20),
  constraint whatsapp_outbound_jobs_phone_check check (
    recipient_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
  ),
  constraint whatsapp_outbound_jobs_guest_action_check check (
    (action = 'ask_attendance' and guest_id is not null)
    or (action <> 'ask_attendance' and guest_id is null)
  ),
  constraint whatsapp_outbound_jobs_group_same_event_fk
    foreign key (event_id, group_id)
    references public.invitation_groups(event_id, id)
    on delete cascade
);

-- Provider receipts can arrive before sendText resolves and before the
-- provider_message_id is attached to its delivery/job. Persist them first so
-- the later mark-sent transaction can replay the receipt without a race.
create table if not exists public.whatsapp_provider_status_events (
  provider_message_id text primary key,
  status text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_provider_status_events_status_check check (
    status in ('sent', 'delivered', 'read', 'failed')
  ),
  constraint whatsapp_provider_status_events_id_length check (
    char_length(provider_message_id) between 1 and 500
  )
);

create table if not exists public.phone_suppressions (
  phone_e164 text primary key,
  phone_hash text not null unique,
  source text not null default 'whatsapp',
  reason text not null default 'opt_out',
  event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint phone_suppressions_phone_check check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create table if not exists public.whatsapp_auth_state (
  storage_key text primary key,
  encrypted_value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_worker_leases (
  lease_name text primary key,
  worker_id text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.api_rate_limits (
  namespace text not null,
  key_hash text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  primary key (namespace, key_hash),
  constraint api_rate_limits_count_check check (request_count >= 0)
);

create table if not exists public.crm_idempotency_records (
  event_id uuid not null references public.events(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (event_id, operation, idempotency_key),
  constraint crm_idempotency_operation_check check (
    operation in ('manual_group', 'csv_import')
  ),
  constraint crm_idempotency_key_length_check check (
    char_length(idempotency_key) between 8 and 128
  ),
  constraint crm_idempotency_request_hash_check check (
    request_hash ~ '^[a-f0-9]{64}$'
  )
);

create table if not exists public.legacy_rsvp_idempotency_records (
  event_id uuid not null references public.events(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (event_id, idempotency_key),
  constraint legacy_rsvp_idempotency_key_length_check check (
    char_length(idempotency_key) between 8 and 128
  ),
  constraint legacy_rsvp_idempotency_request_hash_check check (
    request_hash ~ '^[a-f0-9]{64}$'
  )
);

create index if not exists message_deliveries_claim_idx
  on public.message_deliveries(status, next_attempt_at, created_at)
  where status in ('queued', 'failed');
create index if not exists message_deliveries_event_group_idx
  on public.message_deliveries(event_id, group_id);
create index if not exists message_campaigns_event_created_idx
  on public.message_campaigns(event_id, created_at desc);
create index if not exists attendance_history_guest_idx
  on public.attendance_history(guest_id, created_at desc);
create index if not exists whatsapp_conversations_outbound_idx
  on public.whatsapp_conversations(last_outbound_message_id)
  where last_outbound_message_id is not null;
create index if not exists whatsapp_inbound_received_idx
  on public.whatsapp_inbound_events(received_at desc);
create index if not exists whatsapp_inbound_pending_idx
  on public.whatsapp_inbound_events(resolution, next_attempt_at, created_at)
  where resolution = 'pending';
create index if not exists whatsapp_outbound_jobs_claim_idx
  on public.whatsapp_outbound_jobs(status, next_attempt_at, created_at)
  where status in ('queued', 'failed');
create index if not exists whatsapp_outbound_jobs_conversation_idx
  on public.whatsapp_outbound_jobs(conversation_id, created_at desc);
create index if not exists api_rate_limits_window_idx
  on public.api_rate_limits(window_started_at);
create index if not exists message_campaign_alerts_open_idx
  on public.message_campaign_alerts(event_id, campaign_id)
  where resolved_at is null;
create unique index if not exists message_campaign_alerts_group_code_unique_idx
  on public.message_campaign_alerts(campaign_id, group_id, code)
  where guest_id is null;

alter table public.attendance_history enable row level security;
alter table public.message_campaigns enable row level security;
alter table public.message_deliveries enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_inbound_events enable row level security;
alter table public.whatsapp_outbound_jobs enable row level security;
alter table public.whatsapp_provider_status_events enable row level security;
alter table public.phone_suppressions enable row level security;
alter table public.whatsapp_auth_state enable row level security;
alter table public.whatsapp_worker_leases enable row level security;
alter table public.api_rate_limits enable row level security;
alter table public.message_campaign_alerts enable row level security;
alter table public.crm_idempotency_records enable row level security;
alter table public.legacy_rsvp_idempotency_records enable row level security;

create or replace function public.consume_rate_limit(
  p_namespace text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rate_row public.api_rate_limits%rowtype;
  now_value timestamptz := clock_timestamp();
begin
  if p_limit < 1 or p_window_seconds < 1 or
     char_length(p_namespace) > 120 or p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_arguments';
  end if;

  insert into public.api_rate_limits(namespace, key_hash, window_started_at, request_count)
  values (p_namespace, p_key_hash, now_value, 1)
  on conflict (namespace, key_hash) do update set
    window_started_at = case
      when public.api_rate_limits.window_started_at <= now_value - make_interval(secs => p_window_seconds)
        then now_value
      else public.api_rate_limits.window_started_at
    end,
    request_count = case
      when public.api_rate_limits.window_started_at <= now_value - make_interval(secs => p_window_seconds)
        then 1
      else public.api_rate_limits.request_count + 1
    end
  returning * into rate_row;

  return jsonb_build_object(
    'allowed', rate_row.request_count <= p_limit,
    'retry_after_seconds', greatest(
      0,
      ceil(extract(epoch from (
        rate_row.window_started_at + make_interval(secs => p_window_seconds) - now_value
      )))::integer
    )
  );
end;
$$;

create or replace function public.submit_legacy_rsvp_idempotent(
  p_event_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_row public.events%rowtype;
  idempotency_row public.legacy_rsvp_idempotency_records%rowtype;
  source_relation regclass;
  relation_inspection jsonb;
  payload_key_count integer;
  insertable_key_count integer;
  insert_columns text;
  result jsonb := '{"ok":true}'::jsonb;
begin
  if p_idempotency_key is null
     or char_length(p_idempotency_key) not between 8 and 128
     or p_request_hash is null
     or p_request_hash !~ '^[a-f0-9]{64}$'
     or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'invalid_legacy_rsvp_idempotency_payload';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_event_id::text || ':legacy-rsvp:' || p_idempotency_key,
    0
  ));

  select * into idempotency_row
  from public.legacy_rsvp_idempotency_records record
  where record.event_id = p_event_id
    and record.idempotency_key = p_idempotency_key;
  if found then
    if idempotency_row.request_hash is distinct from p_request_hash then
      raise exception using errcode = '22023', message = 'idempotency_key_reused';
    end if;
    return idempotency_row.response || jsonb_build_object('idempotentReplay', true);
  end if;

  select * into event_row
  from public.events event
  where event.id = p_event_id
  for share;
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

  source_relation := to_regclass(format('%I.%I', 'public', event_row.legacy_table_name));
  if source_relation is null then
    raise exception using errcode = '55000', message = 'legacy_source_missing';
  end if;

  select count(*)::integer
  into payload_key_count
  from jsonb_object_keys(p_payload);

  if payload_key_count = 0 then
    execute format('insert into %s default values', source_relation);
  else
    select
      count(*)::integer,
      string_agg(format('%I', payload_key.key), ', ' order by payload_key.key)
    into insertable_key_count, insert_columns
    from jsonb_object_keys(p_payload) payload_key(key)
    join information_schema.columns column_definition
      on column_definition.table_schema = 'public'
     and column_definition.table_name = event_row.legacy_table_name
     and column_definition.column_name = payload_key.key
     and column_definition.is_generated = 'NEVER'
     and column_definition.is_identity = 'NO';

    if insertable_key_count is distinct from payload_key_count then
      raise exception using errcode = '22023', message = 'legacy_payload_column_mismatch';
    end if;

    execute format(
      'insert into %s (%s) select %s from jsonb_populate_record(null::%s, $1)',
      source_relation,
      insert_columns,
      insert_columns,
      source_relation
    ) using p_payload;
  end if;

  insert into public.legacy_rsvp_idempotency_records(
    event_id, idempotency_key, request_hash, response
  ) values (
    p_event_id, p_idempotency_key, p_request_hash, result
  );

  return result || jsonb_build_object('idempotentReplay', false);
end;
$$;

create or replace function public.crm_create_invitation_group(
  p_event_id uuid,
  p_display_name text,
  p_group_key text,
  p_phone_e164 text,
  p_consent_at timestamptz,
  p_consent_source text,
  p_token_hash text,
  p_token_last4 text,
  p_token_ciphertext text,
  p_members jsonb,
  p_labels jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group_id uuid;
  new_guest_id uuid;
  tag_id_value uuid;
  member jsonb;
  label_value text;
begin
  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception using errcode = '23503', message = 'event_not_found';
  end if;
  if p_phone_e164 is null or p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' or
     p_display_name is null or
     char_length(btrim(p_display_name)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'invalid_group_payload';
  end if;
  if (p_group_key is not null and char_length(btrim(p_group_key)) > 120) or
     p_consent_source is null or p_consent_source not in ('manual', 'csv', 'rsvp', 'legacy') or
     p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or
     p_token_last4 is null or p_token_last4 !~ '^[A-Za-z0-9_-]{4}$' or
     p_token_ciphertext is null or char_length(p_token_ciphertext) not between 16 and 4096 then
    raise exception using errcode = '22023', message = 'invalid_group_payload';
  end if;
  if jsonb_typeof(p_members) is distinct from 'array' or
     jsonb_typeof(p_labels) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'invalid_group_payload';
  end if;
  if jsonb_array_length(p_members) not between 1 and 30 or
     jsonb_array_length(p_labels) > 20 then
    raise exception using errcode = '22023', message = 'invalid_group_payload';
  end if;

  insert into public.invitation_groups(
    event_id, display_name, group_key, phone_e164, invitation_token_hash,
    invitation_token_last4, invitation_token_ciphertext, consent_at, consent_source
  ) values (
    p_event_id, btrim(p_display_name), nullif(btrim(p_group_key), ''), p_phone_e164, p_token_hash,
    p_token_last4, p_token_ciphertext, p_consent_at, p_consent_source
  ) returning id into new_group_id;

  for member in select value from jsonb_array_elements(p_members)
  loop
    if member ->> 'name' is null or
       char_length(btrim(member ->> 'name')) not between 1 and 120 or
       coalesce(member ->> 'attendanceStatus', 'pending') not in ('pending', 'attending', 'declined') then
      raise exception using errcode = '22023', message = 'invalid_guest_payload';
    end if;
    insert into public.guests(event_id, group_id, name, attendance_status, attendance_source)
    values (
      p_event_id,
      new_group_id,
      btrim(member ->> 'name'),
      coalesce(member ->> 'attendanceStatus', 'pending'),
      'admin'
    ) returning id into new_guest_id;

    for label_value in select btrim(value #>> '{}') from jsonb_array_elements(p_labels)
    loop
      if label_value is null or char_length(label_value) not between 1 and 50 then
        raise exception using errcode = '22023', message = 'invalid_tag_payload';
      end if;
      -- 001 uses a partial case-insensitive unique index, so a named column
      -- conflict target would not match it. The advisory lock also makes the
      -- select/insert pair safe for concurrent CSV imports.
      perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':tag:' || lower(label_value), 0));
      select id into tag_id_value
      from public.tags
      where event_id = p_event_id and lower(name) = lower(label_value)
      limit 1;
      if tag_id_value is null then
        insert into public.tags(event_id, name, color)
        values (p_event_id, label_value, '#94A3B8')
        returning id into tag_id_value;
      end if;

      insert into public.guest_tags(event_id, guest_id, tag_id)
      values (p_event_id, new_guest_id, tag_id_value)
      on conflict do nothing;
    end loop;
  end loop;

  return jsonb_build_object('groupId', new_group_id);
end;
$$;

create or replace function public.crm_import_invitation_groups(
  p_event_id uuid,
  p_groups jsonb
)
returns table(import_key text, group_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  group_value jsonb;
  result jsonb;
begin
  if jsonb_typeof(p_groups) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'invalid_import_payload';
  end if;
  if jsonb_array_length(p_groups) not between 1 and 5000 then
    raise exception using errcode = '22023', message = 'invalid_import_payload';
  end if;

  for group_value in select value from jsonb_array_elements(p_groups)
  loop
    result := public.crm_create_invitation_group(
      p_event_id,
      group_value ->> 'displayName',
      group_value ->> 'groupKey',
      group_value ->> 'phoneE164',
      nullif(group_value ->> 'consentAt', '')::timestamptz,
      group_value ->> 'consentSource',
      group_value ->> 'tokenHash',
      group_value ->> 'tokenLast4',
      group_value ->> 'tokenCiphertext',
      group_value -> 'members',
      group_value -> 'labels'
    );
    import_key := group_value ->> 'importKey';
    group_id := (result ->> 'groupId')::uuid;
    return next;
  end loop;
end;
$$;

create or replace function public.crm_create_invitation_group_idempotent(
  p_event_id uuid,
  p_display_name text,
  p_group_key text,
  p_phone_e164 text,
  p_consent_at timestamptz,
  p_consent_source text,
  p_token_hash text,
  p_token_last4 text,
  p_token_ciphertext text,
  p_members jsonb,
  p_labels jsonb,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  idempotency_row public.crm_idempotency_records%rowtype;
  mutation_result jsonb;
begin
  if p_idempotency_key is null or
     char_length(p_idempotency_key) not between 8 and 128 or
     p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_idempotency_arguments';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_event_id::text || ':manual_group:' || p_idempotency_key,
    0
  ));
  select * into idempotency_row
  from public.crm_idempotency_records
  where event_id = p_event_id
    and operation = 'manual_group'
    and idempotency_key = p_idempotency_key;

  if found then
    if idempotency_row.request_hash is distinct from p_request_hash then
      raise exception using errcode = '22023', message = 'idempotency_key_reused';
    end if;
    return jsonb_build_object(
      'result', idempotency_row.response,
      'idempotentReplay', true
    );
  end if;

  mutation_result := public.crm_create_invitation_group(
    p_event_id,
    p_display_name,
    p_group_key,
    p_phone_e164,
    p_consent_at,
    p_consent_source,
    p_token_hash,
    p_token_last4,
    p_token_ciphertext,
    p_members,
    p_labels
  );
  insert into public.crm_idempotency_records(
    event_id, operation, idempotency_key, request_hash, response
  ) values (
    p_event_id, 'manual_group', p_idempotency_key, p_request_hash, mutation_result
  );
  return jsonb_build_object('result', mutation_result, 'idempotentReplay', false);
end;
$$;

create or replace function public.crm_import_invitation_groups_idempotent(
  p_event_id uuid,
  p_groups jsonb,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  idempotency_row public.crm_idempotency_records%rowtype;
  mutation_result jsonb;
begin
  if p_idempotency_key is null or
     char_length(p_idempotency_key) not between 8 and 128 or
     p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_idempotency_arguments';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_event_id::text || ':csv_import:' || p_idempotency_key,
    0
  ));
  select * into idempotency_row
  from public.crm_idempotency_records
  where event_id = p_event_id
    and operation = 'csv_import'
    and idempotency_key = p_idempotency_key;

  if found then
    if idempotency_row.request_hash is distinct from p_request_hash then
      raise exception using errcode = '22023', message = 'idempotency_key_reused';
    end if;
    return jsonb_build_object(
      'result', idempotency_row.response,
      'idempotentReplay', true
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('importKey', imported.import_key, 'groupId', imported.group_id)
      order by imported.import_key
    ),
    '[]'::jsonb
  ) into mutation_result
  from public.crm_import_invitation_groups(p_event_id, p_groups) imported;

  insert into public.crm_idempotency_records(
    event_id, operation, idempotency_key, request_hash, response
  ) values (
    p_event_id, 'csv_import', p_idempotency_key, p_request_hash, mutation_result
  );
  return jsonb_build_object('result', mutation_result, 'idempotentReplay', false);
end;
$$;

create or replace function public.submit_token_rsvp(
  p_event_slug text,
  p_token_hash text,
  p_responses jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.events%rowtype;
  group_row public.invitation_groups%rowtype;
  guest_row public.guests%rowtype;
  response_value jsonb;
  updated_count integer := 0;
  new_status text;
  next_pending_guest_id uuid;
  outbound_sending_count integer := 0;
  reminder_sending_count integer := 0;
begin
  select * into event_row from public.events where slug = p_event_slug;
  if not found then
    raise exception using errcode = 'P0002', message = 'INVALID_TOKEN';
  end if;

  select * into group_row
  from public.invitation_groups
  where event_id = event_row.id and invitation_token_hash = p_token_hash
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'INVALID_TOKEN';
  end if;
  if event_row.rsvp_status = 'closed' or
     (event_row.rsvp_opens_at is not null and now() < event_row.rsvp_opens_at) or
     (event_row.rsvp_status = 'scheduled' and event_row.rsvp_opens_at is null) or
     (event_row.rsvp_deadline is not null and now() >= event_row.rsvp_deadline) or
     (event_row.event_at is not null and now() >= event_row.event_at) then
    raise exception using errcode = 'P0001', message = 'RSVP_CLOSED';
  end if;
  if jsonb_typeof(p_responses) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'invalid_rsvp_payload';
  end if;
  if jsonb_array_length(p_responses) not between 1 and 30 then
    raise exception using errcode = '22023', message = 'invalid_rsvp_payload';
  end if;
  if (
    select count(*) <> count(distinct value ->> 'guestId')
    from jsonb_array_elements(p_responses)
  ) then
    raise exception using errcode = '22023', message = 'duplicate_guest_response';
  end if;

  -- Both web RSVP and WhatsApp use group -> conversation -> guest locking.
  -- This also prevents an in-flight chat answer from overwriting the web RSVP.
  perform id
  from public.whatsapp_conversations
  where group_id = group_row.id
    and state in ('awaiting_attendance', 'awaiting_change_selection', 'review', 'completed')
  order by id
  for update;

  for response_value in select value from jsonb_array_elements(p_responses)
  loop
    new_status := response_value ->> 'attendanceStatus';
    if new_status not in ('attending', 'declined') then
      raise exception using errcode = '22023', message = 'invalid_attendance_status';
    end if;
    select * into guest_row
    from public.guests
    where id = (response_value ->> 'guestId')::uuid
      and group_id = group_row.id
      and event_id = event_row.id
    for update;
    if not found then
      raise exception using errcode = '42501', message = 'guest_not_in_invitation';
    end if;

    update public.guests set
      attendance_status = new_status,
      attendance_source = case
        when attendance_status is distinct from new_status then 'web'
        else attendance_source
      end,
      dietary_preferences = case
        when response_value ? 'dietaryPreferences'
          then array(select jsonb_array_elements_text(response_value -> 'dietaryPreferences'))
        else dietary_preferences
      end,
      favorite_song = case
        when response_value ? 'favoriteSong' then nullif(btrim(response_value ->> 'favoriteSong'), '')
        else favorite_song
      end,
      drink_preferences = case
        when response_value ? 'drinkPreferences'
          then array(select jsonb_array_elements_text(response_value -> 'drinkPreferences'))
        else drink_preferences
      end,
      table_id = case when new_status = 'declined' then null else table_id end,
      updated_at = now()
    where id = guest_row.id;

    updated_count := updated_count + 1;
  end loop;

  select id into next_pending_guest_id
  from public.guests
  where group_id = group_row.id and attendance_status = 'pending'
  order by created_at, id
  limit 1;

  -- A web RSVP supersedes a queued chat prompt. Claimed work is conservatively
  -- uncertain because the provider call may already be in progress.
  with finalized as (
    update public.whatsapp_outbound_jobs outbound_job set
      status = case when outbound_job.status = 'sending' then 'uncertain' else 'cancelled' end,
      error_code = case
        when outbound_job.status = 'sending' then 'RSVP_SUPERSEDED_RACE'
        else 'RSVP_SUPERSEDED'
      end,
      failed_at = case when outbound_job.status = 'sending' then now() else outbound_job.failed_at end,
      locked_at = null,
      locked_by = null,
      updated_at = now()
    where outbound_job.group_id = group_row.id
      and outbound_job.action <> 'opt_out_confirmation'
      and outbound_job.status in ('queued', 'failed', 'sending')
    returning outbound_job.status
  )
  select count(*) filter (where status = 'uncertain')
  into outbound_sending_count
  from finalized;

  if next_pending_guest_id is null then
    with finalized as (
      update public.message_deliveries delivery set
        status = case when delivery.status = 'sending' then 'uncertain' else 'cancelled' end,
        error_code = case
          when delivery.status = 'sending' then 'RSVP_SUPERSEDED_RACE'
          else 'RSVP_COMPLETED'
        end,
        error_detail = case
          when delivery.status = 'sending'
            then 'Web RSVP completed while the provider outcome was unknown; manual review required.'
          else delivery.error_detail
        end,
        failed_at = case when delivery.status = 'sending' then now() else delivery.failed_at end,
        locked_at = null,
        locked_by = null,
        updated_at = now()
      from public.message_campaigns campaign
      where campaign.id = delivery.campaign_id
        and campaign.kind = 'reminder'
        and delivery.group_id = group_row.id
        and delivery.status in ('queued', 'failed', 'sending')
      returning delivery.status
    )
    select count(*) filter (where status = 'uncertain')
    into reminder_sending_count
    from finalized;

    update public.message_campaigns campaign set
      status = 'completed',
      completed_at = coalesce(campaign.completed_at, now()),
      updated_at = now()
    where campaign.kind = 'reminder'
      and campaign.status in ('queued', 'running')
      and exists (
        select 1 from public.message_deliveries delivery
        where delivery.campaign_id = campaign.id and delivery.group_id = group_row.id
      )
      and not exists (
        select 1 from public.message_deliveries delivery
        where delivery.campaign_id = campaign.id
          and delivery.status in ('queued', 'sending', 'failed')
      );
  end if;

  if next_pending_guest_id is null then
    update public.whatsapp_conversations set
      state = 'completed',
      current_guest_id = null,
      last_outbound_message_id = null,
      requires_review = outbound_sending_count > 0 or reminder_sending_count > 0,
      completed_at = now(),
      updated_at = now()
    where group_id = group_row.id
      and state in ('awaiting_attendance', 'awaiting_change_selection', 'review', 'completed');
  else
    update public.whatsapp_conversations set
      state = 'review',
      current_guest_id = next_pending_guest_id,
      last_outbound_message_id = null,
      requires_review = true,
      completed_at = null,
      updated_at = now()
    where group_id = group_row.id
      and state in ('awaiting_attendance', 'awaiting_change_selection', 'review', 'completed');
  end if;

  return jsonb_build_object('updatedGuests', updated_count);
end;
$$;

create or replace function public.create_message_campaign(
  p_event_id uuid,
  p_kind text,
  p_group_ids uuid[],
  p_idempotency_key text,
  p_preview_hash text,
  p_custom_message text,
  p_scheduled_for timestamptz,
  p_request_hash text,
  p_requested_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_row public.message_campaigns%rowtype;
  replay boolean := false;
  inserted_deliveries integer := 0;
begin
  if p_kind is null or p_kind not in ('invitation', 'reminder', 'table_notice', 'table_correction') or
     p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 128 or
     p_preview_hash is null or p_preview_hash !~ '^[a-f0-9]{64}$' or
     p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' or
     p_group_ids is null then
    raise exception using errcode = '22023', message = 'invalid_campaign_payload';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':campaign:' || p_kind, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':' || p_idempotency_key, 0));
  select * into campaign_row
  from public.message_campaigns
  where event_id = p_event_id and idempotency_key = p_idempotency_key;

  if found then
    if campaign_row.kind is distinct from p_kind or
       campaign_row.preview_hash is distinct from p_preview_hash or
       campaign_row.metadata ->> 'requestHash' is distinct from p_request_hash or
       campaign_row.custom_message is distinct from nullif(btrim(p_custom_message), '') or
       (p_scheduled_for is not null and campaign_row.scheduled_for is distinct from p_scheduled_for) then
      raise exception using errcode = '22023', message = 'idempotency_key_reused';
    end if;
    replay := true;
  else
    insert into public.message_campaigns(
      event_id, kind, status, scheduled_for, custom_message,
      idempotency_key, preview_hash, requested_by, metadata
    ) values (
      p_event_id, p_kind, 'queued', coalesce(p_scheduled_for, now()), nullif(btrim(p_custom_message), ''),
      p_idempotency_key, p_preview_hash, p_requested_by,
      jsonb_build_object('requestHash', p_request_hash)
    ) returning * into campaign_row;

    insert into public.message_deliveries(
      campaign_id, event_id, group_id, status, next_attempt_at, payload
    )
    select
      campaign_row.id,
      p_event_id,
      invitation_groups.id,
      'queued',
      coalesce(p_scheduled_for, now()),
      case when p_kind = 'table_correction' then jsonb_build_object(
        'correctsStaleThrough', (
          select max(prior_delivery.stale_at)
          from public.message_deliveries prior_delivery
          where prior_delivery.group_id = invitation_groups.id
            and prior_delivery.is_stale
        )
      ) else '{}'::jsonb end
    from public.invitation_groups
    where event_id = p_event_id
      and id = any(p_group_ids)
      and phone_e164 is not null
      and consent_at is not null
      and not exists (
        select 1 from public.phone_suppressions
        where phone_suppressions.phone_e164 = invitation_groups.phone_e164
      )
      and not exists (
        select 1
        from public.message_deliveries existing_delivery
        join public.message_campaigns existing_campaign
          on existing_campaign.id = existing_delivery.campaign_id
        where existing_delivery.group_id = invitation_groups.id
          and existing_campaign.kind = p_kind
          and existing_delivery.status <> 'cancelled'
          and (
            p_kind <> 'table_correction'
            or not existing_delivery.is_stale
          )
      );
    get diagnostics inserted_deliveries = row_count;

    if p_kind in ('table_notice', 'table_correction') then
      insert into public.message_campaign_alerts(
        campaign_id, event_id, group_id, guest_id, code
      )
      select campaign_row.id, p_event_id, guest.group_id, guest.id, 'missing_table'
      from public.guests guest
      where guest.event_id = p_event_id
        and guest.group_id = any(p_group_ids)
        and guest.attendance_status = 'attending'
        and guest.table_id is null
      on conflict (campaign_id, guest_id, code) do update set resolved_at = null;
    end if;

    if inserted_deliveries = 0 then
      raise exception using errcode = 'P0001', message = 'no_recipients_after_recheck';
    end if;
  end if;

  return jsonb_build_object(
    'campaign', to_jsonb(campaign_row),
    'idempotentReplay', replay
  );
end;
$$;

create or replace function public.acquire_whatsapp_worker_lease(
  p_worker_id text,
  p_ttl_seconds integer default 45
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  acquired boolean;
begin
  if p_ttl_seconds not between 10 and 300 or char_length(p_worker_id) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'invalid_lease_arguments';
  end if;
  insert into public.whatsapp_worker_leases(lease_name, worker_id, expires_at)
  values ('primary', p_worker_id, now() + make_interval(secs => p_ttl_seconds))
  on conflict (lease_name) do update set
    worker_id = excluded.worker_id,
    expires_at = excluded.expires_at,
    updated_at = now()
  where public.whatsapp_worker_leases.expires_at < now()
     or public.whatsapp_worker_leases.worker_id = excluded.worker_id
  returning true into acquired;
  return coalesce(acquired, false);
end;
$$;

create or replace function public.release_whatsapp_worker_lease(p_worker_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.whatsapp_worker_leases
  where lease_name = 'primary' and worker_id = p_worker_id;
$$;

create or replace function public.suppress_whatsapp_phone(
  p_phone_e164 text,
  p_phone_hash text,
  p_event_id uuid default null,
  p_inbound_event_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_campaigns uuid[];
  cancelled_count integer := 0;
  outbound_event_id uuid;
  outbound_group_id uuid;
  outbound_conversation_id uuid;
begin
  if p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' or p_phone_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_suppression_payload';
  end if;

  if p_inbound_event_id is not null and not exists (
    select 1
    from public.whatsapp_inbound_events inbound_event
    where inbound_event.id = p_inbound_event_id
      and inbound_event.phone_hash = p_phone_hash
      and inbound_event.resolution = 'pending'
  ) then
    raise exception using errcode = '40001', message = 'inbound_event_already_processed';
  end if;

  -- Serialize STOP with attendance transitions for every group sharing this
  -- number. This prevents a follow-up job from being inserted after the
  -- suppression sweep has already passed it.
  perform pg_advisory_xact_lock(hashtextextended('whatsapp:phone:' || p_phone_e164, 0));

  select invitation_group.event_id, invitation_group.id, conversation.id
  into outbound_event_id, outbound_group_id, outbound_conversation_id
  from public.invitation_groups invitation_group
  left join public.whatsapp_conversations conversation
    on conversation.group_id = invitation_group.id
   and conversation.state in ('awaiting_attendance', 'awaiting_change_selection', 'completed', 'review')
  where invitation_group.phone_e164 = p_phone_e164
    and (p_event_id is null or invitation_group.event_id = p_event_id)
  order by
    (conversation.state in ('awaiting_attendance', 'awaiting_change_selection')) desc,
    conversation.started_at desc nulls last,
    invitation_group.created_at desc
  limit 1;

  insert into public.phone_suppressions(
    phone_e164, phone_hash, source, reason, event_id
  ) values (
    p_phone_e164, p_phone_hash, 'whatsapp', 'opt_out', p_event_id
  ) on conflict (phone_e164) do update set
    phone_hash = excluded.phone_hash,
    source = 'whatsapp',
    reason = 'opt_out',
    event_id = coalesce(excluded.event_id, public.phone_suppressions.event_id);

  with finalized as (
    update public.message_deliveries delivery set
      -- A delivery already claimed by a worker may have reached WhatsApp. Its
      -- outcome is unknown and must never be rewritten as a safe cancellation.
      status = case when delivery.status = 'sending' then 'uncertain' else 'cancelled' end,
      error_code = case
        when delivery.status = 'sending' then 'SUPPRESSION_RACE'
        else 'PHONE_SUPPRESSED'
      end,
      error_detail = case
        when delivery.status = 'sending'
          then 'Opt-out arrived while the provider outcome was unknown; manual review required.'
        else delivery.error_detail
      end,
      failed_at = case when delivery.status = 'sending' then now() else delivery.failed_at end,
      locked_at = null,
      locked_by = null,
      updated_at = now()
    where delivery.group_id in (
      select id from public.invitation_groups where phone_e164 = p_phone_e164
    )
      and delivery.status in ('queued', 'failed', 'sending')
    returning delivery.campaign_id
  )
  select array_agg(distinct campaign_id), count(*)
  into affected_campaigns, cancelled_count
  from finalized;

  update public.whatsapp_outbound_jobs outbound_job set
    status = case when outbound_job.status = 'sending' then 'uncertain' else 'cancelled' end,
    error_code = case
      when outbound_job.status = 'sending' then 'SUPPRESSION_RACE'
      else 'PHONE_SUPPRESSED'
    end,
    failed_at = case when outbound_job.status = 'sending' then now() else outbound_job.failed_at end,
    locked_at = null,
    locked_by = null,
    updated_at = now()
  where outbound_job.recipient_phone_e164 = p_phone_e164
    and outbound_job.status in ('queued', 'failed', 'sending');

  update public.whatsapp_conversations conversation set
    state = 'opted_out',
    requires_review = false,
    completed_at = now(),
    last_outbound_message_id = null,
    updated_at = now()
  where conversation.group_id in (
    select id from public.invitation_groups where phone_e164 = p_phone_e164
  )
    and conversation.state in ('awaiting_attendance', 'awaiting_change_selection', 'completed', 'review');

  if p_inbound_event_id is not null then
    update public.whatsapp_inbound_events inbound_event set
      resolution = 'opted_out',
      conversation_id = outbound_conversation_id,
      processed_at = now(),
      locked_at = null,
      locked_by = null,
      processing_error_code = null
    where inbound_event.id = p_inbound_event_id
      and inbound_event.resolution = 'pending';
    if not found then
      raise exception using errcode = '40001', message = 'inbound_event_already_processed';
    end if;

    insert into public.whatsapp_outbound_jobs(
      event_id, group_id, conversation_id, source_inbound_event_id,
      recipient_phone_e164, action
    ) values (
      outbound_event_id, outbound_group_id, outbound_conversation_id, p_inbound_event_id,
      p_phone_e164, 'opt_out_confirmation'
    );
  end if;

  if affected_campaigns is not null then
    update public.message_campaigns campaign set
      status = 'completed',
      completed_at = now(),
      updated_at = now()
    where campaign.id = any(affected_campaigns)
      and campaign.status in ('queued', 'running')
      and not exists (
        select 1 from public.message_deliveries delivery
        where delivery.campaign_id = campaign.id
          and delivery.status in ('queued', 'sending', 'failed')
      );
  end if;

  return cancelled_count;
end;
$$;

create or replace function public.claim_whatsapp_inbound_events(
  p_worker_id text,
  p_limit integer default 1
)
returns setof public.whatsapp_inbound_events
language plpgsql
security definer
set search_path = public
as $$
declare
  exhausted_conversation_ids uuid[];
begin
  if p_limit <> 1 or char_length(p_worker_id) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'invalid_inbound_claim_arguments';
  end if;

  with exhausted as (
    update public.whatsapp_inbound_events stale set
      resolution = 'review',
      processed_at = now(),
      locked_at = null,
      locked_by = null,
      processing_error_code = 'WORKER_LOST_RETRY_EXHAUSTED'
    where stale.resolution = 'pending'
      and stale.attempt_count >= 5
      and stale.locked_at < now() - interval '2 minutes'
    returning stale.conversation_id
  )
  select array_agg(distinct conversation_id)
  into exhausted_conversation_ids
  from exhausted
  where conversation_id is not null;

  if exhausted_conversation_ids is not null then
    update public.whatsapp_conversations conversation set
      state = case when conversation.state = 'opted_out' then conversation.state else 'review' end,
      requires_review = conversation.state <> 'opted_out',
      last_outbound_message_id = case
        when conversation.state = 'opted_out' then conversation.last_outbound_message_id
        else null
      end,
      updated_at = now()
    where conversation.id = any(exhausted_conversation_ids);
  end if;

  update public.whatsapp_inbound_events stale set
    locked_at = null,
    locked_by = null,
    next_attempt_at = least(stale.next_attempt_at, now())
  where stale.resolution = 'pending'
    and stale.locked_at < now() - interval '2 minutes';

  return query
  with candidates as (
    select inbound_event.id
    from public.whatsapp_inbound_events inbound_event
    where inbound_event.resolution = 'pending'
      and inbound_event.next_attempt_at <= now()
      and inbound_event.locked_at is null
      and inbound_event.attempt_count < 5
    order by inbound_event.next_attempt_at, inbound_event.created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.whatsapp_inbound_events inbound_event set
      attempt_count = inbound_event.attempt_count + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      processing_error_code = null
    from candidates
    where inbound_event.id = candidates.id
    returning inbound_event.*
  )
  select * from claimed;
end;
$$;

create or replace function public.retry_whatsapp_inbound_event(
  p_inbound_event_id uuid,
  p_worker_id text,
  p_error_code text,
  p_next_attempt_at timestamptz,
  p_conversation_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inbound_row public.whatsapp_inbound_events%rowtype;
begin
  if char_length(p_worker_id) not between 1 and 120
     or p_error_code is null
     or char_length(p_error_code) not between 1 and 64
     or p_error_code !~ '^[A-Z0-9_]+$'
     or p_next_attempt_at is null
     or p_next_attempt_at > now() + interval '1 hour' then
    raise exception using errcode = '22023', message = 'invalid_inbound_retry_arguments';
  end if;

  select * into inbound_row
  from public.whatsapp_inbound_events inbound_event
  where inbound_event.id = p_inbound_event_id
    and inbound_event.resolution = 'pending'
    and inbound_event.locked_by = p_worker_id
  for update;
  if not found then return 'not_pending'; end if;

  if inbound_row.attempt_count >= 5 then
    update public.whatsapp_inbound_events set
      resolution = 'review',
      conversation_id = coalesce(p_conversation_id, conversation_id),
      processed_at = now(),
      locked_at = null,
      locked_by = null,
      processing_error_code = p_error_code
    where id = inbound_row.id;

    if p_conversation_id is not null then
      update public.whatsapp_conversations conversation set
        state = case when conversation.state = 'opted_out' then conversation.state else 'review' end,
        requires_review = conversation.state <> 'opted_out',
        last_outbound_message_id = null,
        updated_at = now()
      where conversation.id = p_conversation_id;
    end if;
    return 'review';
  end if;

  update public.whatsapp_inbound_events set
    conversation_id = coalesce(p_conversation_id, conversation_id),
    next_attempt_at = p_next_attempt_at,
    locked_at = null,
    locked_by = null,
    processing_error_code = p_error_code
  where id = inbound_row.id;
  return 'retry';
end;
$$;

create or replace function public.apply_whatsapp_provider_status(
  p_provider_message_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  status_row public.whatsapp_provider_status_events%rowtype;
begin
  select * into status_row
  from public.whatsapp_provider_status_events provider_status
  where provider_status.provider_message_id = p_provider_message_id;
  if not found then return; end if;

  update public.message_deliveries delivery set
    status = case status_row.status
      when 'sent' then case
        when delivery.status in ('delivered', 'read') then delivery.status
        else 'sent'
      end
      when 'delivered' then case when delivery.status = 'read' then 'read' else 'delivered' end
      when 'read' then 'read'
      when 'failed' then case when delivery.status = 'read' then 'read' else 'uncertain' end
    end,
    delivered_at = case
      when status_row.status in ('delivered', 'read')
        then coalesce(delivery.delivered_at, status_row.occurred_at)
      else delivery.delivered_at
    end,
    read_at = case
      when status_row.status = 'read' then coalesce(delivery.read_at, status_row.occurred_at)
      else delivery.read_at
    end,
    failed_at = case
      when status_row.status = 'failed' and delivery.status <> 'read'
        then coalesce(delivery.failed_at, status_row.occurred_at)
      else delivery.failed_at
    end,
    error_code = case
      when status_row.status = 'failed' and delivery.status <> 'read'
        then 'PROVIDER_REPORTED_FAILURE'
      when status_row.status <> 'failed' then null
      else delivery.error_code
    end,
    error_detail = case
      when status_row.status = 'failed' and delivery.status <> 'read'
        then 'The provider reported failure after accepting the message; automatic retry is disabled.'
      when status_row.status <> 'failed' then null
      else delivery.error_detail
    end,
    updated_at = now()
  where delivery.provider_message_id = p_provider_message_id
    and delivery.status in ('sent', 'delivered', 'read', 'uncertain');

  update public.whatsapp_outbound_jobs outbound_job set
    status = case status_row.status
      when 'sent' then case
        when outbound_job.status in ('delivered', 'read') then outbound_job.status
        else 'sent'
      end
      when 'delivered' then case when outbound_job.status = 'read' then 'read' else 'delivered' end
      when 'read' then 'read'
      when 'failed' then case when outbound_job.status = 'read' then 'read' else 'uncertain' end
    end,
    delivered_at = case
      when status_row.status in ('delivered', 'read')
        then coalesce(outbound_job.delivered_at, status_row.occurred_at)
      else outbound_job.delivered_at
    end,
    read_at = case
      when status_row.status = 'read' then coalesce(outbound_job.read_at, status_row.occurred_at)
      else outbound_job.read_at
    end,
    failed_at = case
      when status_row.status = 'failed' and outbound_job.status <> 'read'
        then coalesce(outbound_job.failed_at, status_row.occurred_at)
      else outbound_job.failed_at
    end,
    error_code = case
      when status_row.status = 'failed' and outbound_job.status <> 'read'
        then 'PROVIDER_REPORTED_FAILURE'
      when status_row.status <> 'failed' then null
      else outbound_job.error_code
    end,
    updated_at = now()
  where outbound_job.provider_message_id = p_provider_message_id
    and outbound_job.status in ('sent', 'delivered', 'read', 'uncertain');
end;
$$;

create or replace function public.record_whatsapp_provider_status(
  p_provider_message_id text,
  p_status text,
  p_occurred_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_provider_message_id is null
     or char_length(p_provider_message_id) not between 1 and 500
     or p_status not in ('sent', 'delivered', 'read', 'failed')
     or p_occurred_at is null then
    raise exception using errcode = '22023', message = 'invalid_provider_status';
  end if;

  insert into public.whatsapp_provider_status_events(
    provider_message_id, status, occurred_at
  ) values (
    p_provider_message_id, p_status, p_occurred_at
  )
  on conflict (provider_message_id) do update set
    status = case
      when public.whatsapp_provider_status_events.status = 'read'
        or excluded.status = 'read' then 'read'
      when public.whatsapp_provider_status_events.status = 'failed'
        or excluded.status = 'failed' then 'failed'
      when public.whatsapp_provider_status_events.status = 'delivered'
        or excluded.status = 'delivered' then 'delivered'
      else 'sent'
    end,
    occurred_at = greatest(
      public.whatsapp_provider_status_events.occurred_at,
      excluded.occurred_at
    ),
    updated_at = now();

  perform public.apply_whatsapp_provider_status(p_provider_message_id);
  return true;
end;
$$;

create or replace function public.claim_whatsapp_outbound_jobs(
  p_worker_id text,
  p_limit integer default 1
)
returns setof public.whatsapp_outbound_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered_conversation_ids uuid[];
  expired_conversation_ids uuid[];
begin
  if p_limit <> 1 or char_length(p_worker_id) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'invalid_outbound_claim_arguments';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended('whatsapp:outbound-claim', 0)) then
    return;
  end if;

  -- Once a job was claimed, a dead worker may have called the provider. Never
  -- retry that ambiguous operation automatically.
  with recovered as (
    update public.whatsapp_outbound_jobs stale set
      status = 'uncertain',
      error_code = 'WORKER_LOST_AFTER_CLAIM',
      failed_at = now(),
      locked_at = null,
      locked_by = null,
      updated_at = now()
    where stale.status = 'sending'
      and stale.locked_at < now() - interval '10 minutes'
    returning stale.conversation_id
  )
  select array_agg(distinct conversation_id)
  into recovered_conversation_ids
  from recovered
  where conversation_id is not null;

  if recovered_conversation_ids is not null then
    update public.whatsapp_conversations conversation set
      requires_review = true,
      updated_at = now()
    where conversation.id = any(recovered_conversation_ids);
  end if;

  with expired as (
    update public.whatsapp_outbound_jobs outbound_job set
      status = 'cancelled',
      error_code = 'EXPIRED_EVENT_WINDOW',
      locked_at = null,
      locked_by = null,
      updated_at = now()
    from public.events event
    where event.id = outbound_job.event_id
      and outbound_job.action <> 'opt_out_confirmation'
      and outbound_job.status in ('queued', 'failed')
      and event.event_at is not null
      and now() >= event.event_at
    returning outbound_job.conversation_id
  )
  select array_agg(distinct conversation_id)
  into expired_conversation_ids
  from expired
  where conversation_id is not null;

  if expired_conversation_ids is not null then
    update public.whatsapp_conversations conversation set
      state = case
        when conversation.state in ('awaiting_attendance', 'awaiting_change_selection') then 'review'
        else conversation.state
      end,
      requires_review = true,
      updated_at = now()
    where conversation.id = any(expired_conversation_ids);
  end if;

  return query
  with candidates as (
    select outbound_job.id
    from public.whatsapp_outbound_jobs outbound_job
    left join public.events event on event.id = outbound_job.event_id
    left join public.invitation_groups invitation_group on invitation_group.id = outbound_job.group_id
    where outbound_job.status in ('queued', 'failed')
      and outbound_job.next_attempt_at <= now()
      and outbound_job.attempt_count < 5
      and (
        outbound_job.action = 'opt_out_confirmation'
        or (
          event.id is not null
          and event.messaging_enabled
          and invitation_group.id is not null
          and invitation_group.consent_at is not null
          and not exists (
            select 1
            from public.phone_suppressions suppression
            where suppression.phone_e164 = outbound_job.recipient_phone_e164
          )
        )
      )
    order by outbound_job.next_attempt_at, outbound_job.created_at
    for update of outbound_job skip locked
    limit p_limit
  ), claimed as (
    update public.whatsapp_outbound_jobs outbound_job set
      status = 'sending',
      attempt_count = outbound_job.attempt_count + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      updated_at = now()
    from candidates
    where outbound_job.id = candidates.id
    returning outbound_job.*
  )
  select * from claimed;
end;
$$;

create or replace function public.mark_message_delivery_sent(
  p_delivery_id uuid,
  p_provider_message_id text,
  p_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_row public.message_deliveries%rowtype;
begin
  if p_provider_message_id is null
     or char_length(p_provider_message_id) not between 1 and 500
     or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'invalid_delivery_acceptance';
  end if;

  select * into delivery_row
  from public.message_deliveries delivery
  where delivery.id = p_delivery_id
    and delivery.status = 'sending'
  for update;
  if not found then
    raise exception using errcode = '40001', message = 'delivery_finalized';
  end if;

  update public.message_deliveries set
    status = 'sent',
    provider_message_id = p_provider_message_id,
    payload = delivery_row.payload || p_payload,
    sent_at = now(),
    locked_at = null,
    locked_by = null,
    error_code = null,
    error_detail = null,
    updated_at = now()
  where id = delivery_row.id;

  perform public.apply_whatsapp_provider_status(p_provider_message_id);
  return true;
end;
$$;

create or replace function public.mark_whatsapp_outbound_sent(
  p_job_id uuid,
  p_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  job_row public.whatsapp_outbound_jobs%rowtype;
begin
  if p_provider_message_id is null
     or char_length(p_provider_message_id) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'invalid_provider_message_id';
  end if;

  select * into job_row
  from public.whatsapp_outbound_jobs outbound_job
  where outbound_job.id = p_job_id
    and outbound_job.status = 'sending'
  for update;
  if not found then
    raise exception using errcode = '40001', message = 'outbound_job_finalized';
  end if;

  update public.whatsapp_outbound_jobs set
    status = 'sent',
    provider_message_id = p_provider_message_id,
    sent_at = now(),
    locked_at = null,
    locked_by = null,
    error_code = null,
    updated_at = now()
  where id = job_row.id;

  if job_row.conversation_id is not null then
    update public.whatsapp_conversations set
      last_outbound_message_id = p_provider_message_id,
      updated_at = now()
    where id = job_row.conversation_id
      and state in ('awaiting_attendance', 'awaiting_change_selection', 'completed', 'review', 'opted_out');
  end if;

  perform public.apply_whatsapp_provider_status(p_provider_message_id);

  return true;
end;
$$;

create or replace function public.claim_message_deliveries(
  p_worker_id text,
  p_limit integer default 1
)
returns setof public.message_deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered_campaigns uuid[];
  expired_campaigns uuid[];
begin
  -- A single claim keeps the conservative one-message-at-a-time contract and
  -- prevents a batch from spanning multiple queued campaigns.
  if p_limit <> 1 then
    raise exception using errcode = '22023', message = 'invalid_claim_limit';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended('whatsapp:delivery-claim', 0)) then
    return;
  end if;

  with recovered as (
    update public.message_deliveries stale set
      status = 'uncertain',
      error_code = 'WORKER_LOST_AFTER_CLAIM',
      error_detail = 'Delivery outcome is unknown; automatic retry is disabled.',
      failed_at = now(),
      locked_at = null,
      locked_by = null,
      updated_at = now()
    where stale.status = 'sending'
      and stale.locked_at < now() - interval '10 minutes'
    returning stale.campaign_id
  )
  select array_agg(distinct campaign_id)
  into recovered_campaigns
  from recovered;

  -- A crashed worker must not leave the global single-campaign guard locked.
  if recovered_campaigns is not null then
    update public.message_campaigns campaign set
      status = 'completed',
      completed_at = now(),
      updated_at = now()
    where campaign.id = any(recovered_campaigns)
      and campaign.status in ('queued', 'running')
      and not exists (
        select 1
        from public.message_deliveries delivery
        where delivery.campaign_id = campaign.id
          and delivery.status in ('queued', 'sending', 'failed')
      );
  end if;

  -- Queued work can outlive an outage or a kill-switch pause. Expire it before
  -- claiming so reminders never enter the final 24-hour window and no message
  -- from an old campaign is sent after the event starts.
  with expired as (
    update public.message_deliveries delivery set
      status = 'cancelled',
      error_code = 'EXPIRED_EVENT_WINDOW',
      locked_at = null,
      locked_by = null,
      updated_at = now()
    from public.message_campaigns campaign, public.events event
    where campaign.id = delivery.campaign_id
      and event.id = delivery.event_id
      and delivery.status in ('queued', 'failed')
      and event.event_at is not null
      and (
        (campaign.kind = 'reminder' and now() > event.event_at - interval '24 hours')
        or (campaign.kind <> 'reminder' and now() >= event.event_at)
      )
    returning delivery.campaign_id
  )
  select array_agg(distinct campaign_id)
  into expired_campaigns
  from expired;

  if expired_campaigns is not null then
    update public.message_campaigns campaign set
      status = 'completed',
      completed_at = now(),
      updated_at = now()
    where campaign.id = any(expired_campaigns)
      and campaign.status in ('queued', 'running')
      and not exists (
        select 1
        from public.message_deliveries delivery
        where delivery.campaign_id = campaign.id
          and delivery.status in ('queued', 'sending', 'failed')
      );
  end if;

  return query
  with candidates as (
    select delivery.id
    from public.message_deliveries delivery
    join public.message_campaigns campaign on campaign.id = delivery.campaign_id
    join public.events event on event.id = delivery.event_id
    join public.invitation_groups invitation_group on invitation_group.id = delivery.group_id
    where delivery.status in ('queued', 'failed')
      and delivery.next_attempt_at <= now()
      and delivery.attempt_count < 5
      and campaign.status in ('queued', 'running')
      and campaign.scheduled_for <= now()
      and event.messaging_enabled
      and invitation_group.phone_e164 is not null
      and invitation_group.consent_at is not null
      and (
        campaign.status = 'running'
        or not exists (
          select 1 from public.message_campaigns running_campaign
          where running_campaign.status = 'running'
        )
      )
      and not exists (
        select 1 from public.phone_suppressions suppression
        where suppression.phone_e164 = invitation_group.phone_e164
      )
    order by delivery.next_attempt_at, delivery.created_at
    for update of delivery, campaign skip locked
    limit p_limit
  ), claimed as (
    update public.message_deliveries delivery set
      status = 'sending',
      attempt_count = delivery.attempt_count + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      updated_at = now()
    from candidates
    where delivery.id = candidates.id
    returning delivery.*
  ), started as (
    update public.message_campaigns campaign set
      status = 'running',
      completed_at = null,
      updated_at = now()
    where campaign.id in (select claimed.campaign_id from claimed)
      and campaign.status in ('queued', 'running')
    returning campaign.id
  )
  select claimed.*
  from claimed
  join started on started.id = claimed.campaign_id;
end;
$$;

create or replace function public.enqueue_due_message_automations(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.events%rowtype;
  campaign_id_value uuid;
  inserted_count integer := 0;
  affected integer;
  local_now timestamp;
  local_event timestamp;
  local_due timestamp;
begin
  for event_row in
    select * from public.events
    where messaging_enabled and event_at > p_now
      and exists (
        select 1 from pg_catalog.pg_timezone_names timezone_name
        where timezone_name.name = events.timezone
      )
  loop
    local_now := p_now at time zone event_row.timezone;
    local_event := event_row.event_at at time zone event_row.timezone;

    if event_row.reminder_enabled then
      local_due := (local_event::date - event_row.reminder_days_before) + event_row.reminder_time;
      if local_now >= local_due and p_now <= event_row.event_at - interval '24 hours' then
        perform pg_advisory_xact_lock(hashtextextended(event_row.id::text || ':campaign:reminder', 0));
        insert into public.message_campaigns(
          event_id, kind, status, scheduled_for, idempotency_key, preview_hash, metadata
        ) values (
          event_row.id, 'reminder', 'queued', p_now,
          'auto:reminder:' || event_row.id::text, repeat('0', 64), '{"automatic":true}'::jsonb
        ) on conflict (event_id, idempotency_key) do update set updated_at = now()
        returning id into campaign_id_value;

        insert into public.message_deliveries(campaign_id, event_id, group_id, status, next_attempt_at)
        select campaign_id_value, event_row.id, invitation_group.id, 'queued', p_now
        from public.invitation_groups invitation_group
        where invitation_group.event_id = event_row.id
          and invitation_group.phone_e164 is not null
          and invitation_group.consent_at is not null
          and exists (
            select 1 from public.guests guest
            where guest.group_id = invitation_group.id and guest.attendance_status = 'pending'
          )
          and exists (
            select 1
            from public.message_deliveries invitation_delivery
            join public.message_campaigns invitation_campaign
              on invitation_campaign.id = invitation_delivery.campaign_id
            where invitation_delivery.group_id = invitation_group.id
              and invitation_campaign.kind = 'invitation'
              and invitation_delivery.status in ('sent', 'delivered', 'read')
              and invitation_delivery.sent_at <= p_now - interval '24 hours'
          )
          and not exists (
            select 1
            from public.message_deliveries prior_delivery
            join public.message_campaigns prior_campaign on prior_campaign.id = prior_delivery.campaign_id
            where prior_delivery.group_id = invitation_group.id
              and prior_campaign.kind = 'reminder'
          )
          and not exists (
            select 1 from public.phone_suppressions suppression
            where suppression.phone_e164 = invitation_group.phone_e164
          )
        on conflict (campaign_id, group_id) do nothing;
        get diagnostics affected = row_count;
        inserted_count := inserted_count + affected;
        if affected > 0 then
          update public.message_campaigns set
            status = 'queued',
            completed_at = null,
            updated_at = now()
          where id = campaign_id_value and status = 'completed';
        else
          update public.message_campaigns campaign set
            status = 'completed',
            completed_at = coalesce(campaign.completed_at, now()),
            updated_at = now()
          where campaign.id = campaign_id_value
            and campaign.status = 'queued'
            and not exists (
              select 1 from public.message_deliveries delivery
              where delivery.campaign_id = campaign.id
                and delivery.status in ('queued', 'sending', 'failed')
            );
        end if;
      end if;
    end if;

    if event_row.table_notice_enabled then
      local_due := (local_event::date - event_row.table_notice_days_before) + event_row.table_notice_time;
      if local_now >= local_due then
        perform pg_advisory_xact_lock(hashtextextended(event_row.id::text || ':campaign:table_notice', 0));
        insert into public.message_campaigns(
          event_id, kind, status, scheduled_for, custom_message,
          idempotency_key, preview_hash, metadata
        ) values (
          event_row.id, 'table_notice', 'queued', p_now, event_row.table_notice_message,
          'auto:table_notice:' || event_row.id::text, repeat('0', 64), '{"automatic":true}'::jsonb
        ) on conflict (event_id, idempotency_key) do update set
          custom_message = excluded.custom_message,
          updated_at = now()
        returning id into campaign_id_value;

        insert into public.message_deliveries(campaign_id, event_id, group_id, status, next_attempt_at)
        select distinct campaign_id_value, event_row.id, invitation_group.id, 'queued', p_now
        from public.invitation_groups invitation_group
        join public.guests guest on guest.group_id = invitation_group.id
        where invitation_group.event_id = event_row.id
          and invitation_group.phone_e164 is not null
          and invitation_group.consent_at is not null
          and guest.attendance_status = 'attending'
          and guest.table_id is not null
          and not exists (
            select 1 from public.phone_suppressions suppression
            where suppression.phone_e164 = invitation_group.phone_e164
          )
        on conflict (campaign_id, group_id) do nothing;
        get diagnostics affected = row_count;
        inserted_count := inserted_count + affected;
        if affected > 0 then
          update public.message_campaigns set
            status = 'queued',
            completed_at = null,
            updated_at = now()
          where id = campaign_id_value and status = 'completed';
        else
          update public.message_campaigns campaign set
            status = 'completed',
            completed_at = coalesce(campaign.completed_at, now()),
            updated_at = now()
          where campaign.id = campaign_id_value
            and campaign.status = 'queued'
            and not exists (
              select 1 from public.message_deliveries delivery
              where delivery.campaign_id = campaign.id
                and delivery.status in ('queued', 'sending', 'failed')
            );
        end if;

        insert into public.message_campaign_alerts(
          campaign_id, event_id, group_id, guest_id, code
        )
        select campaign_id_value, event_row.id, guest.group_id, guest.id, 'missing_table'
        from public.guests guest
        join public.invitation_groups invitation_group on invitation_group.id = guest.group_id
        where guest.event_id = event_row.id
          and guest.attendance_status = 'attending'
          and guest.table_id is null
          and invitation_group.consent_at is not null
        on conflict (campaign_id, guest_id, code) do update set resolved_at = null;
      end if;
    end if;
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.advance_whatsapp_attendance(
  p_conversation_id uuid,
  p_guest_id uuid,
  p_status text,
  p_next_state text,
  p_next_guest_id uuid,
  p_invalid_attempts integer,
  p_inbound_event_id uuid,
  p_outbound_action text,
  p_outbound_guest_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_row public.whatsapp_conversations%rowtype;
  guest_row public.guests%rowtype;
  group_row public.invitation_groups%rowtype;
  group_id_value uuid;
  phone_value text;
begin
  if p_status not in ('attending', 'declined') then
    raise exception using errcode = '22023', message = 'invalid_attendance_status';
  end if;
  if p_next_state not in ('awaiting_attendance', 'awaiting_change_selection', 'completed', 'review') or
     p_invalid_attempts not between 0 and 100 or
     p_inbound_event_id is null or
     p_outbound_action not in (
       'ask_attendance', 'ask_change_selection', 'send_summary', 'invalid_prompt', 'review_notice'
     ) or
     (p_outbound_action = 'ask_attendance') is distinct from (p_outbound_guest_id is not null) then
    raise exception using errcode = '22023', message = 'invalid_conversation_transition';
  end if;
  -- Resolve the immutable owner without locking, then take locks in the same
  -- group -> conversation -> guest order as submit_token_rsvp.
  select conversation.group_id, invitation_group.phone_e164
  into group_id_value, phone_value
  from public.whatsapp_conversations conversation
  join public.invitation_groups invitation_group on invitation_group.id = conversation.group_id
  where conversation.id = p_conversation_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'conversation_not_active';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('whatsapp:phone:' || phone_value, 0));

  select * into group_row
  from public.invitation_groups
  where id = group_id_value
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'conversation_group_not_found';
  end if;
  if exists (
    select 1 from public.phone_suppressions suppression
    where suppression.phone_e164 = group_row.phone_e164
  ) then
    raise exception using errcode = '55000', message = 'phone_suppressed';
  end if;

  select * into conversation_row
  from public.whatsapp_conversations
  where id = p_conversation_id
    and group_id = group_id_value
    and state in ('awaiting_attendance', 'awaiting_change_selection')
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'conversation_not_active';
  end if;
  if conversation_row.current_guest_id is distinct from p_guest_id then
    raise exception using errcode = '40001', message = 'conversation_state_changed';
  end if;
  select * into guest_row
  from public.guests
  where id = p_guest_id
    and event_id = conversation_row.event_id
    and group_id = conversation_row.group_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'guest_not_in_conversation';
  end if;

  update public.guests set
    attendance_status = p_status,
    attendance_source = case
      when attendance_status is distinct from p_status then 'whatsapp'
      else attendance_source
    end,
    table_id = case when p_status = 'declined' then null else table_id end,
    updated_at = now()
  where id = guest_row.id;

  if p_next_guest_id is not null and not exists (
    select 1 from public.guests
    where id = p_next_guest_id
      and event_id = conversation_row.event_id
      and group_id = conversation_row.group_id
  ) then
    raise exception using errcode = '42501', message = 'next_guest_not_in_conversation';
  end if;
  if p_outbound_guest_id is not null and not exists (
    select 1 from public.guests
    where id = p_outbound_guest_id
      and event_id = conversation_row.event_id
      and group_id = conversation_row.group_id
  ) then
    raise exception using errcode = '42501', message = 'outbound_guest_not_in_conversation';
  end if;

  update public.whatsapp_conversations set
    state = p_next_state,
    current_guest_id = p_next_guest_id,
    invalid_attempts = p_invalid_attempts,
    last_outbound_message_id = null,
    requires_review = p_next_state = 'review',
    completed_at = case when p_next_state = 'completed' then now() else null end,
    updated_at = now()
  where id = conversation_row.id;

  update public.whatsapp_inbound_events inbound_event set
    resolution = case when p_next_state = 'review' then 'review' else 'applied' end,
    conversation_id = conversation_row.id,
    processed_at = now(),
    locked_at = null,
    locked_by = null,
    processing_error_code = null
  where inbound_event.id = p_inbound_event_id
    and inbound_event.resolution = 'pending';
  if not found then
    raise exception using errcode = '40001', message = 'inbound_event_already_processed';
  end if;

  insert into public.whatsapp_outbound_jobs(
    event_id, group_id, conversation_id, source_inbound_event_id,
    recipient_phone_e164, action, guest_id
  ) values (
    conversation_row.event_id, conversation_row.group_id, conversation_row.id, p_inbound_event_id,
    group_row.phone_e164, p_outbound_action, p_outbound_guest_id
  );

  -- The 001 trigger has already inserted the history row in this transaction.
  -- Attach the conversation without creating a duplicate record.
  if guest_row.attendance_status is distinct from p_status then
    update public.attendance_history
    set source_reference = conversation_row.id
    where id = (
      select id
      from public.attendance_history
      where guest_id = guest_row.id
        and new_status = p_status
        and source = 'whatsapp'
        and source_reference is null
        and created_at >= transaction_timestamp()
      order by id desc
      limit 1
    );
  end if;
  return jsonb_build_object('guestId', guest_row.id, 'attendanceStatus', p_status);
end;
$$;

create or replace function public.advance_whatsapp_conversation(
  p_conversation_id uuid,
  p_expected_state text,
  p_expected_guest_id uuid,
  p_expected_invalid_attempts integer,
  p_next_state text,
  p_next_guest_id uuid,
  p_next_invalid_attempts integer,
  p_inbound_event_id uuid,
  p_outbound_action text,
  p_outbound_guest_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_row public.whatsapp_conversations%rowtype;
  group_row public.invitation_groups%rowtype;
  group_id_value uuid;
  phone_value text;
begin
  if (
       p_expected_state not in ('awaiting_attendance', 'awaiting_change_selection')
       and not (
         p_expected_state in ('completed', 'review')
         and p_next_state = 'awaiting_change_selection'
         and p_outbound_action = 'ask_change_selection'
       )
     )
     or p_next_state not in ('awaiting_attendance', 'awaiting_change_selection', 'completed', 'review')
     or p_expected_invalid_attempts not between 0 and 100
     or p_next_invalid_attempts not between 0 and 100
     or p_inbound_event_id is null
     or p_outbound_action not in (
       'ask_attendance', 'ask_change_selection', 'send_summary', 'invalid_prompt', 'review_notice'
     )
     or (p_outbound_action = 'ask_attendance') is distinct from (p_outbound_guest_id is not null) then
    raise exception using errcode = '22023', message = 'invalid_conversation_transition';
  end if;

  select conversation.group_id, invitation_group.phone_e164
  into group_id_value, phone_value
  from public.whatsapp_conversations conversation
  join public.invitation_groups invitation_group on invitation_group.id = conversation.group_id
  where conversation.id = p_conversation_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'conversation_not_active';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('whatsapp:phone:' || phone_value, 0));

  select * into group_row
  from public.invitation_groups invitation_group
  where invitation_group.id = group_id_value
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'conversation_group_not_found';
  end if;
  if exists (
    select 1 from public.phone_suppressions suppression
    where suppression.phone_e164 = group_row.phone_e164
  ) then
    raise exception using errcode = '55000', message = 'phone_suppressed';
  end if;

  select * into conversation_row
  from public.whatsapp_conversations conversation
  where conversation.id = p_conversation_id
  for update;
  if not found
     or conversation_row.state is distinct from p_expected_state
     or conversation_row.current_guest_id is distinct from p_expected_guest_id
     or conversation_row.invalid_attempts is distinct from p_expected_invalid_attempts then
    raise exception using errcode = '40001', message = 'conversation_state_changed';
  end if;

  if p_next_guest_id is not null and not exists (
    select 1
    from public.guests guest
    where guest.id = p_next_guest_id
      and guest.event_id = conversation_row.event_id
      and guest.group_id = conversation_row.group_id
  ) then
    raise exception using errcode = '42501', message = 'next_guest_not_in_conversation';
  end if;
  if p_outbound_guest_id is not null and not exists (
    select 1
    from public.guests guest
    where guest.id = p_outbound_guest_id
      and guest.event_id = conversation_row.event_id
      and guest.group_id = conversation_row.group_id
  ) then
    raise exception using errcode = '42501', message = 'outbound_guest_not_in_conversation';
  end if;

  update public.whatsapp_conversations set
    state = p_next_state,
    current_guest_id = p_next_guest_id,
    invalid_attempts = p_next_invalid_attempts,
    last_outbound_message_id = null,
    requires_review = p_next_state = 'review',
    completed_at = case when p_next_state = 'completed' then now() else null end,
    updated_at = now()
  where id = conversation_row.id;

  update public.whatsapp_inbound_events inbound_event set
    resolution = case when p_next_state = 'review' then 'review' else 'applied' end,
    conversation_id = conversation_row.id,
    processed_at = now(),
    locked_at = null,
    locked_by = null,
    processing_error_code = null
  where inbound_event.id = p_inbound_event_id
    and inbound_event.resolution = 'pending';
  if not found then
    raise exception using errcode = '40001', message = 'inbound_event_already_processed';
  end if;

  insert into public.whatsapp_outbound_jobs(
    event_id, group_id, conversation_id, source_inbound_event_id,
    recipient_phone_e164, action, guest_id
  )
  select
    conversation_row.event_id,
    conversation_row.group_id,
    conversation_row.id,
    p_inbound_event_id,
    group_row.phone_e164,
    p_outbound_action,
    p_outbound_guest_id
  ;

  return true;
end;
$$;

create or replace function public.mark_table_notices_stale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.table_id is not null or new.attendance_status <> 'attending') then
    update public.message_campaign_alerts
    set resolved_at = now()
    where guest_id = new.id
      and code = 'missing_table'
      and resolved_at is null;
  end if;

  if old.table_id is distinct from new.table_id or
     (
       old.attendance_status is distinct from new.attendance_status
       and (old.attendance_status = 'attending' or new.attendance_status = 'attending')
     ) then
    update public.message_deliveries delivery set
      is_stale = true,
      stale_at = now(),
      updated_at = now()
    from public.message_campaigns campaign
    where campaign.id = delivery.campaign_id
      and campaign.kind in ('table_notice', 'table_correction')
      and delivery.group_id = new.group_id
      -- Include an in-flight send: its rendered snapshot may already be stale.
      -- markSent preserves is_stale so a correction remains available.
      and delivery.status in ('sending', 'sent', 'delivered', 'read');
  end if;

  if new.table_id is not null or new.attendance_status <> 'attending' then
    update public.message_campaign_alerts set resolved_at = now()
    where guest_id = new.id and code = 'missing_table' and resolved_at is null;
  end if;
  return new;
end;
$$;

create or replace function public.record_delivery_uncertain_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'uncertain' and old.status is distinct from new.status then
    insert into public.message_campaign_alerts(
      campaign_id, event_id, group_id, guest_id, code
    ) values (
      new.campaign_id, new.event_id, new.group_id, null, 'delivery_uncertain'
    ) on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.mark_conversation_for_outbound_failure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status
     and new.status in ('uncertain', 'cancelled')
     and new.action <> 'opt_out_confirmation'
     and new.conversation_id is not null then
    update public.whatsapp_conversations conversation set
      state = case
        when conversation.state in ('awaiting_attendance', 'awaiting_change_selection') then 'review'
        else conversation.state
      end,
      requires_review = true,
      last_outbound_message_id = null,
      completed_at = case
        when conversation.state in ('awaiting_attendance', 'awaiting_change_selection') then null
        else conversation.completed_at
      end,
      updated_at = now()
    where conversation.id = new.conversation_id
      and conversation.state <> 'opted_out';
  end if;
  return new;
end;
$$;

create or replace function public.record_conversation_review_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_row public.message_deliveries%rowtype;
begin
  if old.requires_review is distinct from new.requires_review and new.delivery_id is not null then
    select * into delivery_row
    from public.message_deliveries
    where id = new.delivery_id;
    if found and new.requires_review then
      if new.current_guest_id is null then
        insert into public.message_campaign_alerts(
          campaign_id, event_id, group_id, guest_id, code
        ) values (
          delivery_row.campaign_id, new.event_id, new.group_id, null, 'requires_review'
        ) on conflict do nothing;
        update public.message_campaign_alerts
        set resolved_at = null
        where campaign_id = delivery_row.campaign_id
          and group_id = new.group_id
          and guest_id is null
          and code = 'requires_review';
      else
        insert into public.message_campaign_alerts(
          campaign_id, event_id, group_id, guest_id, code
        ) values (
          delivery_row.campaign_id,
          new.event_id,
          new.group_id,
          new.current_guest_id,
          'requires_review'
        ) on conflict (campaign_id, guest_id, code) do update set resolved_at = null;
      end if;
    elsif found then
      update public.message_campaign_alerts
      set resolved_at = now()
      where campaign_id = delivery_row.campaign_id
        and group_id = new.group_id
        and code = 'requires_review'
        and resolved_at is null;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.mark_table_label_notices_stale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.label is distinct from new.label or old.code is distinct from new.code then
    update public.message_deliveries delivery set
      is_stale = true,
      stale_at = now(),
      updated_at = now()
    from public.message_campaigns campaign
    where campaign.id = delivery.campaign_id
      and campaign.kind in ('table_notice', 'table_correction')
      and delivery.status in ('sending', 'sent', 'delivered', 'read')
      and exists (
        select 1 from public.guests guest
        where guest.group_id = delivery.group_id and guest.table_id = new.id
      );
  end if;
  return new;
end;
$$;

drop trigger if exists guests_mark_table_notices_stale on public.guests;
create trigger guests_mark_table_notices_stale
after update of table_id, attendance_status on public.guests
for each row execute function public.mark_table_notices_stale();

drop trigger if exists message_deliveries_record_uncertain_alert on public.message_deliveries;
create trigger message_deliveries_record_uncertain_alert
after update of status on public.message_deliveries
for each row execute function public.record_delivery_uncertain_alert();

drop trigger if exists whatsapp_outbound_jobs_mark_conversation_failure on public.whatsapp_outbound_jobs;
create trigger whatsapp_outbound_jobs_mark_conversation_failure
after update of status on public.whatsapp_outbound_jobs
for each row execute function public.mark_conversation_for_outbound_failure();

drop trigger if exists whatsapp_conversations_record_review_alert on public.whatsapp_conversations;
create trigger whatsapp_conversations_record_review_alert
after update of requires_review on public.whatsapp_conversations
for each row execute function public.record_conversation_review_alert();

drop trigger if exists seating_tables_mark_notices_stale on public.seating_tables;
create trigger seating_tables_mark_notices_stale
after update of label, code on public.seating_tables
for each row execute function public.mark_table_label_notices_stale();

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
revoke all on function public.submit_legacy_rsvp_idempotent(uuid, text, text, jsonb) from public;
revoke all on function public.crm_create_invitation_group(uuid, text, text, text, timestamptz, text, text, text, text, jsonb, jsonb) from public;
revoke all on function public.crm_import_invitation_groups(uuid, jsonb) from public;
revoke all on function public.crm_create_invitation_group_idempotent(uuid, text, text, text, timestamptz, text, text, text, text, jsonb, jsonb, text, text) from public;
revoke all on function public.crm_import_invitation_groups_idempotent(uuid, jsonb, text, text) from public;
revoke all on function public.submit_token_rsvp(text, text, jsonb) from public;
revoke all on function public.create_message_campaign(uuid, text, uuid[], text, text, text, timestamptz, text, uuid) from public;
revoke all on function public.acquire_whatsapp_worker_lease(text, integer) from public;
revoke all on function public.release_whatsapp_worker_lease(text) from public;
revoke all on function public.suppress_whatsapp_phone(text, text, uuid, uuid) from public;
revoke all on function public.claim_whatsapp_inbound_events(text, integer) from public;
revoke all on function public.retry_whatsapp_inbound_event(uuid, text, text, timestamptz, uuid) from public;
revoke all on function public.apply_whatsapp_provider_status(text) from public;
revoke all on function public.record_whatsapp_provider_status(text, text, timestamptz) from public;
revoke all on function public.claim_whatsapp_outbound_jobs(text, integer) from public;
revoke all on function public.mark_message_delivery_sent(uuid, text, jsonb) from public;
revoke all on function public.mark_whatsapp_outbound_sent(uuid, text) from public;
revoke all on function public.claim_message_deliveries(text, integer) from public;
revoke all on function public.enqueue_due_message_automations(timestamptz) from public;
revoke all on function public.advance_whatsapp_attendance(uuid, uuid, text, text, uuid, integer, uuid, text, uuid) from public;
revoke all on function public.advance_whatsapp_conversation(uuid, text, uuid, integer, text, uuid, integer, uuid, text, uuid) from public;

grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.submit_legacy_rsvp_idempotent(uuid, text, text, jsonb) to service_role;
grant execute on function public.crm_create_invitation_group_idempotent(uuid, text, text, text, timestamptz, text, text, text, text, jsonb, jsonb, text, text) to service_role;
grant execute on function public.crm_import_invitation_groups_idempotent(uuid, jsonb, text, text) to service_role;
grant execute on function public.submit_token_rsvp(text, text, jsonb) to service_role;
grant execute on function public.create_message_campaign(uuid, text, uuid[], text, text, text, timestamptz, text, uuid) to service_role;
grant execute on function public.acquire_whatsapp_worker_lease(text, integer) to service_role;
grant execute on function public.release_whatsapp_worker_lease(text) to service_role;
grant execute on function public.suppress_whatsapp_phone(text, text, uuid, uuid) to service_role;
grant execute on function public.claim_whatsapp_inbound_events(text, integer) to service_role;
grant execute on function public.retry_whatsapp_inbound_event(uuid, text, text, timestamptz, uuid) to service_role;
grant execute on function public.record_whatsapp_provider_status(text, text, timestamptz) to service_role;
grant execute on function public.claim_whatsapp_outbound_jobs(text, integer) to service_role;
grant execute on function public.mark_message_delivery_sent(uuid, text, jsonb) to service_role;
grant execute on function public.mark_whatsapp_outbound_sent(uuid, text) to service_role;
grant execute on function public.claim_message_deliveries(text, integer) to service_role;
grant execute on function public.enqueue_due_message_automations(timestamptz) to service_role;
grant execute on function public.advance_whatsapp_attendance(uuid, uuid, text, text, uuid, integer, uuid, text, uuid) to service_role;
grant execute on function public.advance_whatsapp_conversation(uuid, text, uuid, integer, text, uuid, integer, uuid, text, uuid) to service_role;

commit;
