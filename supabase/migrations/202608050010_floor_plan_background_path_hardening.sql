-- Reject ambiguous or traversable Storage keys even when writes bypass the API.
-- Existing non-canonical rows remain visible for manual remediation, but the
-- NOT VALID constraint blocks every new invalid insert/update immediately.
begin;

create or replace function public.is_canonical_floor_plan_background_path(
  p_event_id uuid,
  p_background_path text
)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select
    p_background_path !~ '[[:cntrl:]]'
    and p_background_path ~ (
      '^' || p_event_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp)$'
    );
$$;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = 'public.floor_plans'::regclass
      and constraint_record.conname = 'floor_plans_background_path_canonical'
  ) then
    alter table public.floor_plans
      add constraint floor_plans_background_path_canonical check (
        background_path is null
        or public.is_canonical_floor_plan_background_path(event_id, background_path)
      ) not valid;
  end if;

  if not exists (
    select 1
    from public.floor_plans floor_plan
    where floor_plan.background_path is not null
      and not public.is_canonical_floor_plan_background_path(
        floor_plan.event_id,
        floor_plan.background_path
      )
  ) then
    alter table public.floor_plans
      validate constraint floor_plans_background_path_canonical;
  end if;
end;
$$;

comment on function public.is_canonical_floor_plan_background_path(uuid, text) is
  'Accepts only <event UUID>/<random UUID v4>.(jpg|png|webp) private floor-plan Storage keys.';

commit;
