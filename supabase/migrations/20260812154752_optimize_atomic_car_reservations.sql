drop index if exists public.car_blocks_car_period_idx;

create index if not exists idempotency_requests_car_idx
  on public.idempotency_requests (car_id);

create index if not exists idempotency_requests_reservation_idx
  on public.idempotency_requests (reservation_id)
  where reservation_id is not null;
