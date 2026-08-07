-- Transactional verification for canonical, event-owned floor-plan Storage
-- keys. Run after all migrations; no Storage service is involved.

begin;

do $$
declare
  event_id_value constant uuid := '73000000-0000-4000-8000-000000000001';
  other_event_id constant uuid := '73000000-0000-4000-8000-000000000002';
  asset_id_value constant uuid := '83000000-0000-4000-8000-000000000001';
  valid_path constant text :=
    '73000000-0000-4000-8000-000000000001/83000000-0000-4000-8000-000000000001.png';
  traversal_path constant text :=
    '73000000-0000-4000-8000-000000000001/../73000000-0000-4000-8000-000000000002/83000000-0000-4000-8000-000000000001.png';
  saved_revision bigint;
begin
  insert into public.events(id, slug, display_name)
  values
    (event_id_value, 'fixture-floor-plan-path', 'Fixture floor plan path'),
    (other_event_id, 'fixture-floor-plan-path-other', 'Fixture other floor plan path');

  if not public.is_canonical_floor_plan_background_path(event_id_value, valid_path) then
    raise exception 'canonical event-owned background path was rejected';
  end if;

  if public.is_canonical_floor_plan_background_path(event_id_value, traversal_path)
     or public.is_canonical_floor_plan_background_path(
       event_id_value,
       event_id_value::text || '/%2e%2e%2f' || other_event_id::text ||
         '%2f' || asset_id_value::text || '.png'
     )
     or public.is_canonical_floor_plan_background_path(
       event_id_value,
       other_event_id::text || '/' || asset_id_value::text || '.png'
     )
     or public.is_canonical_floor_plan_background_path(
       event_id_value,
       valid_path || chr(10)
     ) then
    raise exception 'cross-event, encoded traversal or control character was accepted';
  end if;

  begin
    insert into public.floor_plans(event_id, background_path)
    values (event_id_value, traversal_path);
    raise exception 'table constraint accepted a traversable background path';
  exception
    when check_violation then
      null;
  end;

  begin
    perform public.save_seating_layout(
      event_id_value,
      0,
      jsonb_build_object(
        'logical_width', 1200,
        'logical_height', 700,
        'background_path', traversal_path
      ),
      '[]'::jsonb
    );
    raise exception 'layout RPC accepted a traversable background path';
  exception
    when sqlstate '22023' then
      if sqlerrm <> 'invalid_floor_plan_background_path' then
        raise;
      end if;
  end;

  saved_revision := public.save_seating_layout(
    event_id_value,
    0,
    jsonb_build_object(
      'logical_width', 1200,
      'logical_height', 700,
      'background_path', valid_path
    ),
    '[]'::jsonb
  );

  if saved_revision <> 1 or not exists (
    select 1
    from public.floor_plans floor_plan
    where floor_plan.event_id = event_id_value
      and floor_plan.background_path = valid_path
      and floor_plan.revision = 1
  ) then
    raise exception 'canonical background path was not saved';
  end if;
end;
$$;

rollback;
