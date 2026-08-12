create table if not exists public.administradores (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.administradores is
  'Lista privada de usuarios autorizados a administrar veiculos.';

alter table public.administradores enable row level security;

revoke all on table public.administradores from public;
revoke all on table public.administradores from anon;
revoke all on table public.administradores from authenticated;
grant select on table public.administradores to service_role;
