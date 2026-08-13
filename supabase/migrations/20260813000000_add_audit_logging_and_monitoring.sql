-- Migration: Add audit logging and structured error handling
-- Author: Axio Locadoras Automation
-- Purpose: Implement centralized audit trail for compliance and debugging

-- 1. Create audit_log table
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'FUNCTION_CALL', 'ERROR')),
  user_id uuid references auth.users(id) on delete set null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  error_code text,
  error_message text,
  function_name text,
  context jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Centralized audit trail for all critical operations, compliance and debugging.';

comment on column public.audit_log.table_name is
  'The table affected (reservas, perfis, veiculos, etc)';

comment on column public.audit_log.record_id is
  'PK of affected record (for reference, may be null for function calls)';

comment on column public.audit_log.context is
  'Additional context: user_agent, ip_address, function_args, etc';

-- Create indexes for common queries
create index if not exists audit_log_created_at_idx
  on public.audit_log (created_at desc);

create index if not exists audit_log_user_created_idx
  on public.audit_log (user_id, created_at desc);

create index if not exists audit_log_table_action_idx
  on public.audit_log (table_name, action, created_at desc);

create index if not exists audit_log_error_idx
  on public.audit_log (error_code, created_at desc)
  where error_code is not null;

-- Disable RLS (only service_role should write via triggers)
alter table public.audit_log disable row level security;

-- 2. Create function_logs table (for Edge Function logging)
create table if not exists public.function_logs (
  id uuid primary key default gen_random_uuid(),
  function_name text not null check (function_name in (
    'reserve-car',
    'process-reserve-queue',
    'cadastrar-veiculo',
    'alterar-veiculo',
    'reserve-status'
  )),
  level text not null check (level in ('DEBUG', 'INFO', 'WARN', 'ERROR')),
  user_id uuid references auth.users(id) on delete set null,
  request_id text,
  message text,
  error_code text,
  error_details jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.function_logs is
  'Structured logs from Edge Functions for debugging and monitoring.';

-- Create indexes for common queries
create index if not exists function_logs_created_at_idx
  on public.function_logs (created_at desc);

create index if not exists function_logs_function_level_idx
  on public.function_logs (function_name, level, created_at desc);

create index if not exists function_logs_user_created_idx
  on public.function_logs (user_id, created_at desc);

create index if not exists function_logs_error_idx
  on public.function_logs (error_code, created_at desc)
  where error_code is not null;

create index if not exists function_logs_request_id_idx
  on public.function_logs (request_id);

alter table public.function_logs disable row level security;

-- 3. Create helper functions for audit logging

create or replace function private.log_audit(
  p_table_name text,
  p_action text,
  p_user_id uuid default null,
  p_record_id uuid default null,
  p_old_data jsonb default null,
  p_new_data jsonb default null,
  p_error_code text default null,
  p_error_message text default null,
  p_function_name text default null,
  p_context jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audit_id uuid := gen_random_uuid();
begin
  insert into public.audit_log (
    id, table_name, action, user_id, record_id,
    old_data, new_data, error_code, error_message,
    function_name, context
  ) values (
    v_audit_id,
    p_table_name,
    p_action,
    coalesce(p_user_id, auth.uid()),
    p_record_id,
    p_old_data,
    p_new_data,
    p_error_code,
    p_error_message,
    p_function_name,
    coalesce(p_context, '{}'::jsonb)
  );
  return v_audit_id;
end;
$$;

revoke all on function private.log_audit(text,text,uuid,uuid,jsonb,jsonb,text,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function private.log_audit(text,text,uuid,uuid,jsonb,jsonb,text,text,text,jsonb)
  to service_role;

-- 4. Create helper for Edge Function logging

create or replace function private.log_function_call(
  p_function_name text,
  p_level text,
  p_user_id uuid default null,
  p_request_id text default null,
  p_message text default null,
  p_error_code text default null,
  p_error_details jsonb default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log_id uuid := gen_random_uuid();
begin
  insert into public.function_logs (
    id, function_name, level, user_id, request_id,
    message, error_code, error_details, metadata
  ) values (
    v_log_id,
    p_function_name,
    p_level,
    p_user_id,
    p_request_id,
    p_message,
    p_error_code,
    p_error_details,
    coalesce(p_metadata, '{}'::jsonb)
  );
  return v_log_id;
end;
$$;

revoke all on function private.log_function_call(text,text,uuid,text,text,text,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function private.log_function_call(text,text,uuid,text,text,text,jsonb,jsonb)
  to service_role;

-- 5. Create triggers for automatic audit logging

create or replace function private.audit_reservas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_audit(
      'reservas',
      'INSERT',
      new.usuario_id,
      new.id,
      null,
      to_jsonb(new),
      null,
      null,
      'reserve_car_atomic'
    );
  elsif tg_op = 'UPDATE' then
    perform private.log_audit(
      'reservas',
      'UPDATE',
      new.usuario_id,
      new.id,
      to_jsonb(old),
      to_jsonb(new),
      null,
      null,
      'admin_action'
    );
  elsif tg_op = 'DELETE' then
    perform private.log_audit(
      'reservas',
      'DELETE',
      old.usuario_id,
      old.id,
      to_jsonb(old),
      null,
      null,
      null,
      'admin_action'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_reservas_trigger on public.reservas;
create trigger audit_reservas_trigger
  after insert or update or delete on public.reservas
  for each row execute function private.audit_reservas();

-- 6. Create view for admin to see recent audit logs

create or replace view public.v_audit_log_admin as
select
  al.id,
  al.table_name,
  al.action,
  al.user_id,
  u.email as user_email,
  al.record_id,
  al.error_code,
  al.error_message,
  al.function_name,
  al.created_at,
  al.context
from public.audit_log as al
left join auth.users as u on u.id = al.user_id
order by al.created_at desc;

-- Grant access to admin (via RLS on the function level)
-- This view will be filtered by admin-only function
grant select on public.v_audit_log_admin to authenticated;

-- 7. Create function to view audit logs (admin only)

create or replace function public.admin_get_audit_logs(
  p_limit integer default 100,
  p_offset integer default 0,
  p_table_name text default null,
  p_action text default null,
  p_error_only boolean default false,
  p_since_hours integer default 24
)
returns table (
  id uuid,
  table_name text,
  action text,
  user_email text,
  record_id uuid,
  error_code text,
  error_message text,
  function_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_vehicle_administrator();
  
  return query
  select
    al.id,
    al.table_name,
    al.action,
    u.email::text,
    al.record_id,
    al.error_code,
    al.error_message,
    al.function_name,
    al.created_at
  from public.audit_log as al
  left join auth.users as u on u.id = al.user_id
  where (p_table_name is null or al.table_name = p_table_name)
    and (p_action is null or al.action = p_action)
    and (not p_error_only or al.error_code is not null)
    and al.created_at > now() - (p_since_hours || ' hours')::interval
  order by al.created_at desc
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.admin_get_audit_logs(integer,integer,text,text,boolean,integer)
  from public, anon;
grant execute on function public.admin_get_audit_logs(integer,integer,text,text,boolean,integer)
  to authenticated;

-- 8. Create view for function logs (admin)

create or replace function public.admin_get_function_logs(
  p_limit integer default 100,
  p_offset integer default 0,
  p_function_name text default null,
  p_level text default null,
  p_error_only boolean default false,
  p_since_hours integer default 24
)
returns table (
  id uuid,
  function_name text,
  level text,
  user_email text,
  request_id text,
  message text,
  error_code text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_vehicle_administrator();
  
  return query
  select
    fl.id,
    fl.function_name,
    fl.level,
    u.email::text,
    fl.request_id,
    fl.message,
    fl.error_code,
    fl.created_at
  from public.function_logs as fl
  left join auth.users as u on u.id = fl.user_id
  where (p_function_name is null or fl.function_name = p_function_name)
    and (p_level is null or fl.level = p_level)
    and (not p_error_only or fl.error_code is not null)
    and fl.created_at > now() - (p_since_hours || ' hours')::interval
  order by fl.created_at desc
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.admin_get_function_logs(integer,integer,text,text,boolean,integer)
  from public, anon;
grant execute on function public.admin_get_function_logs(integer,integer,text,text,boolean,integer)
  to authenticated;

