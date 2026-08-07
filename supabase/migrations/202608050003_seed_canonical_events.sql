-- Canonical event identities shared by invitation URLs, CRM and messaging.
--
-- IDs remain database-owned UUIDs. The human-readable keys below are resolved
-- by slug, so application config must never pass them as events.id values.

with curated_relations(table_name) as (
  values
    ('boda_sofi_gonchi_rsvps'),
    ('boda_mica_tincho_rsvps'),
    ('boda_vir_jere'),
    ('boda_andres_lucre'),
    ('boda_calas'),
    ('boda_domi_diego'),
    ('boda_mica_santi')
), validated_relations as (
  select
    curated.table_name,
    public.inspect_legacy_rsvp_relation(curated.table_name) as diagnostics
  from curated_relations curated
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

with canonical_events (
  slug,
  display_name,
  event_at,
  timezone,
  rsvp_opens_at,
  rsvp_deadline,
  legacy_table_name,
  metadata
) as (
  values
    (
      'sofi-gonchi',
      'Sofi & Gonchi',
      timestamptz '2025-12-20 19:30:00-03',
      'America/Montevideo',
      null::timestamptz,
      timestamptz '2025-12-20 19:30:00-03',
      'boda_sofi_gonchi_rsvps',
      '{"invitation_slugs":["sofi-gonchi"]}'::jsonb
    ),
    (
      'mica-tincho',
      'Mica & Tincho',
      timestamptz '2026-01-31 17:00:00-03',
      'America/Montevideo',
      null::timestamptz,
      timestamptz '2026-01-31 17:00:00-03',
      'boda_mica_tincho_rsvps',
      '{"invitation_slugs":["mica-tincho"]}'::jsonb
    ),
    (
      'vir-jere',
      'Vir & Jere',
      timestamptz '2026-03-14 17:00:00-03',
      'America/Montevideo',
      null::timestamptz,
      timestamptz '2026-03-14 17:00:00-03',
      'boda_vir_jere',
      '{"invitation_slugs":["vir-jere"]}'::jsonb
    ),
    (
      'andres-lucre',
      'Andrés & Lucre',
      timestamptz '2026-03-21 20:00:00-03',
      'America/Montevideo',
      null::timestamptz,
      timestamptz '2026-03-14 00:00:00-03',
      'boda_andres_lucre',
      '{"invitation_slugs":["andres-lucre"]}'::jsonb
    ),
    (
      'calas',
      'Juli & Mati',
      timestamptz '2026-03-28 20:00:00-03',
      'America/Montevideo',
      null::timestamptz,
      timestamptz '2026-03-15 00:00:00-03',
      'boda_calas',
      '{"invitation_slugs":["calas","juli-mati"]}'::jsonb
    ),
    (
      'domi-diego',
      'Domi & Diego',
      timestamptz '2026-05-30 20:00:00-03',
      'America/Montevideo',
      null::timestamptz,
      timestamptz '2026-05-15 00:00:00-03',
      'boda_domi_diego',
      '{"invitation_slugs":["domi-diego","domi-diego-hotel"]}'::jsonb
    ),
    (
      'mica-santi',
      'Mica & Santi',
      timestamptz '2026-10-17 17:30:00-03',
      'America/Montevideo',
      null::timestamptz,
      timestamptz '2026-10-01 00:00:00-03',
      'boda_mica_santi',
      '{"invitation_slugs":["mica-santi"]}'::jsonb
    )
)
update public.events event
set
  slug = seed.slug,
  display_name = seed.display_name,
  event_at = seed.event_at,
  timezone = seed.timezone,
  rsvp_status = case
    when seed.rsvp_opens_at is not null and now() < seed.rsvp_opens_at
      then 'scheduled'
    when now() >= coalesce(seed.rsvp_deadline, seed.event_at)
      then 'closed'
    else 'open'
  end,
  rsvp_opens_at = seed.rsvp_opens_at,
  rsvp_deadline = seed.rsvp_deadline,
  metadata = event.metadata || seed.metadata,
  updated_at = now()
from canonical_events seed
where event.legacy_table_name = seed.legacy_table_name;

with canonical_events (
  slug,
  display_name,
  event_at,
  timezone,
  rsvp_opens_at,
  rsvp_deadline,
  legacy_table_name,
  metadata
) as (
  values
    ('sofi-gonchi', 'Sofi & Gonchi', timestamptz '2025-12-20 19:30:00-03', 'America/Montevideo', null::timestamptz, timestamptz '2025-12-20 19:30:00-03', 'boda_sofi_gonchi_rsvps', '{"invitation_slugs":["sofi-gonchi"]}'::jsonb),
    ('mica-tincho', 'Mica & Tincho', timestamptz '2026-01-31 17:00:00-03', 'America/Montevideo', null::timestamptz, timestamptz '2026-01-31 17:00:00-03', 'boda_mica_tincho_rsvps', '{"invitation_slugs":["mica-tincho"]}'::jsonb),
    ('vir-jere', 'Vir & Jere', timestamptz '2026-03-14 17:00:00-03', 'America/Montevideo', null::timestamptz, timestamptz '2026-03-14 17:00:00-03', 'boda_vir_jere', '{"invitation_slugs":["vir-jere"]}'::jsonb),
    ('andres-lucre', 'Andrés & Lucre', timestamptz '2026-03-21 20:00:00-03', 'America/Montevideo', null::timestamptz, timestamptz '2026-03-14 00:00:00-03', 'boda_andres_lucre', '{"invitation_slugs":["andres-lucre"]}'::jsonb),
    ('calas', 'Juli & Mati', timestamptz '2026-03-28 20:00:00-03', 'America/Montevideo', null::timestamptz, timestamptz '2026-03-15 00:00:00-03', 'boda_calas', '{"invitation_slugs":["calas","juli-mati"]}'::jsonb),
    ('domi-diego', 'Domi & Diego', timestamptz '2026-05-30 20:00:00-03', 'America/Montevideo', null::timestamptz, timestamptz '2026-05-15 00:00:00-03', 'boda_domi_diego', '{"invitation_slugs":["domi-diego","domi-diego-hotel"]}'::jsonb),
    ('mica-santi', 'Mica & Santi', timestamptz '2026-10-17 17:30:00-03', 'America/Montevideo', null::timestamptz, timestamptz '2026-10-01 00:00:00-03', 'boda_mica_santi', '{"invitation_slugs":["mica-santi"]}'::jsonb)
)
insert into public.events (
  slug,
  display_name,
  event_at,
  timezone,
  rsvp_status,
  rsvp_opens_at,
  rsvp_deadline,
  legacy_table_name,
  metadata
)
select
  seed.slug,
  seed.display_name,
  seed.event_at,
  seed.timezone,
  case
    when seed.rsvp_opens_at is not null and now() < seed.rsvp_opens_at
      then 'scheduled'
    when now() >= coalesce(seed.rsvp_deadline, seed.event_at)
      then 'closed'
    else 'open'
  end,
  seed.rsvp_opens_at,
  seed.rsvp_deadline,
  case
    when (
      public.authorize_legacy_rsvp_relation(seed.legacy_table_name) ->> 'valid'
    )::boolean then seed.legacy_table_name
    else null
  end,
  seed.metadata || case
    when (
      public.authorize_legacy_rsvp_relation(seed.legacy_table_name) ->> 'valid'
    )::boolean then '{}'::jsonb
    else jsonb_build_object(
      'legacy_mapping_review',
      jsonb_build_object(
        'candidate', seed.legacy_table_name,
        'reason', public.authorize_legacy_rsvp_relation(seed.legacy_table_name) ->> 'reason'
      )
    )
  end
from canonical_events seed
where not exists (
  select 1
  from public.events existing
  where existing.legacy_table_name = seed.legacy_table_name
)
on conflict (slug) do update
set
  display_name = excluded.display_name,
  event_at = excluded.event_at,
  timezone = excluded.timezone,
  rsvp_status = excluded.rsvp_status,
  rsvp_opens_at = excluded.rsvp_opens_at,
  rsvp_deadline = excluded.rsvp_deadline,
  legacy_table_name = excluded.legacy_table_name,
  metadata = public.events.metadata || excluded.metadata,
  updated_at = now();
