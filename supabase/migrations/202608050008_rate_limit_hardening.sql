begin;

alter table public.api_rate_limits
  add column if not exists expires_at timestamptz;

-- Older rows did not record their individual window length. Preserve them
-- conservatively for the longest window currently in use; every subsequent
-- consume refreshes this value with the exact configured window.
update public.api_rate_limits
set expires_at = window_started_at + interval '15 minutes'
where expires_at is null;

alter table public.api_rate_limits
  alter column expires_at set default now(),
  alter column expires_at set not null;

create index if not exists api_rate_limits_expires_idx
  on public.api_rate_limits(expires_at);

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
  if p_namespace is null or char_length(p_namespace) not between 1 and 120 or
     p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' or
     p_limit is null or p_limit < 1 or
     p_window_seconds is null or p_window_seconds < 1 then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_arguments';
  end if;

  -- Bound cleanup work per request. SKIP LOCKED prevents concurrent callers
  -- from waiting on the same expired batch while guaranteeing steady cleanup.
  with expired_rows as (
    select rate_limit.ctid
    from public.api_rate_limits rate_limit
    where rate_limit.expires_at <= now_value
    order by rate_limit.expires_at, rate_limit.namespace, rate_limit.key_hash
    limit 100
    for update skip locked
  )
  delete from public.api_rate_limits rate_limit
  using expired_rows
  where rate_limit.ctid = expired_rows.ctid;

  insert into public.api_rate_limits(
    namespace,
    key_hash,
    window_started_at,
    request_count,
    expires_at
  )
  values (
    p_namespace,
    p_key_hash,
    now_value,
    1,
    now_value + make_interval(secs => p_window_seconds)
  )
  on conflict (namespace, key_hash) do update set
    window_started_at = case
      when public.api_rate_limits.window_started_at <=
           now_value - make_interval(secs => p_window_seconds)
        then now_value
      else public.api_rate_limits.window_started_at
    end,
    request_count = case
      when public.api_rate_limits.window_started_at <=
           now_value - make_interval(secs => p_window_seconds)
        then 1
      else public.api_rate_limits.request_count + 1
    end,
    expires_at = case
      when public.api_rate_limits.window_started_at <=
           now_value - make_interval(secs => p_window_seconds)
        then now_value + make_interval(secs => p_window_seconds)
      else public.api_rate_limits.window_started_at +
           make_interval(secs => p_window_seconds)
    end
  returning * into rate_row;

  return jsonb_build_object(
    'allowed', rate_row.request_count <= p_limit,
    'retry_after_seconds', greatest(
      0,
      ceil(extract(epoch from (rate_row.expires_at - now_value)))::integer
    )
  );
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;

commit;
