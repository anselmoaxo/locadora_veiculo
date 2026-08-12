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

  select request.* into v_existing
  from public.idempotency_requests as request
  where request.user_id = v_user_id
    and request.idempotency_key = p_idempotency_key;

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
       select 1 from public.locais as pickup_location
       where pickup_location.id = v_pickup_location_id
         and pickup_location.ativo
     )
     or not exists (
       select 1 from public.locais as dropoff_location
       where dropoff_location.id = v_dropoff_location_id
         and dropoff_location.ativo
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

  update public.idempotency_requests as request
  set reservation_id = v_reservation_id,
      response_body = v_response,
      completed_at = now()
  where request.user_id = v_user_id
    and request.idempotency_key = p_idempotency_key;

  return query select
    v_reservation_id, p_car_id, p_start_at, p_end_at, 'pending'::text;
end;
$$;

create or replace function private.is_vehicle_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.administradores as administrator
      where administrator.usuario_id = (select auth.uid())
    );
$$;

revoke all on function private.is_vehicle_administrator() from public, anon, authenticated;
grant execute on function private.is_vehicle_administrator() to authenticated;

create or replace function public.is_vehicle_administrator()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_vehicle_administrator();
$$;

revoke all on function public.is_vehicle_administrator() from public, anon;
grant execute on function public.is_vehicle_administrator() to authenticated;
