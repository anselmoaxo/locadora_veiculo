alter table public.perfis
  add column if not exists cnh_numero text,
  add column if not exists cnh_categoria text,
  add column if not exists cnh_validade date,
  add column if not exists cnh_uf text,
  add column if not exists cadastro_status text not null default 'incompleto',
  add column if not exists avaliacao_observacao text,
  add column if not exists avaliado_em timestamptz,
  add column if not exists avaliado_por uuid references auth.users(id) on delete set null;

alter table public.perfis
  drop constraint if exists perfis_cnh_numero_formato,
  drop constraint if exists perfis_cnh_categoria_valida,
  drop constraint if exists perfis_cnh_uf_valida,
  drop constraint if exists perfis_cadastro_status_valido,
  drop constraint if exists perfis_avaliacao_observacao_tamanho;

alter table public.perfis
  add constraint perfis_cnh_numero_formato
    check (cnh_numero is null or cnh_numero ~ '^[0-9]{11}$'),
  add constraint perfis_cnh_categoria_valida
    check (cnh_categoria is null or cnh_categoria in ('ACC', 'A', 'B', 'AB', 'C', 'AC', 'D', 'AD', 'E', 'AE')),
  add constraint perfis_cnh_uf_valida
    check (cnh_uf is null or cnh_uf in (
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
      'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
      'SP', 'SE', 'TO'
    )),
  add constraint perfis_cadastro_status_valido
    check (cadastro_status in ('incompleto', 'em_analise', 'aprovado', 'reprovado')),
  add constraint perfis_avaliacao_observacao_tamanho
    check (avaliacao_observacao is null or char_length(avaliacao_observacao) <= 1000);

create unique index if not exists perfis_cnh_numero_unique_idx
  on public.perfis (cnh_numero)
  where cnh_numero is not null;

create index if not exists perfis_cadastro_status_idx
  on public.perfis (cadastro_status, updated_at desc);

comment on column public.perfis.cnh_numero is 'Numero da CNH, armazenado somente com digitos.';
comment on column public.perfis.cadastro_status is 'Situacao da validacao cadastral para permitir reservas.';

create or replace function private.safe_profile_date(p_value text)
returns date
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return p_value::date;
exception when others then
  return null;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cpf text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '[^0-9]', '', 'g');
  v_phone text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g');
  v_cnh text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'cnh_number', ''), '[^0-9]', '', 'g');
  v_category text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'cnh_category', '')));
  v_state text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'cnh_state', '')));
  v_expiration date := private.safe_profile_date(new.raw_user_meta_data ->> 'cnh_expiration');
  v_complete boolean;
begin
  v_cpf := case when v_cpf ~ '^[0-9]{11}$' and v_cpf !~ '^([0-9])\1{10}$' then v_cpf else null end;
  v_phone := case when v_phone ~ '^[0-9]{10,13}$' then v_phone else null end;
  v_cnh := case when v_cnh ~ '^[0-9]{11}$' and v_cnh !~ '^([0-9])\1{10}$' then v_cnh else null end;
  v_category := case when v_category in ('ACC', 'A', 'B', 'AB', 'C', 'AC', 'D', 'AD', 'E', 'AE') then v_category else null end;
  v_state := case when v_state in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
    'SP', 'SE', 'TO'
  ) then v_state else null end;
  v_complete := v_cpf is not null and v_phone is not null and v_cnh is not null
    and v_category is not null and v_state is not null and v_expiration >= current_date;

  insert into public.perfis (
    id, nome_completo, cpf, telefone, cnh_numero, cnh_categoria,
    cnh_validade, cnh_uf, cadastro_status
  ) values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, 'Cliente'), '@', 1)
    ),
    v_cpf,
    v_phone,
    v_cnh,
    v_category,
    v_expiration,
    v_state,
    case when v_complete then 'em_analise' else 'incompleto' end
  )
  on conflict (id) do update
  set nome_completo = excluded.nome_completo,
      cpf = coalesce(excluded.cpf, public.perfis.cpf),
      telefone = coalesce(excluded.telefone, public.perfis.telefone),
      cnh_numero = coalesce(excluded.cnh_numero, public.perfis.cnh_numero),
      cnh_categoria = coalesce(excluded.cnh_categoria, public.perfis.cnh_categoria),
      cnh_validade = coalesce(excluded.cnh_validade, public.perfis.cnh_validade),
      cnh_uf = coalesce(excluded.cnh_uf, public.perfis.cnh_uf),
      cadastro_status = case when v_complete then 'em_analise' else public.perfis.cadastro_status end,
      updated_at = now();

  return new;
end;
$$;

create or replace function private.submit_driver_profile(
  p_full_name text,
  p_cpf text,
  p_phone text,
  p_cnh_number text,
  p_cnh_category text,
  p_cnh_expiration date,
  p_cnh_state text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_full_name, ''));
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_cnh text := regexp_replace(coalesce(p_cnh_number, ''), '[^0-9]', '', 'g');
  v_category text := upper(btrim(coalesce(p_cnh_category, '')));
  v_state text := upper(btrim(coalesce(p_cnh_state, '')));
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;
  if char_length(v_name) not between 3 and 150 then
    raise exception using errcode = '22023', message = 'INVALID_FULL_NAME';
  end if;
  if v_cpf !~ '^[0-9]{11}$' or v_cpf ~ '^([0-9])\1{10}$' then
    raise exception using errcode = '22023', message = 'INVALID_CPF';
  end if;
  if v_phone !~ '^[0-9]{10,13}$' then
    raise exception using errcode = '22023', message = 'INVALID_PHONE';
  end if;
  if v_cnh !~ '^[0-9]{11}$' or v_cnh ~ '^([0-9])\1{10}$' then
    raise exception using errcode = '22023', message = 'INVALID_DRIVER_LICENSE';
  end if;
  if v_category not in ('ACC', 'A', 'B', 'AB', 'C', 'AC', 'D', 'AD', 'E', 'AE') then
    raise exception using errcode = '22023', message = 'INVALID_DRIVER_LICENSE_CATEGORY';
  end if;
  if p_cnh_expiration is null or p_cnh_expiration < current_date then
    raise exception using errcode = '22023', message = 'DRIVER_LICENSE_EXPIRED';
  end if;
  if v_state not in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
    'SP', 'SE', 'TO'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_DRIVER_LICENSE_STATE';
  end if;

  insert into public.perfis (
    id, nome_completo, cpf, telefone, cnh_numero, cnh_categoria,
    cnh_validade, cnh_uf, cadastro_status, avaliacao_observacao,
    avaliado_em, avaliado_por
  ) values (
    v_user_id, v_name, v_cpf, v_phone, v_cnh, v_category,
    p_cnh_expiration, v_state, 'em_analise', null, null, null
  )
  on conflict (id) do update
  set nome_completo = excluded.nome_completo,
      cpf = excluded.cpf,
      telefone = excluded.telefone,
      cnh_numero = excluded.cnh_numero,
      cnh_categoria = excluded.cnh_categoria,
      cnh_validade = excluded.cnh_validade,
      cnh_uf = excluded.cnh_uf,
      cadastro_status = 'em_analise',
      avaliacao_observacao = null,
      avaliado_em = null,
      avaliado_por = null,
      updated_at = now();

  return 'em_analise';
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'CPF_OR_DRIVER_LICENSE_ALREADY_REGISTERED';
end;
$$;

revoke all on function private.submit_driver_profile(text, text, text, text, text, date, text)
  from public, anon, authenticated;
grant execute on function private.submit_driver_profile(text, text, text, text, text, date, text)
  to authenticated;

create or replace function public.submit_driver_profile(
  p_full_name text,
  p_cpf text,
  p_phone text,
  p_cnh_number text,
  p_cnh_category text,
  p_cnh_expiration date,
  p_cnh_state text
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.submit_driver_profile(
    p_full_name, p_cpf, p_phone, p_cnh_number,
    p_cnh_category, p_cnh_expiration, p_cnh_state
  );
$$;

revoke all on function public.submit_driver_profile(text, text, text, text, text, date, text)
  from public, anon;
grant execute on function public.submit_driver_profile(text, text, text, text, text, date, text)
  to authenticated;

create or replace function private.assert_vehicle_administrator()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1 from public.administradores as administrator
    where administrator.usuario_id = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
  end if;
  return v_user_id;
end;
$$;

revoke all on function private.assert_vehicle_administrator() from public, anon, authenticated;
grant execute on function private.assert_vehicle_administrator() to authenticated;

create or replace function private.admin_list_driver_profiles()
returns table (
  user_id uuid,
  email text,
  full_name text,
  cpf text,
  phone text,
  cnh_number text,
  cnh_category text,
  cnh_expiration date,
  cnh_state text,
  registration_status text,
  review_note text,
  is_admin boolean,
  updated_at timestamptz
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
    account.id,
    account.email::text,
    profile.nome_completo,
    profile.cpf,
    profile.telefone,
    profile.cnh_numero,
    profile.cnh_categoria,
    profile.cnh_validade,
    profile.cnh_uf,
    profile.cadastro_status,
    profile.avaliacao_observacao,
    administrator.usuario_id is not null,
    profile.updated_at
  from auth.users as account
  left join public.perfis as profile on profile.id = account.id
  left join public.administradores as administrator on administrator.usuario_id = account.id
  order by
    case profile.cadastro_status when 'em_analise' then 0 when 'incompleto' then 1 when 'reprovado' then 2 else 3 end,
    profile.updated_at desc nulls last;
end;
$$;

revoke all on function private.admin_list_driver_profiles() from public, anon, authenticated;
grant execute on function private.admin_list_driver_profiles() to authenticated;

create or replace function public.admin_list_driver_profiles()
returns table (
  user_id uuid,
  email text,
  full_name text,
  cpf text,
  phone text,
  cnh_number text,
  cnh_category text,
  cnh_expiration date,
  cnh_state text,
  registration_status text,
  review_note text,
  is_admin boolean,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.admin_list_driver_profiles(); $$;

revoke all on function public.admin_list_driver_profiles() from public, anon;
grant execute on function public.admin_list_driver_profiles() to authenticated;

create or replace function private.admin_review_driver_profile(
  p_user_id uuid,
  p_status text,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := private.assert_vehicle_administrator();
  v_profile public.perfis%rowtype;
begin
  if p_status not in ('aprovado', 'reprovado') then
    raise exception using errcode = '22023', message = 'INVALID_REVIEW_STATUS';
  end if;
  if p_note is not null and char_length(btrim(p_note)) > 1000 then
    raise exception using errcode = '22023', message = 'REVIEW_NOTE_TOO_LONG';
  end if;

  select profile.* into v_profile
  from public.perfis as profile
  where profile.id = p_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PROFILE_NOT_FOUND';
  end if;

  if p_status = 'aprovado' and (
    v_profile.cpf is null or v_profile.telefone is null or v_profile.cnh_numero is null
    or v_profile.cnh_categoria is null or v_profile.cnh_uf is null
    or v_profile.cnh_validade is null or v_profile.cnh_validade < current_date
  ) then
    raise exception using errcode = '22023', message = 'PROFILE_INCOMPLETE_OR_LICENSE_EXPIRED';
  end if;

  update public.perfis as profile
  set cadastro_status = p_status,
      avaliacao_observacao = nullif(btrim(p_note), ''),
      avaliado_em = now(),
      avaliado_por = v_admin_id,
      updated_at = now()
  where profile.id = p_user_id;

  return p_status;
end;
$$;

revoke all on function private.admin_review_driver_profile(uuid, text, text) from public, anon, authenticated;
grant execute on function private.admin_review_driver_profile(uuid, text, text) to authenticated;

create or replace function public.admin_review_driver_profile(
  p_user_id uuid,
  p_status text,
  p_note text default null
)
returns text
language sql
security invoker
set search_path = ''
as $$ select private.admin_review_driver_profile(p_user_id, p_status, p_note); $$;

revoke all on function public.admin_review_driver_profile(uuid, text, text) from public, anon;
grant execute on function public.admin_review_driver_profile(uuid, text, text) to authenticated;

create or replace function private.admin_list_reservations()
returns table (
  reservation_id uuid,
  code text,
  reservation_status text,
  created_at timestamptz,
  pickup_at timestamptz,
  return_at timestamptz,
  total numeric,
  user_id uuid,
  customer_name text,
  customer_status text,
  car_id uuid,
  vehicle_name text
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
    reservation.id,
    reservation.codigo,
    reservation.status,
    reservation.created_at,
    reservation.retirada_em,
    reservation.devolucao_em,
    reservation.valor_total,
    reservation.usuario_id,
    profile.nome_completo,
    profile.cadastro_status,
    reservation.veiculo_id,
    concat_ws(' ', brand.nome, model.nome, vehicle_version.nome, vehicle_version.ano_modelo::text)
  from public.reservas as reservation
  join public.perfis as profile on profile.id = reservation.usuario_id
  join public.veiculos as vehicle on vehicle.id = reservation.veiculo_id
  join public.versoes_veiculo as vehicle_version on vehicle_version.id = vehicle.versao_id
  join public.modelos_veiculo as model on model.id = vehicle_version.modelo_id
  join public.marcas as brand on brand.id = model.marca_id
  order by reservation.created_at desc;
end;
$$;

revoke all on function private.admin_list_reservations() from public, anon, authenticated;
grant execute on function private.admin_list_reservations() to authenticated;

create or replace function public.admin_list_reservations()
returns table (
  reservation_id uuid,
  code text,
  reservation_status text,
  created_at timestamptz,
  pickup_at timestamptz,
  return_at timestamptz,
  total numeric,
  user_id uuid,
  customer_name text,
  customer_status text,
  car_id uuid,
  vehicle_name text
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.admin_list_reservations(); $$;

revoke all on function public.admin_list_reservations() from public, anon;
grant execute on function public.admin_list_reservations() to authenticated;

create or replace function private.admin_review_reservation(
  p_reservation_id uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.reservas%rowtype;
  v_profile public.perfis%rowtype;
begin
  perform private.assert_vehicle_administrator();
  if p_status not in ('confirmada', 'cancelada') then
    raise exception using errcode = '22023', message = 'INVALID_RESERVATION_REVIEW_STATUS';
  end if;

  select reservation.* into v_reservation
  from public.reservas as reservation
  where reservation.id = p_reservation_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'RESERVATION_NOT_FOUND';
  end if;
  if v_reservation.status not in ('pendente', 'confirmada') then
    raise exception using errcode = '22023', message = 'RESERVATION_ALREADY_FINALIZED';
  end if;

  if p_status = 'confirmada' then
    select profile.* into v_profile
    from public.perfis as profile
    where profile.id = v_reservation.usuario_id;
    if not found or v_profile.cadastro_status <> 'aprovado'
       or v_profile.cnh_validade is null or v_profile.cnh_validade < current_date then
      raise exception using errcode = '22023', message = 'DRIVER_NOT_APPROVED';
    end if;
  end if;

  update public.reservas as reservation
  set status = p_status,
      updated_at = now()
  where reservation.id = p_reservation_id;

  if p_status = 'cancelada' then
    update public.car_blocks as block
    set status = 'released'
    where block.reservation_id = p_reservation_id
      and block.status = 'active';
  end if;

  return p_status;
end;
$$;

revoke all on function private.admin_review_reservation(uuid, text) from public, anon, authenticated;
grant execute on function private.admin_review_reservation(uuid, text) to authenticated;

create or replace function public.admin_review_reservation(
  p_reservation_id uuid,
  p_status text
)
returns text
language sql
security invoker
set search_path = ''
as $$ select private.admin_review_reservation(p_reservation_id, p_status); $$;

revoke all on function public.admin_review_reservation(uuid, text) from public, anon;
grant execute on function public.admin_review_reservation(uuid, text) to authenticated;

create or replace function private.enforce_approved_driver_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.perfis%rowtype;
begin
  select profile.* into v_profile
  from public.perfis as profile
  where profile.id = new.usuario_id;

  if not found or v_profile.cpf is null or v_profile.telefone is null
     or v_profile.cnh_numero is null or v_profile.cnh_categoria is null
     or v_profile.cnh_validade is null or v_profile.cnh_uf is null then
    raise exception using errcode = '22023', message = 'PROFILE_INCOMPLETE';
  end if;
  if v_profile.cnh_validade < current_date then
    raise exception using errcode = '22023', message = 'DRIVER_LICENSE_EXPIRED';
  end if;
  if v_profile.cadastro_status = 'reprovado' then
    raise exception using errcode = '22023', message = 'PROFILE_REJECTED';
  end if;
  if v_profile.cadastro_status <> 'aprovado' then
    raise exception using errcode = '22023', message = 'PROFILE_PENDING_APPROVAL';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_approved_driver_before_reservation on public.reservas;
create trigger enforce_approved_driver_before_reservation
  before insert on public.reservas
  for each row execute function private.enforce_approved_driver_reservation();

revoke all on function private.safe_profile_date(text) from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.enforce_approved_driver_reservation() from public, anon, authenticated;

grant select on table public.perfis to authenticated;
revoke update on table public.perfis from authenticated;
