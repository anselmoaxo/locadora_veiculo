create extension if not exists btree_gist with schema extensions;

alter table public.reservas
  add column if not exists observacoes text;

alter table public.reservas
  drop constraint if exists reservas_observacoes_tamanho;

alter table public.reservas
  add constraint reservas_observacoes_tamanho
  check (observacoes is null or char_length(observacoes) <= 2000);

create table if not exists public.car_blocks (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.veiculos(id) on delete cascade,
  reservation_id uuid not null unique references public.reservas(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint car_blocks_valid_period check (start_at < end_at),
  constraint car_blocks_valid_status check (status in ('active', 'released')),
  constraint car_blocks_no_overlap exclude using gist (
    car_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status = 'active')
);

comment on table public.car_blocks is
  'Bloqueios temporais de veiculos criados atomicamente com as reservas.';

create index if not exists car_blocks_car_period_idx
  on public.car_blocks using gist (car_id, tstzrange(start_at, end_at, '[)'))
  where status = 'active';

alter table public.car_blocks enable row level security;
revoke all on table public.car_blocks from public, anon, authenticated;

create table if not exists public.idempotency_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  car_id uuid not null references public.veiculos(id) on delete cascade,
  payload_hash text not null,
  reservation_id uuid references public.reservas(id) on delete set null,
  response_body jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, idempotency_key),
  constraint idempotency_requests_key_length
    check (char_length(idempotency_key) between 1 and 200),
  constraint idempotency_requests_payload_hash
    check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint idempotency_requests_completed
    check ((completed_at is null) = (response_body is null))
);

comment on table public.idempotency_requests is
  'Resultados de comandos mutaveis para repeticao segura por usuario e chave.';

create index if not exists idempotency_requests_created_idx
  on public.idempotency_requests (created_at);

alter table public.idempotency_requests enable row level security;
revoke all on table public.idempotency_requests from public, anon, authenticated;

create or replace function private.reserve_car_atomic(
  p_car_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_pickup_location_id uuid,
  p_dropoff_location_id uuid,
  p_notes text,
  p_idempotency_key text,
  p_payload_hash text
)
returns table (
  reservation_id uuid,
  car_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.idempotency_requests%rowtype;
  v_vehicle public.veiculos%rowtype;
  v_pickup_location_id uuid;
  v_dropoff_location_id uuid;
  v_reservation_id uuid := gen_random_uuid();
  v_code text;
  v_daily_price numeric(10,2);
  v_days smallint;
  v_subtotal numeric(12,2);
  v_response jsonb;
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

  if p_idempotency_key is null
     or char_length(p_idempotency_key) not between 1 and 200
     or p_payload_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_IDEMPOTENCY_DATA';
  end if;

  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception using errcode = '22023', message = 'NOTES_TOO_LONG';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );

  select * into v_existing
  from public.idempotency_requests
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.payload_hash <> p_payload_hash or v_existing.car_id <> p_car_id then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;

    if v_existing.response_body is null then
      raise exception using errcode = '40001', message = 'REQUEST_IN_PROGRESS';
    end if;

    return query select
      (v_existing.response_body ->> 'reservation_id')::uuid,
      (v_existing.response_body ->> 'car_id')::uuid,
      (v_existing.response_body ->> 'start_at')::timestamptz,
      (v_existing.response_body ->> 'end_at')::timestamptz,
      v_existing.response_body ->> 'status';
    return;
  end if;

  insert into public.idempotency_requests (
    user_id, idempotency_key, car_id, payload_hash
  ) values (
    v_user_id, p_idempotency_key, p_car_id, p_payload_hash
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_car_id::text, 0)
  );

  select vehicle.* into v_vehicle
  from public.veiculos as vehicle
  where vehicle.id = p_car_id
  for update;

  if not found or not v_vehicle.ativo
     or v_vehicle.status_operacional not in ('disponivel', 'reservado') then
    raise exception using errcode = '23P01', message = 'CAR_UNAVAILABLE';
  end if;

  v_pickup_location_id := coalesce(p_pickup_location_id, v_vehicle.local_atual_id);
  v_dropoff_location_id := coalesce(p_dropoff_location_id, v_pickup_location_id);

  if v_pickup_location_id is null or v_dropoff_location_id is null
     or not exists (
       select 1 from public.locais
       where id = v_pickup_location_id and ativo
     )
     or not exists (
       select 1 from public.locais
       where id = v_dropoff_location_id and ativo
     ) then
    raise exception using errcode = '23503', message = 'LOCATION_UNAVAILABLE';
  end if;

  if exists (
    select 1 from public.reservas as reservation
    where reservation.veiculo_id = p_car_id
      and reservation.status in ('pendente', 'confirmada')
      and reservation.retirada_em < p_end_at
      and reservation.devolucao_em > p_start_at
  ) or exists (
    select 1 from public.locacoes as rental
    where rental.veiculo_id = p_car_id
      and rental.status = 'ativa'
      and rental.retirada_em < p_end_at
      and rental.devolucao_em > p_start_at
  ) or exists (
    select 1 from public.car_blocks as block
    where block.car_id = p_car_id
      and block.status = 'active'
      and block.start_at < p_end_at
      and block.end_at > p_start_at
  ) then
    raise exception using
      errcode = '23P01',
      message = 'CAR_UNAVAILABLE',
      detail = format('Requested window: [%s, %s)', p_start_at, p_end_at);
  end if;

  select version.preco_base_diaria into v_daily_price
  from public.versoes_veiculo as version
  where version.id = v_vehicle.versao_id and version.ativo;

  if not found or v_daily_price is null then
    raise exception using errcode = '23P01', message = 'CAR_UNAVAILABLE';
  end if;

  v_days := greatest(
    1,
    ceil(extract(epoch from (p_end_at - p_start_at)) / 86400.0)::integer
  )::smallint;
  v_subtotal := v_daily_price * v_days;
  v_code := 'HMX-' || upper(substr(replace(v_reservation_id::text, '-', ''), 1, 8));

  insert into public.reservas (
    id, codigo, usuario_id, veiculo_id,
    local_retirada_id, local_devolucao_id,
    retirada_em, devolucao_em, status,
    quantidade_diarias, preco_diaria_snapshot,
    subtotal_veiculo, total_protecao, valor_total, observacoes
  ) values (
    v_reservation_id, v_code, v_user_id, p_car_id,
    v_pickup_location_id, v_dropoff_location_id,
    p_start_at, p_end_at, 'pendente',
    v_days, v_daily_price,
    v_subtotal, 0, v_subtotal, nullif(btrim(p_notes), '')
  );

  insert into public.car_blocks (
    car_id, reservation_id, start_at, end_at, status
  ) values (
    p_car_id, v_reservation_id, p_start_at, p_end_at, 'active'
  );

  v_response := jsonb_build_object(
    'reservation_id', v_reservation_id,
    'car_id', p_car_id,
    'start_at', p_start_at,
    'end_at', p_end_at,
    'status', 'pending'
  );

  update public.idempotency_requests
  set reservation_id = v_reservation_id,
      response_body = v_response,
      completed_at = now()
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  return query select
    v_reservation_id, p_car_id, p_start_at, p_end_at, 'pending'::text;
end;
$$;

revoke all on function private.reserve_car_atomic(
  uuid, timestamptz, timestamptz, uuid, uuid, text, text, text
) from public, anon, authenticated;

grant execute on function private.reserve_car_atomic(
  uuid, timestamptz, timestamptz, uuid, uuid, text, text, text
) to authenticated;

create or replace function public.reserve_car_atomic(
  p_car_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_pickup_location_id uuid default null,
  p_dropoff_location_id uuid default null,
  p_notes text default null,
  p_idempotency_key text default null,
  p_payload_hash text default null
)
returns table (
  reservation_id uuid,
  car_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  status text
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.reserve_car_atomic(
    p_car_id,
    p_start_at,
    p_end_at,
    p_pickup_location_id,
    p_dropoff_location_id,
    p_notes,
    p_idempotency_key,
    p_payload_hash
  );
$$;

revoke all on function public.reserve_car_atomic(
  uuid, timestamptz, timestamptz, uuid, uuid, text, text, text
) from public, anon;

grant execute on function public.reserve_car_atomic(
  uuid, timestamptz, timestamptz, uuid, uuid, text, text, text
) to authenticated;
