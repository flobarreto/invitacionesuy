-- Representative legacy schema loaded before migration 000. It exercises the
-- additive admin/tags upgrade, core RSVP backfill, dual-write trigger, seating
-- table conversion and the plural floor_plans rename without touching a real
-- Supabase project.

create table public.admin (
  id uuid primary key,
  username text not null unique,
  password text not null,
  table_name text,
  event_name text
);

create table public.tags (
  id uuid primary key,
  table_name text,
  name text not null,
  color text not null
);

create table public.fixture_legacy_rsvps (
  id uuid primary key,
  name text not null,
  email text,
  phone text,
  attendance text,
  dietary_preferences text[],
  favorite_song text,
  drink text[],
  table_number text,
  tags uuid[],
  created_at timestamptz not null default now()
);

create table public.floor_plan (
  table_name text primary key,
  layout jsonb not null,
  updated_at timestamptz not null default now()
);

-- This name intentionally collides with the v2 canonical table. Migration 000
-- must recognise and archive this exact legacy shape before migration 001.
create table public.floor_plans (
  admin_username text primary key,
  image_url text,
  opacity double precision,
  floor_tables jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.admin (id, username, password, table_name, event_name)
values (
  '71000000-0000-4000-8000-000000000001',
  'fixture-legacy-admin',
  'not-a-real-login-hash',
  'fixture_legacy_rsvps',
  'Fixture legacy core'
);

-- A compromised legacy mapping must never turn the credential table into an
-- RSVP source during the v2 backfill.
insert into public.admin (id, username, password, table_name, event_name)
values (
  '71000000-0000-4000-8000-000000000004',
  'fixture-unsafe-admin',
  'credential-that-must-not-be-migrated',
  'admin',
  'Unsafe confused deputy fixture'
);

insert into public.tags (id, table_name, name, color)
values (
  '71000000-0000-4000-8000-000000000002',
  'fixture_legacy_rsvps',
  'Familia',
  '#94A3B8'
);

insert into public.fixture_legacy_rsvps (
  id,
  name,
  email,
  phone,
  attendance,
  dietary_preferences,
  favorite_song,
  drink,
  table_number,
  tags
) values (
  '71000000-0000-4000-8000-000000000003',
  'Invitada Fixture',
  'fixture@example.invalid',
  '+59899123456',
  'Sí',
  array['Vegetariana'],
  'Canción Fixture',
  array['Agua'],
  '9',
  array['71000000-0000-4000-8000-000000000002'::uuid]
);

insert into public.floor_plan (table_name, layout)
values (
  'fixture_legacy_rsvps',
  jsonb_build_object(
    'width', 1200,
    'height', 800,
    'tables', jsonb_build_array(
      jsonb_build_object(
        'tableNumber', '9',
        'name', 'Mesa 9',
        'x', 360,
        'y', 240,
        'maxPeople', 10,
        'shape', 'circle',
        'size', 96
      )
    )
  )
);

insert into public.floor_plans (admin_username, image_url, opacity, floor_tables)
values (
  'fixture-legacy-admin',
  null,
  1,
  jsonb_build_array(
    jsonb_build_object(
      'tableNumber', '9',
      'name', 'Mesa 9',
      'x', 30,
      'y', 30,
      'maxPeople', 10,
      'shape', 'circle',
      'size', 96
    )
  )
);
