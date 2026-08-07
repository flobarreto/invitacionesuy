-- Preserve the plural floor-plan prototype before the v2 schema claims the
-- same relation name. This must run before 001: CREATE TABLE IF NOT EXISTS is
-- not a shape migration and would otherwise leave the legacy columns in place.
--
-- Nothing is dropped. An unrecognised relation intentionally stops the
-- migration so an operator can inspect it instead of risking an overwrite.

do $$
declare
  relation_kind "char";
  is_canonical boolean;
  is_legacy_admin boolean;
begin
  if to_regclass('public.floor_plans') is null then
    return;
  end if;

  select class.relkind
  into relation_kind
  from pg_class class
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = 'floor_plans';

  select count(*) = 8
  into is_canonical
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'floor_plans'
    and (
      (column_name in ('id', 'event_id') and udt_name = 'uuid')
      or (column_name in ('logical_width', 'logical_height') and udt_name = 'int4')
      or (column_name = 'background_path' and udt_name = 'text')
      or (column_name = 'revision' and udt_name = 'int8')
      or (column_name in ('created_at', 'updated_at') and udt_name = 'timestamptz')
    );

  select count(*) = 4
  into is_legacy_admin
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'floor_plans'
    and (
      (column_name in ('admin_username', 'image_url') and udt_name = 'text')
      or (column_name = 'opacity' and udt_name in ('float4', 'float8', 'numeric'))
      or (column_name = 'floor_tables' and udt_name = 'jsonb')
    );

  if is_canonical and not is_legacy_admin then
    if relation_kind not in ('r', 'p') then
      raise exception
        'public.floor_plans is canonical-shaped but is not a table'
        using errcode = '55000';
    end if;
    return;
  end if;

  if not is_legacy_admin or is_canonical then
    raise exception
      'public.floor_plans has an unsupported or mixed shape; no relation was renamed'
      using errcode = '55000',
            hint = 'Back up the database and inspect information_schema.columns before applying platform v2.';
  end if;

  if relation_kind not in ('r', 'p') then
    raise exception
      'public.floor_plans is legacy-shaped but is not a table; no relation was renamed'
      using errcode = '55000';
  end if;

  if to_regclass('public.floor_plans_legacy_admin') is not null then
    raise exception
      'Both public.floor_plans and public.floor_plans_legacy_admin exist; refusing to choose or overwrite either source'
      using errcode = '55000';
  end if;

  alter table public.floor_plans rename to floor_plans_legacy_admin;
  comment on table public.floor_plans_legacy_admin is
    'Read-only archive of the legacy admin_username/image_url/opacity/floor_tables floor-plan prototype. Retained for reconciliation and rollback.';
end;
$$;
