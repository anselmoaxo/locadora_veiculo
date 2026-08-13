create index if not exists reservation_jobs_car_idx
  on public.reservation_jobs (car_id);

create index if not exists reservation_jobs_pickup_location_idx
  on public.reservation_jobs (pickup_location_id)
  where pickup_location_id is not null;

create index if not exists reservation_jobs_dropoff_location_idx
  on public.reservation_jobs (dropoff_location_id)
  where dropoff_location_id is not null;

create index if not exists reservation_jobs_reservation_idx
  on public.reservation_jobs (reservation_id)
  where reservation_id is not null;
