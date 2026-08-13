create extension if not exists pg_cron;

create table if not exists public.reservation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  car_id uuid not null references public.veiculos(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  pickup_location_id uuid references public.locais(id),
  dropoff_location_id uuid references public.locais(id),
  notes text,
  idempotency_key text not null,
  payload_hash text not null,
  status text not null default 'pending',
  attempts smallint not null default 0,
  max_attempts smallint not null default 3,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  reservation_id uuid references public.reservas(id),
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_jobs_period_valid check (start_at < end_at),
  constraint reservation_jobs_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint reservation_jobs_idempotency_length check (char_length(idempotency_key) between 1 and 200),
  constraint reservation_jobs_payload_hash_valid check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint reservation_jobs_status_valid check (status in ('pending', 'processing', 'succeeded', 'failed')),
  constraint reservation_jobs_attempts_valid check (attempts between 0 and max_attempts),
  constraint reservation_jobs_max_attempts_valid check (max_attempts between 1 and 10),
  unique (user_id, idempotency_key)
);

create index if not exists reservation_jobs_pending_idx
  on public.reservation_jobs (available_at, created_at)
  where status = 'pending';

create index if not exists reservation_jobs_user_created_idx
  on public.reservation_jobs (user_id, created_at desc);

alter table public.reservation_jobs enable row level security;

drop policy if exists reservation_jobs_select_own on public.reservation_jobs;
create policy reservation_jobs_select_own
  on public.reservation_jobs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.reservation_jobs from public, anon, authenticated;
grant select on public.reservation_jobs to authenticated;

create or replace function private.enqueue_reservation_job(
  p_car_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_pickup_location_id uuid,
  p_dropoff_location_id uuid,
  p_notes text,
  p_idempotency_key text,
  p_payload_hash text
)
returns table (job_id uuid, status text, reservation_id uuid, error_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.perfis%rowtype;
  v_existing public.reservation_jobs%rowtype;
  v_job_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  if p_car_id is null or p_start_at is null or p_end_at is null then
    raise exception using errcode = '22004', message = 'MISSING_REQUIRED_FIELDS';
  end if;
  if p_start_at >= p_end_at then
    raise exception using errcode = '22007', message = 'INVALID_RESERVATION_PERIOD';
  end if;
  if p_start_at < clock_timestamp() - interval '5 minutes' then
    raise exception using errcode = '22007', message = 'START_AT_IN_THE_PAST';
  end if;
  if p_end_at - p_start_at < interval '1 hour' then
    raise exception using errcode = '22007', message = 'MINIMUM_DURATION_IS_ONE_HOUR';
  end if;
  if p_end_at - p_start_at > interval '90 days' then
    raise exception using errcode = '22007', message = 'MAXIMUM_DURATION_IS_90_DAYS';
  end if;
  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception using errcode = '22023', message = 'NOTES_TOO_LONG';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
     or p_payload_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_IDEMPOTENCY_DATA';
  end if;

  select profile.* into v_profile
  from public.perfis as profile
  where profile.id = v_user_id;

  if not found or v_profile.cpf is null or v_profile.telefone is null
     or v_profile.cnh_numero is null or v_profile.cnh_categoria is null
     or v_profile.cnh_validade is null or v_profile.cnh_uf is null then
    raise exception using errcode = '23514', message = 'PROFILE_INCOMPLETE';
  end if;
  if v_profile.cnh_validade < current_date then
    raise exception using errcode = '23514', message = 'DRIVER_LICENSE_EXPIRED';
  end if;
  if v_profile.cadastro_status = 'reprovado' then
    raise exception using errcode = '23514', message = 'PROFILE_REJECTED';
  end if;
  if v_profile.cadastro_status <> 'aprovado' then
    raise exception using errcode = '23514', message = 'PROFILE_PENDING_APPROVAL';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );

  select job.* into v_existing
  from public.reservation_jobs as job
  where job.user_id = v_user_id and job.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.payload_hash <> p_payload_hash or v_existing.car_id <> p_car_id then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return query select v_existing.id, v_existing.status, v_existing.reservation_id, v_existing.error_code;
    return;
  end if;

  insert into public.reservation_jobs (
    user_id, car_id, start_at, end_at, pickup_location_id, dropoff_location_id,
    notes, idempotency_key, payload_hash
  ) values (
    v_user_id, p_car_id, p_start_at, p_end_at, p_pickup_location_id, p_dropoff_location_id,
    nullif(btrim(p_notes), ''), p_idempotency_key, p_payload_hash
  ) returning id into v_job_id;

  return query select v_job_id, 'pending'::text, null::uuid, null::text;
end;
$$;

revoke all on function private.enqueue_reservation_job(uuid,timestamptz,timestamptz,uuid,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function private.enqueue_reservation_job(uuid,timestamptz,timestamptz,uuid,uuid,text,text,text)
  to authenticated;

create or replace function public.enqueue_reservation_job(
  p_car_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_pickup_location_id uuid,
  p_dropoff_location_id uuid,
  p_notes text,
  p_idempotency_key text,
  p_payload_hash text
)
returns table (job_id uuid, status text, reservation_id uuid, error_code text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.enqueue_reservation_job(
    p_car_id, p_start_at, p_end_at, p_pickup_location_id, p_dropoff_location_id,
    p_notes, p_idempotency_key, p_payload_hash
  );
$$;

revoke all on function public.enqueue_reservation_job(uuid,timestamptz,timestamptz,uuid,uuid,text,text,text)
  from public, anon;
grant execute on function public.enqueue_reservation_job(uuid,timestamptz,timestamptz,uuid,uuid,text,text,text)
  to authenticated;

create or replace function private.process_reservation_queue(p_limit integer default 10)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.reservation_jobs%rowtype;
  v_result record;
  v_processed integer := 0;
  v_previous_sub text;
  v_error_code text;
  v_error_message text;
  v_final_failure boolean;
begin
  if p_limit not between 1 and 50 then
    raise exception using errcode = '22023', message = 'INVALID_BATCH_SIZE';
  end if;

  for v_job in
    with claimed as (
      select job.id
      from public.reservation_jobs as job
      where job.status = 'pending'
        and job.available_at <= now()
      order by job.available_at, job.created_at
      limit p_limit
      for update skip locked
    )
    update public.reservation_jobs as job
    set status = 'processing',
        attempts = job.attempts + 1,
        locked_at = now(),
        updated_at = now()
    from claimed
    where job.id = claimed.id
    returning job.*
  loop
    v_processed := v_processed + 1;
    v_previous_sub := current_setting('request.jwt.claim.sub', true);

    begin
      perform set_config('request.jwt.claim.sub', v_job.user_id::text, true);

      select * into v_result
      from private.reserve_car_atomic(
        v_job.car_id, v_job.start_at, v_job.end_at,
        v_job.pickup_location_id, v_job.dropoff_location_id, v_job.notes,
        v_job.idempotency_key, v_job.payload_hash
      );

      update public.reservation_jobs as job
      set status = 'succeeded',
          reservation_id = v_result.reservation_id,
          result = jsonb_build_object(
            'reservation_id', v_result.reservation_id,
            'car_id', v_result.car_id,
            'start_at', v_result.start_at,
            'end_at', v_result.end_at,
            'status', v_result.status
          ),
          error_code = null,
          completed_at = now(),
          locked_at = null,
          updated_at = now()
      where job.id = v_job.id;
    exception when others then
      get stacked diagnostics v_error_code = returned_sqlstate, v_error_message = message_text;
      v_final_failure := v_job.attempts >= v_job.max_attempts
        or v_error_code in ('22004', '22007', '22023', '23503', '23514', '23P01', '42501');

      update public.reservation_jobs as job
      set status = case when v_final_failure then 'failed' else 'pending' end,
          error_code = case
            when v_error_message ~ '^[A-Z][A-Z0-9_]+$' then v_error_message
            else 'INTERNAL_ERROR'
          end,
          available_at = case
            when v_final_failure then job.available_at
            else now() + make_interval(secs => least(300, 15 * (2 ^ greatest(0, job.attempts - 1)))::integer)
          end,
          completed_at = case when v_final_failure then now() else null end,
          locked_at = null,
          updated_at = now()
      where job.id = v_job.id;
    end;

    perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);
  end loop;

  return v_processed;
end;
$$;

revoke all on function private.process_reservation_queue(integer) from public, anon, authenticated;
grant execute on function private.process_reservation_queue(integer) to service_role;

create or replace function public.process_reservation_queue(p_limit integer default 10)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.process_reservation_queue(p_limit);
$$;

revoke all on function public.process_reservation_queue(integer) from public, anon, authenticated;
grant execute on function public.process_reservation_queue(integer) to service_role;

select cron.schedule(
  'process-reservation-queue',
  '* * * * *',
  $cron$select private.process_reservation_queue(10);$cron$
);
