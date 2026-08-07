-- Backfill the v2 core from the per-event legacy tables.
--
-- Identity is shared with the live dual-write trigger installed by 006. Rows
-- with a stable legacy `id` keep it. Rows without one receive a deterministic
-- fingerprint + occurrence identity; their latest fingerprint is persisted so
-- an UPDATE can follow the same canonical guest. If multiple anonymous rows are
-- indistinguishable, a later UPDATE is rejected instead of guessing.
--
-- Canonical fields use compare-and-set semantics. `metadata.legacy_synced`
-- stores the last value written from legacy; a later delta only overwrites a
-- field when its canonical value still equals that snapshot. Manual CRM/seating
-- changes therefore survive every repeat and delta pass.

-- Older deployments sometimes inferred the RSVP relation from `username`.
-- Keep that compatibility only when the inferred relation is independently
-- attested. Missing or dangerous candidates are queued for manual review.
with fallback_candidates as (
  select
    administrator.id as admin_id,
    administrator.username as candidate_table_name,
    public.inspect_legacy_rsvp_relation(administrator.username) as diagnostics
  from public.admin administrator
  where nullif(btrim(administrator.table_name), '') is null
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
  'admin.username_fallback',
  candidate.diagnostics ->> 'reason',
  candidate.diagnostics
from fallback_candidates candidate
where not (candidate.diagnostics ->> 'valid')::boolean
on conflict do nothing;

update public.admin administrator
set table_name = administrator.username
where nullif(btrim(administrator.table_name), '') is null
  and (
    public.inspect_legacy_rsvp_relation(administrator.username) ->> 'valid'
  )::boolean;

with configured_candidates as (
  select
    administrator.id as admin_id,
    administrator.table_name as candidate_table_name,
    public.inspect_legacy_rsvp_relation(administrator.table_name) as diagnostics
  from public.admin administrator
  where nullif(btrim(administrator.table_name), '') is not null
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

insert into public.events (
  slug,
  display_name,
  legacy_table_name,
  metadata
)
select
  'legacy-' || substr(md5(a.table_name), 1, 16),
  coalesce(max(nullif(btrim(a.event_name), '')), a.table_name),
  a.table_name,
  jsonb_build_object('migration_source', 'admin.table_name')
from public.admin a
where nullif(btrim(a.table_name), '') is not null
  and (
    public.authorize_legacy_rsvp_relation(a.table_name) ->> 'valid'
  )::boolean
group by a.table_name
on conflict (legacy_table_name) do update
set display_name = coalesce(
  nullif(btrim(public.events.display_name), ''),
  excluded.display_name
);

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

insert into public.event_admins (event_id, admin_id, role, active)
select e.id, a.id, 'couple_admin', true
from public.admin a
join public.events e on e.legacy_table_name = a.table_name
where (
  public.authorize_legacy_rsvp_relation(a.table_name) ->> 'valid'
)::boolean
on conflict (event_id, admin_id) do update
set active = true;

-- Curated seed rows and databases that already ran an older backfill can still
-- carry an unsafe pointer. Preserve the event itself, record the candidate and
-- remove only the dynamic relation capability.
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

-- If an older run already bound a couple administrator to a real but invalid
-- relation, remove that access while retaining the event and migrated evidence
-- for platform-level review. A merely missing table contains nothing to expose.
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

-- Legacy tag names were not tenant-unique and can differ only by case. Build a
-- non-destructive alias map first, then tenant-scope one canonical tag per name;
-- duplicate legacy tag rows stay available to old code and resolve through the
-- alias during guest backfill.
create table if not exists public.legacy_tag_aliases (
  event_id uuid not null references public.events(id) on delete cascade,
  legacy_tag_id uuid not null references public.tags(id) on delete cascade,
  canonical_tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, legacy_tag_id)
);

insert into public.legacy_tag_aliases(event_id, legacy_tag_id, canonical_tag_id)
select event_id, legacy_tag_id, canonical_tag_id
from (
  select
    event.id as event_id,
    tag.id as legacy_tag_id,
    first_value(tag.id) over (
      partition by event.id, lower(btrim(tag.name))
      order by (tag.event_id is null), tag.created_at nulls last, tag.id
    ) as canonical_tag_id
  from public.tags tag
  join public.events event
    on tag.event_id = event.id
    or (tag.event_id is null and tag.table_name = event.legacy_table_name)
) aliases
on conflict (event_id, legacy_tag_id) do update
set canonical_tag_id = excluded.canonical_tag_id;

update public.tags tag
set event_id = alias.event_id
from public.legacy_tag_aliases alias
where tag.id = alias.canonical_tag_id
  and alias.legacy_tag_id = alias.canonical_tag_id
  and tag.event_id is null;

alter table public.legacy_tag_aliases enable row level security;

alter table public.invitation_groups
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.legacy_migration_audit (
  id bigint generated by default as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  source_table text not null,
  source_count bigint not null default 0,
  migrated_guest_count bigint not null default 0,
  source_checksum text,
  target_checksum text,
  status text not null check (status in ('completed', 'source_missing', 'failed')),
  ambiguities jsonb not null default '[]'::jsonb,
  migrated_at timestamptz not null default now()
);

alter table public.legacy_migration_audit
  add column if not exists target_checksum text;

create index if not exists legacy_migration_audit_event_idx
  on public.legacy_migration_audit (event_id, migrated_at desc);

alter table public.legacy_migration_audit enable row level security;

create table if not exists public.legacy_row_identities (
  event_id uuid not null references public.events(id) on delete cascade,
  source_table text not null,
  legacy_id text not null,
  stable_source_id text,
  current_fingerprint text not null,
  anonymous_ordinal integer,
  last_legacy_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, source_table, legacy_id),
  constraint legacy_row_identities_fingerprint_format
    check (current_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint legacy_row_identities_ordinal_check
    check (anonymous_ordinal is null or anonymous_ordinal > 0)
);

create unique index if not exists legacy_row_identities_stable_source_unique_idx
  on public.legacy_row_identities(event_id, source_table, stable_source_id)
  where stable_source_id is not null;
create index if not exists legacy_row_identities_fingerprint_idx
  on public.legacy_row_identities(event_id, source_table, current_fingerprint);

alter table public.legacy_row_identities enable row level security;

create or replace function public.legacy_jsonb_text_array(value jsonb)
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  decoded jsonb;
  scalar text;
begin
  if value is null or value = 'null'::jsonb then
    return '{}'::text[];
  end if;

  if jsonb_typeof(value) = 'array' then
    return array(
      select nullif(btrim(item), '')
      from jsonb_array_elements_text(value) as entries(item)
      where nullif(btrim(item), '') is not null
    );
  end if;

  scalar := value #>> '{}';
  if nullif(btrim(scalar), '') is null then
    return '{}'::text[];
  end if;

  begin
    decoded := scalar::jsonb;
    if jsonb_typeof(decoded) = 'array' then
      return array(
        select nullif(btrim(item), '')
        from jsonb_array_elements_text(decoded) as entries(item)
        where nullif(btrim(item), '') is not null
      );
    end if;
  exception when others then
    null;
  end;

  return array[scalar];
end;
$$;

create or replace function public.legacy_attendance_status(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when lower(btrim(coalesce(value, ''))) in (
      'sí', 'si', 'yes', 'y', '1', 'confirmado', 'confirmada',
      'asisto', 'asistiré', 'asistire', 'attending'
    ) then 'attending'
    when lower(btrim(coalesce(value, ''))) in (
      'no', 'n', '0', 'no asisto', 'no asistiré', 'no asistire',
      'rechazado', 'rechazada', 'declined'
    ) then 'declined'
    else 'pending'
  end;
$$;

create or replace function public.legacy_payload_fingerprint(value jsonb)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select encode(extensions.digest(value::text, 'sha256'), 'hex');
$$;

create or replace function public.legacy_field_matches_snapshot(
  metadata_value jsonb,
  field_name text,
  current_value jsonb
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(coalesce(metadata_value, '{}'::jsonb) -> 'legacy_synced') = 'object'
    and (coalesce(metadata_value, '{}'::jsonb) -> 'legacy_synced') ? field_name
    and coalesce(
      coalesce(metadata_value, '{}'::jsonb) #> array['legacy_synced', field_name],
      'null'::jsonb
    ) = coalesce(current_value, 'null'::jsonb);
$$;

create or replace function public.resolve_legacy_row_identity(
  p_event_id uuid,
  p_source_table text,
  p_payload jsonb,
  p_previous_payload jsonb default null,
  p_occurrence integer default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  stable_id text := nullif(btrim(p_payload ->> 'id'), '');
  previous_stable_id text := nullif(btrim(p_previous_payload ->> 'id'), '');
  fingerprint text := public.legacy_payload_fingerprint(p_payload);
  previous_fingerprint text;
  identity_ids text[];
  resolved_legacy_id text;
  resolved_ordinal integer;
begin
  if p_event_id is null or nullif(btrim(p_source_table), '') is null or
     p_payload is null or jsonb_typeof(p_payload) <> 'object' or
     (p_occurrence is not null and p_occurrence < 1) then
    raise exception using errcode = '22023', message = 'invalid_legacy_identity_payload';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_event_id::text || ':legacy-identity:' || p_source_table || ':' ||
    coalesce(previous_stable_id, stable_id, public.legacy_payload_fingerprint(coalesce(p_previous_payload, p_payload))),
    0
  ));

  if stable_id is not null or previous_stable_id is not null then
    if previous_stable_id is not null then
      select array_agg(identity.legacy_id order by identity.updated_at desc)
        into identity_ids
      from public.legacy_row_identities identity
      where identity.event_id = p_event_id
        and identity.source_table = p_source_table
        and identity.stable_source_id = previous_stable_id;

      if coalesce(cardinality(identity_ids), 0) = 0 and exists (
        select 1 from public.guests guest
        where guest.event_id = p_event_id
          and guest.legacy_table = p_source_table
          and guest.legacy_id = previous_stable_id
      ) then
        resolved_legacy_id := previous_stable_id;
      else
        resolved_legacy_id := identity_ids[1];
      end if;
    else
      -- A legacy row can acquire an `id` after it was first migrated. Follow
      -- its OLD anonymous fingerprint before considering the new stable id, or
      -- the UPDATE would create a second canonical guest.
      if p_previous_payload is not null then
        previous_fingerprint := public.legacy_payload_fingerprint(p_previous_payload);
        select array_agg(identity.legacy_id order by identity.legacy_id)
          into identity_ids
        from public.legacy_row_identities identity
        where identity.event_id = p_event_id
          and identity.source_table = p_source_table
          and identity.current_fingerprint = previous_fingerprint;

        if coalesce(cardinality(identity_ids), 0) = 0 then
          select array_agg(distinct guest.legacy_id order by guest.legacy_id)
            into identity_ids
          from public.guests guest
          where guest.event_id = p_event_id
            and guest.legacy_table = p_source_table
            and guest.legacy_id is not null
            and public.legacy_payload_fingerprint(guest.metadata -> 'legacy_record') = previous_fingerprint;
        end if;

        if coalesce(cardinality(identity_ids), 0) > 1 then
          raise exception using
            errcode = 'P0001',
            message = 'ambiguous_anonymous_legacy_update',
            detail = format('source_table=%s fingerprint=%s matches=%s',
              p_source_table, previous_fingerprint, cardinality(identity_ids));
        end if;
        resolved_legacy_id := identity_ids[1];
      end if;

      if resolved_legacy_id is null then
        select array_agg(identity.legacy_id order by identity.updated_at desc)
          into identity_ids
        from public.legacy_row_identities identity
        where identity.event_id = p_event_id
          and identity.source_table = p_source_table
          and identity.stable_source_id = stable_id;
        resolved_legacy_id := identity_ids[1];
      end if;
    end if;

    resolved_legacy_id := coalesce(resolved_legacy_id, previous_stable_id, stable_id);
    if stable_id is not null and exists (
      select 1
      from public.legacy_row_identities identity
      where identity.event_id = p_event_id
        and identity.source_table = p_source_table
        and identity.stable_source_id = stable_id
        and identity.legacy_id <> resolved_legacy_id
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'stable_legacy_identity_collision',
        detail = format('source_table=%s source_id=%s previous_source_id=%s',
          p_source_table, stable_id, previous_stable_id);
    end if;
  elsif p_previous_payload is not null then
    previous_fingerprint := public.legacy_payload_fingerprint(p_previous_payload);
    select array_agg(identity.legacy_id order by identity.legacy_id)
      into identity_ids
    from public.legacy_row_identities identity
    where identity.event_id = p_event_id
      and identity.source_table = p_source_table
      and identity.current_fingerprint = previous_fingerprint;

    if coalesce(cardinality(identity_ids), 0) = 0 then
      select array_agg(distinct guest.legacy_id order by guest.legacy_id)
        into identity_ids
      from public.guests guest
      where guest.event_id = p_event_id
        and guest.legacy_table = p_source_table
        and guest.legacy_id is not null
        and public.legacy_payload_fingerprint(guest.metadata -> 'legacy_record') = previous_fingerprint;
    end if;

    if coalesce(cardinality(identity_ids), 0) <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'ambiguous_anonymous_legacy_update',
        detail = format('source_table=%s fingerprint=%s matches=%s',
          p_source_table, previous_fingerprint, coalesce(cardinality(identity_ids), 0));
    end if;
    resolved_legacy_id := identity_ids[1];
  else
    select array_agg(identity.legacy_id order by identity.legacy_id)
      into identity_ids
    from public.legacy_row_identities identity
    where identity.event_id = p_event_id
      and identity.source_table = p_source_table
      and identity.current_fingerprint = fingerprint;

    if coalesce(cardinality(identity_ids), 0) = 0 then
      select array_agg(distinct guest.legacy_id order by guest.legacy_id)
        into identity_ids
      from public.guests guest
      where guest.event_id = p_event_id
        and guest.legacy_table = p_source_table
        and guest.legacy_id is not null
        and public.legacy_payload_fingerprint(guest.metadata -> 'legacy_record') = fingerprint;
    end if;

    if p_occurrence is not null and coalesce(cardinality(identity_ids), 0) >= p_occurrence then
      resolved_legacy_id := identity_ids[p_occurrence];
    else
      resolved_ordinal := coalesce(p_occurrence, coalesce(cardinality(identity_ids), 0) + 1);
      resolved_legacy_id := 'anon:' || fingerprint || ':' || resolved_ordinal::text;
    end if;
  end if;

  resolved_ordinal := case
    when stable_id is null and previous_stable_id is null then
      coalesce(
        p_occurrence,
        nullif(split_part(resolved_legacy_id, ':', 3), '')::integer
      )
    else null
  end;

  if p_previous_payload is not null and stable_id is null and exists (
    select 1
    from public.legacy_row_identities identity
    where identity.event_id = p_event_id
      and identity.source_table = p_source_table
      and identity.current_fingerprint = fingerprint
      and identity.legacy_id <> resolved_legacy_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'anonymous_legacy_identity_collision',
      detail = format('source_table=%s fingerprint=%s', p_source_table, fingerprint);
  end if;

  insert into public.legacy_row_identities (
    event_id,
    source_table,
    legacy_id,
    stable_source_id,
    current_fingerprint,
    anonymous_ordinal,
    last_legacy_payload
  ) values (
    p_event_id,
    p_source_table,
    resolved_legacy_id,
    stable_id,
    fingerprint,
    resolved_ordinal,
    p_payload
  )
  on conflict (event_id, source_table, legacy_id) do update set
    stable_source_id = coalesce(excluded.stable_source_id, public.legacy_row_identities.stable_source_id),
    current_fingerprint = excluded.current_fingerprint,
    anonymous_ordinal = coalesce(public.legacy_row_identities.anonymous_ordinal, excluded.anonymous_ordinal),
    last_legacy_payload = excluded.last_legacy_payload,
    updated_at = now();

  return resolved_legacy_id;
end;
$$;

create or replace function public.sync_legacy_payload_to_core(
  p_event_id uuid,
  p_source_table text,
  p_source_payload jsonb,
  p_previous_payload jsonb default null,
  p_occurrence integer default null,
  p_attendance_source text default 'legacy_migration'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.events%rowtype;
  source_id text;
  source_name text;
  source_phone text;
  source_table_code text;
  target_group public.invitation_groups%rowtype;
  target_group_id uuid;
  target_guest public.guests%rowtype;
  target_guest_found boolean := false;
  target_guest_id uuid;
  target_table_id uuid;
  dietary_preferences_value text[];
  favorite_song_value text;
  drink_preferences_value text[];
  attendance_status_value text;
  group_snapshot jsonb;
  guest_snapshot jsonb;
  ambiguities jsonb := '[]'::jsonb;
  tag_value text;
  source_tag public.tags%rowtype;
  target_tag_id uuid;
  previous_sync_setting text := current_setting('app.legacy_to_core', true);
begin
  select * into event_row
  from public.events
  where id = p_event_id and legacy_table_name = p_source_table;
  if not found then
    raise exception using errcode = '42501', message = 'legacy_source_does_not_match_event';
  end if;
  if p_attendance_source not in ('legacy', 'legacy_migration') then
    raise exception using errcode = '22023', message = 'invalid_legacy_attendance_source';
  end if;

  perform set_config('app.legacy_to_core', 'on', true);
  perform pg_advisory_xact_lock(hashtextextended(p_event_id::text || ':legacy-sync', 0));

  source_id := public.resolve_legacy_row_identity(
    p_event_id,
    p_source_table,
    p_source_payload,
    p_previous_payload,
    p_occurrence
  );
  source_name := coalesce(
    nullif(btrim(p_source_payload ->> 'name'), ''),
    nullif(btrim(p_source_payload ->> 'full_name'), ''),
    'Invitado sin nombre'
  );
  if source_name = 'Invitado sin nombre' then
    ambiguities := ambiguities || jsonb_build_array(jsonb_build_object(
      'legacy_id', source_id,
      'reason', 'missing_name'
    ));
  end if;

  source_phone := coalesce(
    nullif(btrim(p_source_payload ->> 'phone_e164'), ''),
    nullif(btrim(p_source_payload ->> 'phone'), ''),
    nullif(btrim(p_source_payload ->> 'telefono'), '')
  );
  if source_phone is not null and source_phone !~ '^\+[1-9][0-9]{7,14}$' then
    ambiguities := ambiguities || jsonb_build_array(jsonb_build_object(
      'legacy_id', source_id,
      'reason', 'invalid_phone'
    ));
    source_phone := null;
  end if;
  if source_phone is not null and exists (
    select 1
    from public.invitation_groups existing_group
    where existing_group.event_id = p_event_id
      and existing_group.phone_e164 = source_phone
      and (
        existing_group.legacy_table is distinct from p_source_table
        or existing_group.legacy_id is distinct from source_id
      )
  ) then
    ambiguities := ambiguities || jsonb_build_array(jsonb_build_object(
      'legacy_id', source_id,
      'reason', 'duplicate_phone'
    ));
    source_phone := null;
  end if;

  attendance_status_value := public.legacy_attendance_status(p_source_payload ->> 'attendance');
  dietary_preferences_value := public.legacy_jsonb_text_array(p_source_payload -> 'dietary_preferences');
  favorite_song_value := nullif(btrim(p_source_payload ->> 'favorite_song'), '');
  drink_preferences_value := public.legacy_jsonb_text_array(
    coalesce(p_source_payload -> 'drink', p_source_payload -> 'drink_preferences')
  );

  group_snapshot := jsonb_build_object(
    'display_name', source_name,
    'phone_e164', source_phone
  );
  select * into target_group
  from public.invitation_groups
  where event_id = p_event_id
    and legacy_table = p_source_table
    and legacy_id = source_id
  for update;

  if not found then
    insert into public.invitation_groups (
      event_id,
      display_name,
      phone_e164,
      group_key,
      legacy_table,
      legacy_id,
      metadata
    ) values (
      p_event_id,
      source_name,
      source_phone,
      'legacy:' || source_id,
      p_source_table,
      source_id,
      jsonb_build_object('legacy_record', p_source_payload, 'legacy_synced', group_snapshot)
    )
    returning id into target_group_id;
  else
    target_group_id := target_group.id;
    if jsonb_typeof(target_group.metadata -> 'legacy_synced') is distinct from 'object' then
      ambiguities := ambiguities || jsonb_build_array(jsonb_build_object(
        'legacy_id', source_id,
        'reason', 'missing_group_legacy_synced_baseline'
      ));
    end if;
    update public.invitation_groups existing_group set
      display_name = case
        when public.legacy_field_matches_snapshot(
          existing_group.metadata, 'display_name', to_jsonb(existing_group.display_name)
        ) then source_name else existing_group.display_name
      end,
      phone_e164 = case
        when public.legacy_field_matches_snapshot(
          existing_group.metadata, 'phone_e164', to_jsonb(existing_group.phone_e164)
        ) then source_phone else existing_group.phone_e164
      end,
      metadata = existing_group.metadata || jsonb_build_object(
        'legacy_record', p_source_payload,
        'legacy_synced', group_snapshot
      ),
      updated_at = now()
    where existing_group.id = target_group_id and existing_group.event_id = p_event_id;
  end if;

  -- Keep lock ordering compatible with canonical RSVP/seating writes:
  -- invitation_group -> guest -> seating_table. The previous table snapshot
  -- also preserves a canonical table rename while legacy still has the old code.
  select * into target_guest
  from public.guests
  where event_id = p_event_id
    and legacy_table = p_source_table
    and legacy_id = source_id
  for update;
  target_guest_found := found;
  if target_guest_found and jsonb_typeof(target_guest.metadata -> 'legacy_synced') is distinct from 'object' then
    ambiguities := ambiguities || jsonb_build_array(jsonb_build_object(
      'legacy_id', source_id,
      'reason', 'missing_guest_legacy_synced_baseline'
    ));
  end if;

  source_table_code := nullif(upper(btrim(p_source_payload ->> 'table_number')), '');
  target_table_id := null;
  if target_guest_found and
     (target_guest.metadata #>> '{legacy_synced,table_code}') is not distinct from source_table_code then
    select id into target_table_id
    from public.seating_tables
    where event_id = p_event_id
      and id::text = target_guest.metadata #>> '{legacy_synced,table_id}';
  end if;

  if target_table_id is null and source_table_code is not null then
    select id into target_table_id
    from public.seating_tables
    where event_id = p_event_id and lower(code) = lower(source_table_code);

    if target_table_id is null then
      insert into public.seating_tables (event_id, code, label, x, y)
      values (p_event_id, source_table_code, 'Mesa ' || source_table_code, 80, 80)
      on conflict (event_id, (lower(code))) do nothing
      returning id into target_table_id;

      if target_table_id is null then
        select id into target_table_id
        from public.seating_tables
        where event_id = p_event_id and lower(code) = lower(source_table_code);
      end if;
    end if;
  end if;

  guest_snapshot := jsonb_build_object(
    'group_id', target_group_id,
    'name', source_name,
    'email', nullif(btrim(p_source_payload ->> 'email'), ''),
    'attendance_status', attendance_status_value,
    'table_id', target_table_id,
    'table_code', source_table_code,
    'dietary_preferences', dietary_preferences_value,
    'favorite_song', favorite_song_value,
    'drink_preferences', drink_preferences_value
  );
  insert into public.guests (
    event_id,
    group_id,
    name,
    email,
    attendance_status,
    attendance_source,
    table_id,
    dietary_preferences,
    favorite_song,
    drink_preferences,
    legacy_table,
    legacy_id,
    metadata
  ) values (
    p_event_id,
    target_group_id,
    source_name,
    nullif(btrim(p_source_payload ->> 'email'), ''),
    attendance_status_value,
    p_attendance_source,
    target_table_id,
    dietary_preferences_value,
    favorite_song_value,
    drink_preferences_value,
    p_source_table,
    source_id,
    jsonb_build_object('legacy_record', p_source_payload, 'legacy_synced', guest_snapshot)
  )
  on conflict (event_id, legacy_table, legacy_id)
    where legacy_table is not null and legacy_id is not null
  do update set
    group_id = case
      when public.legacy_field_matches_snapshot(
        public.guests.metadata, 'group_id', to_jsonb(public.guests.group_id)
      ) then excluded.group_id else public.guests.group_id
    end,
    name = case
      when public.legacy_field_matches_snapshot(
        public.guests.metadata, 'name', to_jsonb(public.guests.name)
      ) then excluded.name else public.guests.name
    end,
    email = case
      when public.legacy_field_matches_snapshot(
        public.guests.metadata, 'email', to_jsonb(public.guests.email)
      ) then excluded.email else public.guests.email
    end,
    attendance_status = case
      when public.legacy_field_matches_snapshot(
        public.guests.metadata, 'attendance_status', to_jsonb(public.guests.attendance_status)
      ) then excluded.attendance_status else public.guests.attendance_status
    end,
    attendance_source = case
      when public.legacy_field_matches_snapshot(
        public.guests.metadata, 'attendance_status', to_jsonb(public.guests.attendance_status)
      ) then excluded.attendance_source else public.guests.attendance_source
    end,
    table_id = case
      when public.legacy_field_matches_snapshot(
        public.guests.metadata, 'table_id', to_jsonb(public.guests.table_id)
      ) then excluded.table_id else public.guests.table_id
    end,
    dietary_preferences = case
      when public.legacy_field_matches_snapshot(
        public.guests.metadata, 'dietary_preferences', to_jsonb(public.guests.dietary_preferences)
      ) then excluded.dietary_preferences else public.guests.dietary_preferences
    end,
    favorite_song = case
      when public.legacy_field_matches_snapshot(
        public.guests.metadata, 'favorite_song', to_jsonb(public.guests.favorite_song)
      ) then excluded.favorite_song else public.guests.favorite_song
    end,
    drink_preferences = case
      when public.legacy_field_matches_snapshot(
        public.guests.metadata, 'drink_preferences', to_jsonb(public.guests.drink_preferences)
      ) then excluded.drink_preferences else public.guests.drink_preferences
    end,
    metadata = public.guests.metadata || excluded.metadata,
    updated_at = now()
  returning id into target_guest_id;

  foreach tag_value in array public.legacy_jsonb_text_array(p_source_payload -> 'tags')
  loop
    target_tag_id := null;
    select alias.canonical_tag_id into target_tag_id
    from public.legacy_tag_aliases alias
    join public.tags legacy_tag on legacy_tag.id = alias.legacy_tag_id
    where alias.event_id = p_event_id
      and coalesce(legacy_tag.legacy_id, legacy_tag.id::text) = tag_value;

    if target_tag_id is null then
      select * into source_tag
      from public.tags tag
      where coalesce(tag.legacy_id, tag.id::text) = tag_value
        and (tag.event_id = p_event_id or tag.table_name = p_source_table)
      limit 1;

      if found then
        if source_tag.event_id = p_event_id then
          target_tag_id := source_tag.id;
        else
          select tag.id into target_tag_id
          from public.tags tag
          where tag.event_id = p_event_id
            and lower(btrim(tag.name)) = lower(btrim(source_tag.name))
          limit 1;

          if target_tag_id is null then
            update public.tags tag set event_id = p_event_id
            where tag.id = source_tag.id and tag.event_id is null
            returning tag.id into target_tag_id;
          end if;
        end if;

        if target_tag_id is not null then
          insert into public.legacy_tag_aliases(event_id, legacy_tag_id, canonical_tag_id)
          values (p_event_id, source_tag.id, target_tag_id)
          on conflict (event_id, legacy_tag_id) do update
          set canonical_tag_id = excluded.canonical_tag_id;
        end if;
      end if;
    end if;

    if target_tag_id is not null then
      insert into public.guest_tags (event_id, guest_id, tag_id)
      values (p_event_id, target_guest_id, target_tag_id)
      on conflict (guest_id, tag_id) do nothing;
    else
      ambiguities := ambiguities || jsonb_build_array(jsonb_build_object(
        'legacy_id', source_id,
        'reason', 'unknown_tag',
        'tag_id', tag_value
      ));
    end if;
  end loop;

  perform set_config('app.legacy_to_core', coalesce(previous_sync_setting, ''), true);
  return jsonb_build_object(
    'legacy_id', source_id,
    'group_id', target_group_id,
    'guest_id', target_guest_id,
    'ambiguities', ambiguities
  );
exception when others then
  perform set_config('app.legacy_to_core', coalesce(previous_sync_setting, ''), true);
  raise;
end;
$$;

create or replace function public.migrate_legacy_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source_table text;
  source_relation regclass;
  relation_inspection jsonb;
  source_record record;
  sync_result jsonb;
  source_count bigint := 0;
  migrated_count bigint := 0;
  source_checksum text;
  target_checksum text;
  ambiguities jsonb := '[]'::jsonb;
  migration_status text;
begin
  select legacy_table_name into source_table
  from public.events
  where id = p_event_id;

  if source_table is null then
    raise exception 'El evento no tiene tabla legacy' using errcode = '22023';
  end if;

  relation_inspection := public.authorize_legacy_rsvp_relation(source_table);
  if not (relation_inspection ->> 'valid')::boolean then
    insert into public.legacy_rsvp_mapping_reviews (
      event_id,
      candidate_table_name,
      source,
      reason,
      diagnostics
    ) values (
      p_event_id,
      source_table,
      'events.legacy_table_name',
      relation_inspection ->> 'reason',
      relation_inspection
    ) on conflict do nothing;

    insert into public.legacy_migration_audit (
      event_id, source_table, status, ambiguities
    ) values (
      p_event_id,
      source_table,
      case
        when relation_inspection ->> 'reason' = 'relation_missing'
          then 'source_missing'
        else 'failed'
      end,
      jsonb_build_array(jsonb_build_object(
        'reason', 'unsafe_legacy_relation',
        'inspection', relation_inspection
      ))
    );
    return jsonb_build_object(
      'event_id', p_event_id,
      'source_table', source_table,
      'status', case
        when relation_inspection ->> 'reason' = 'relation_missing'
          then 'source_missing'
        else 'failed'
      end,
      'inspection', relation_inspection
    );
  end if;

  source_relation := to_regclass(format('%I.%I', 'public', source_table));

  execute format(
    'select count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '''' order by md5(to_jsonb(t)::text)), '''')) from %s t',
    source_relation
  ) into source_count, source_checksum;

  for source_record in execute format($query$
    with source_rows as (
      select
        to_jsonb(t) as payload,
        public.legacy_payload_fingerprint(to_jsonb(t)) as fingerprint
      from %s t
    )
    select
      payload,
      row_number() over (
        partition by fingerprint
        order by payload::text
      )::integer as occurrence
    from source_rows
    order by
      case when nullif(btrim(payload ->> 'id'), '') is null then 1 else 0 end,
      coalesce(nullif(btrim(payload ->> 'id'), ''), fingerprint),
      payload::text
  $query$, source_relation)
  loop
    sync_result := public.sync_legacy_payload_to_core(
      p_event_id,
      source_table,
      source_record.payload,
      null,
      source_record.occurrence,
      'legacy_migration'
    );
    ambiguities := ambiguities || coalesce(sync_result -> 'ambiguities', '[]'::jsonb);
  end loop;

  select
    count(*),
    md5(coalesce(string_agg(
      md5((guest.metadata -> 'legacy_record')::text),
      '' order by md5((guest.metadata -> 'legacy_record')::text)
    ), ''))
  into migrated_count, target_checksum
  from public.guests guest
  where guest.event_id = p_event_id
    and guest.legacy_table = source_table;

  migration_status := case
    when source_count = migrated_count and source_checksum = target_checksum then 'completed'
    else 'failed'
  end;
  if migration_status = 'failed' then
    ambiguities := ambiguities || jsonb_build_array(jsonb_build_object(
      'reason', 'source_target_mismatch',
      'source_count', source_count,
      'target_count', migrated_count,
      'source_checksum', source_checksum,
      'target_checksum', target_checksum
    ));
  end if;

  insert into public.legacy_migration_audit (
    event_id,
    source_table,
    source_count,
    migrated_guest_count,
    source_checksum,
    target_checksum,
    status,
    ambiguities
  ) values (
    p_event_id,
    source_table,
    source_count,
    migrated_count,
    source_checksum,
    target_checksum,
    migration_status,
    ambiguities
  );

  return jsonb_build_object(
    'event_id', p_event_id,
    'source_table', source_table,
    'status', migration_status,
    'source_count', source_count,
    'migrated_guest_count', migrated_count,
    'source_checksum', source_checksum,
    'target_checksum', target_checksum,
    'ambiguities', ambiguities
  );
exception when others then
  insert into public.legacy_migration_audit (
    event_id,
    source_table,
    source_count,
    migrated_guest_count,
    source_checksum,
    target_checksum,
    status,
    ambiguities
  ) values (
    p_event_id,
    coalesce(source_table, '<unknown>'),
    source_count,
    migrated_count,
    source_checksum,
    target_checksum,
    'failed',
    jsonb_build_array(jsonb_build_object('reason', sqlstate, 'message', sqlerrm))
  );
  return jsonb_build_object(
    'event_id', p_event_id,
    'source_table', coalesce(source_table, '<unknown>'),
    'status', 'failed',
    'reason', sqlstate,
    'message', sqlerrm
  );
end;
$$;

revoke all on function public.resolve_legacy_row_identity(uuid, text, jsonb, jsonb, integer)
  from public, anon, authenticated;
revoke all on function public.sync_legacy_payload_to_core(uuid, text, jsonb, jsonb, integer, text)
  from public, anon, authenticated;
revoke all on function public.migrate_legacy_event(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_legacy_row_identity(uuid, text, jsonb, jsonb, integer)
  to service_role;
grant execute on function public.sync_legacy_payload_to_core(uuid, text, jsonb, jsonb, integer, text)
  to service_role;
grant execute on function public.migrate_legacy_event(uuid) to service_role;

do $$
declare
  event_record record;
begin
  for event_record in
    select id from public.events where legacy_table_name is not null
  loop
    perform public.migrate_legacy_event(event_record.id);
  end loop;
end;
$$;

comment on table public.legacy_migration_audit is
  'Per-event source/target counts, checksums and ambiguities for repeatable legacy migrations.';
comment on table public.legacy_row_identities is
  'Stable mapping from legacy rows (including anonymous fingerprinted rows) to canonical legacy_id values.';
