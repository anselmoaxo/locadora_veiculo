-- Harden Phase 1 observability and provide an atomic API-boundary rate limiter.

-- Logs live in an exposed schema for compatibility with existing admin RPCs.
-- RLS plus explicit revokes prevents direct Data API access.
alter table public.audit_log enable row level security;
alter table public.function_logs enable row level security;

revoke all on table public.audit_log from public, anon, authenticated;
revoke all on table public.function_logs from public, anon, authenticated;
grant select, insert on table public.audit_log to service_role;
grant select, insert on table public.function_logs to service_role;

-- The original view joined auth.users and was granted to every authenticated
-- user. Admins already have guarded RPCs, so the direct view is unnecessary.
revoke all on table public.v_audit_log_admin from public, anon, authenticated;
drop view if exists public.v_audit_log_admin;

create table if not exists private.rate_limit_counters (
  scope text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, window_started_at),
  constraint rate_limit_scope_format check (scope ~ '^[a-z0-9][a-z0-9:_-]{0,79}$'),
  constraint rate_limit_key_hash_format check (key_hash ~ '^[0-9a-f]{64}$')
);

alter table private.rate_limit_counters enable row level security;
revoke all on table private.rate_limit_counters from public, anon, authenticated;
grant select, insert, update, delete on table private.rate_limit_counters to service_role;

create index if not exists rate_limit_counters_updated_at_idx
  on private.rate_limit_counters (updated_at);

create or replace function private.consume_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_count integer;
  v_allowed boolean;
begin
  if p_scope is null or p_scope !~ '^[a-z0-9][a-z0-9:_-]{0,79}$' then
    raise exception using errcode = '22023', message = 'INVALID_RATE_LIMIT_SCOPE';
  end if;
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_RATE_LIMIT_KEY';
  end if;
  if p_limit < 1 or p_limit > 10000 then
    raise exception using errcode = '22023', message = 'INVALID_RATE_LIMIT';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception using errcode = '22023', message = 'INVALID_RATE_LIMIT_WINDOW';
  end if;

  v_window_started_at := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into private.rate_limit_counters as counters (
    scope, key_hash, window_started_at, request_count, updated_at
  ) values (
    p_scope, p_key_hash, v_window_started_at, 1, v_now
  )
  on conflict (scope, key_hash, window_started_at) do update
    set request_count = counters.request_count + 1,
        updated_at = excluded.updated_at
    where counters.request_count < p_limit
  returning request_count into v_count;

  v_allowed := v_count is not null;
  if v_count is null then
    select counters.request_count
      into v_count
      from private.rate_limit_counters as counters
     where counters.scope = p_scope
       and counters.key_hash = p_key_hash
       and counters.window_started_at = v_window_started_at;
  end if;

  return query select
    v_allowed,
    greatest(p_limit - v_count, 0),
    case
      when v_allowed then 0
      else greatest(ceil(extract(epoch from (
        v_window_started_at + make_interval(secs => p_window_seconds) - v_now
      )))::integer, 1)
    end;
end;
$$;

revoke all on function private.consume_rate_limit(text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function private.consume_rate_limit(text,text,integer,integer)
  to service_role;

-- PostgREST only exposes configured API schemas. This invoker-rights wrapper
-- keeps the state and business logic private while providing a service-only RPC.
create or replace function public.consume_edge_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select *
  from private.consume_rate_limit(p_scope, p_key_hash, p_limit, p_window_seconds);
$$;

revoke all on function public.consume_edge_rate_limit(text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text,text,integer,integer)
  to service_role;

create or replace function private.purge_rate_limit_counters(
  p_older_than interval default interval '2 days'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted bigint;
begin
  if p_older_than < interval '1 hour' then
    raise exception using errcode = '22023', message = 'INVALID_RETENTION_PERIOD';
  end if;

  delete from private.rate_limit_counters
   where updated_at < clock_timestamp() - p_older_than;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function private.purge_rate_limit_counters(interval)
  from public, anon, authenticated;
grant execute on function private.purge_rate_limit_counters(interval)
  to service_role;
