-- ============================================================================
-- RESET DE HOMOLOGAÇÃO — AXIO Locadoras
-- ============================================================================
-- Objetivo:
--   1. Remover TODOS os clientes e administradores do sistema
--   2. Criar 1 único administrador
--   3. Deixar apenas 5 veículos visíveis no catálogo
--   4. Conferir o fluxo de reserva
--
-- COMO EXECUTAR:
--   Supabase Dashboard -> SQL Editor -> cole cada ETAPA separadamente
--   (o SQL Editor roda como service_role, necessário para auth.users
--    e para public.administradores)
--
-- ATENÇÃO: as ETAPAS 2 e 5 são DESTRUTIVAS e IRREVERSÍVEIS.
--          Faça backup antes (Dashboard -> Database -> Backups).
-- ============================================================================


-- ============================================================================
-- ETAPA 1 — INVENTÁRIO (não altera nada, rode primeiro)
-- ============================================================================
select 'auth.users'            as tabela, count(*) as total from auth.users
union all select 'perfis',               count(*) from public.perfis
union all select 'administradores',      count(*) from public.administradores
union all select 'reservas',             count(*) from public.reservas
union all select 'car_blocks',           count(*) from public.car_blocks
union all select 'reservation_jobs',     count(*) from public.reservation_jobs
union all select 'idempotency_requests', count(*) from public.idempotency_requests
union all select 'locacoes',             count(*) from public.locacoes
union all select 'veiculos (total)',     count(*) from public.veiculos
union all select 'veiculos (ativos)',    count(*) from public.veiculos where ativo
order by tabela;

-- Liste os usuários que serão apagados, para registro:
select u.id, u.email, u.created_at,
       (a.usuario_id is not null) as e_admin,
       p.nome_completo, p.cadastro_status
from auth.users u
left join public.administradores a on a.usuario_id = u.id
left join public.perfis p          on p.id = u.id
order by u.created_at;


-- ============================================================================
-- ETAPA 2 — LIMPEZA DE CLIENTES, ADMINS E DADOS TRANSACIONAIS
-- ============================================================================
-- A ordem respeita as foreign keys. car_blocks/idempotency_requests já teriam
-- cascade a partir de reservas/auth.users, mas o delete explícito garante
-- previsibilidade caso o schema remoto (não versionado) divirja.
-- Para executar, troque false por true no bloco de confirmação abaixo.
-- Execute somente em homologação, com backup conferido e sem usuários ativos.
begin;

  do $$
  begin
    if false is not true then
      raise exception 'Reset bloqueado. Confirme o ambiente e altere o guard para true.';
    end if;
  end $$;

  delete from public.car_blocks;
  delete from public.idempotency_requests;
  delete from public.reservation_jobs;
  delete from public.locacoes;
  delete from public.reservas;

  delete from public.administradores;
  delete from public.perfis;

  -- Remove todos os logins. Cascateia para auth.identities e auth.sessions.
  delete from auth.users;

  -- Remove snapshots e metadados que podem conter dados pessoais de teste.
  delete from public.audit_log;
  delete from public.function_logs;
  delete from private.rate_limit_counters;

commit;

-- Verificação: todas as contagens abaixo devem ser 0
select 'auth.users' as tabela, count(*) as total from auth.users
union all select 'perfis',          count(*) from public.perfis
union all select 'administradores', count(*) from public.administradores
union all select 'reservas',        count(*) from public.reservas
union all select 'car_blocks',      count(*) from public.car_blocks;


-- ============================================================================
-- ETAPA 3 — CRIAR O USUÁRIO ADMINISTRADOR
-- ============================================================================
-- NÃO crie o usuário por SQL. A escrita manual em auth.users é frágil
-- (hash de senha, auth.identities, versão do GoTrue) e pode gerar um usuário
-- que não consegue logar.
--
-- Faça pelo Dashboard:
--   Authentication -> Users -> "Add user" -> "Create new user"
--     Email:            <defina>
--     Password:         <defina>
--     Auto Confirm User: MARCADO   <-- obrigatório, senão o login falha
--
-- Depois de criar, prossiga para a ETAPA 4.


-- ============================================================================
-- ETAPA 4 — CONCEDER PERMISSÃO DE ADMIN E APROVAR O PERFIL
-- ============================================================================
-- Substitua o e-mail abaixo pelo que você criou na ETAPA 3.
do $$
declare
  v_email text := 'ADMIN_EMAIL_AQUI';
  v_nome  text := 'Administrador AXIO';
  v_id    uuid;
begin
  select id into v_id from auth.users where email = v_email;

  if v_id is null then
    raise exception 'Usuário % não encontrado. Crie-o na ETAPA 3 antes.', v_email;
  end if;

  -- 4.1 Torna administrador (é a ÚNICA fonte de verdade de admin no sistema:
  --     private.is_vehicle_administrator() consulta esta tabela)
  insert into public.administradores (usuario_id)
  values (v_id)
  on conflict (usuario_id) do nothing;

  -- 4.2 Garante perfil aprovado.
  --     Necessário porque o trigger enforce_approved_driver_before_reservation
  --     exige perfis.cadastro_status = 'aprovado' para INSERT em reservas.
  insert into public.perfis (id, nome_completo, cadastro_status)
  values (v_id, v_nome, 'aprovado')
  on conflict (id) do update
    set nome_completo   = coalesce(public.perfis.nome_completo, excluded.nome_completo),
        cadastro_status = 'aprovado';

  raise notice 'Admin configurado: % (%)', v_email, v_id;
end $$;

-- Verificação do admin
select u.id, u.email, u.email_confirmed_at,
       (a.usuario_id is not null) as e_admin,
       p.cadastro_status
from auth.users u
left join public.administradores a on a.usuario_id = u.id
left join public.perfis p          on p.id = u.id;


-- ============================================================================
-- ETAPA 5 — DEIXAR APENAS 5 VEÍCULOS NO CATÁLOGO
-- ============================================================================
-- Abordagem recomendada: desativar (ativo = false) em vez de DELETE.
--   - public.catalogo_veiculos e buscar_veiculos_disponiveis filtram por ativo
--   - é reversível
--   - evita cascade em car_blocks / reservation_jobs / reservas
--
-- Mantém 5 veículos de 5 versões DIFERENTES, para o catálogo ter variedade,
-- e só versões com preco_base_diaria preenchido (senão a reserva falha
-- com CAR_UNAVAILABLE em private.reserve_car_atomic).

-- 5.1 Pré-visualize quais ficarão ativos (rode antes do update):
with elegiveis as (
  select v.id, v.placa, v.versao_id, v.status_operacional, v.local_atual_id,
         m.nome as marca, mo.nome as modelo, vv.ano_modelo, vv.preco_base_diaria,
         row_number() over (
           partition by v.versao_id
           order by v.placa nulls last, v.codigo_interno nulls last, v.id
         ) as rn,
         dense_rank() over (order by v.versao_id)                      as versao_rank
  from public.veiculos v
  join public.versoes_veiculo vv on vv.id = v.versao_id
  join public.modelos_veiculo mo on mo.id = vv.modelo_id
  join public.marcas m           on m.id  = mo.marca_id
  where v.ativo
    and vv.ativo
    and vv.preco_base_diaria is not null
    and v.local_atual_id is not null
)
select marca, modelo, ano_modelo, placa, preco_base_diaria, status_operacional
from elegiveis
where rn = 1 and versao_rank <= 5
order by marca, modelo;

-- 5.2 Aplique (só depois de conferir o resultado de 5.1):
begin;

  do $$
  begin
    if false is not true then
      raise exception 'Seleção de frota bloqueada. Confirme o ambiente e altere o guard para true.';
    end if;
  end $$;

  create temporary table reset_veiculos_manter on commit drop as
  with elegiveis as (
    select v.id,
           row_number() over (
             partition by v.versao_id
             order by v.placa nulls last, v.codigo_interno nulls last, v.id
           ) as rn,
           dense_rank() over (order by v.versao_id)                      as versao_rank
    from public.veiculos v
    join public.versoes_veiculo vv on vv.id = v.versao_id
    where v.ativo
      and vv.ativo
      and vv.preco_base_diaria is not null
      and v.local_atual_id is not null
  ),
  select id from elegiveis where rn = 1 and versao_rank <= 5;

  do $$
  declare
    v_total integer;
  begin
    select count(*) into v_total from reset_veiculos_manter;
    if v_total <> 5 then
      raise exception 'Reset abortado: esperados 5 veículos elegíveis, encontrados %.', v_total;
    end if;
  end $$;

  update public.veiculos v
  set ativo = false
  where v.ativo
    and v.id not in (select id from reset_veiculos_manter);

  -- Garante que os 5 mantidos estão operacionalmente disponíveis
  update public.veiculos
  set status_operacional = 'disponivel'
  where ativo and status_operacional <> 'disponivel';

commit;

-- 5.3 Verificação: deve retornar exatamente 5
select count(*) as veiculos_ativos from public.veiculos where ativo;

-- 5.4 Confirme pelo catálogo que o frontend consome
select id, marca, modelo, ano, categoria, preco_diaria, ativo
from public.catalogo_veiculos
where ativo
order by marca;


-- ============================================================================
-- ETAPA 6 — CONFERÊNCIA DO FLUXO DE RESERVA
-- ============================================================================

-- 6.1 Pré-requisitos que fazem a reserva FALHAR se não estiverem OK.
--     Todos devem retornar 'OK'.
select 'locais ativos' as item,
       case when count(*) >= 1 then 'OK' else 'FALHA: nenhum local ativo -> LOCATION_UNAVAILABLE' end as status
from public.locais where ativo
union all
select 'planos de protecao',
       case when count(*) >= 1 then 'OK'
            else 'ATENCAO: catalogo_protecoes vazio -> tela de reserva sem planos' end
from public.catalogo_protecoes where slug in ('basic','standard','advanced')
union all
select 'veiculos com preco',
       case when count(*) >= 1 then 'OK' else 'FALHA: nenhum veiculo ativo com preco -> CAR_UNAVAILABLE' end
from public.veiculos v
join public.versoes_veiculo vv on vv.id = v.versao_id
where v.ativo and vv.ativo and vv.preco_base_diaria is not null
union all
select 'veiculos com local_atual',
       case when count(*) = 0 then 'OK'
            else 'FALHA: ' || count(*) || ' veiculo(s) ativo(s) sem local_atual_id -> LOCATION_UNAVAILABLE' end
from public.veiculos where ativo and local_atual_id is null
union all
select 'RPC criar_reserva',
       case when count(*) >= 1 then 'OK' else 'FALHA: funcao publica criar_reserva ausente' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'criar_reserva'
union all
select 'RPC buscar_veiculos_disponiveis',
       case when count(*) >= 1 then 'OK' else 'FALHA: funcao ausente -> busca no frontend quebra' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'buscar_veiculos_disponiveis'
union all
select 'trigger perfil aprovado',
       case when count(*) >= 1 then 'OK (clientes precisam ser aprovados antes de reservar)'
            else 'ATENCAO: trigger ausente, regra de motorista aprovado nao aplicada' end
from pg_trigger
where tgname = 'enforce_approved_driver_before_reservation' and not tgisinternal
union all
select 'trava anti-overlap',
       case when count(*) >= 1 then 'OK' else 'FALHA CRITICA: sem car_blocks_no_overlap -> overbooking possivel' end
from pg_constraint where conname = 'car_blocks_no_overlap';

-- 6.2 Confirme o prefixo do código de reserva.
--     private.reserve_car_atomic foi criada com 'HMX-' na migration
--     20260812180810 e reescrita para 'AXO-' pela 20260812191413.
--     Deve retornar apenas 'AXO-'.
select proname,
       case when prosrc like '%AXO-%' then 'AXO- (correto)'
            when prosrc like '%HMX-%' then 'HMX- (rebrand NAO aplicado)'
            else 'prefixo nao encontrado' end as prefixo
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','private')
  and prosrc like '%reservas%'
  and (prosrc like '%HMX-%' or prosrc like '%AXO-%');

-- 6.3 Durante o teste manual, acompanhe a reserva criada:
select r.codigo, r.status, r.retirada_em, r.devolucao_em,
       r.quantidade_diarias, r.preco_diaria_snapshot,
       r.subtotal_veiculo, r.total_protecao, r.valor_total,
       v.placa, p.nome_completo, p.cadastro_status,
       cb.status as bloqueio
from public.reservas r
join public.veiculos v      on v.id = r.veiculo_id
left join public.perfis p   on p.id = r.usuario_id
left join public.car_blocks cb on cb.reservation_id = r.id
order by r.created_at desc
limit 20;

-- 6.4 Teste de overbooking: deve retornar 0 linhas.
--     Se retornar algo, há duas reservas ativas sobrepostas no mesmo carro.
select a.codigo as reserva_a, b.codigo as reserva_b, a.veiculo_id
from public.reservas a
join public.reservas b
  on b.veiculo_id = a.veiculo_id
 and b.id <> a.id
 and b.retirada_em < a.devolucao_em
 and b.devolucao_em > a.retirada_em
where a.status in ('pendente','confirmada')
  and b.status in ('pendente','confirmada');

-- 6.5 Fila assíncrona (Edge Function reserve-car). Em homologação, jobs
--     travados em 'processing' ou 'failed' indicam problema no worker.
select status, count(*), max(attempts) as max_tentativas
from public.reservation_jobs
group by status;


-- ============================================================================
-- ETAPA 7 — APROVAR O CLIENTE DE TESTE (necessário para reservar)
-- ============================================================================
-- Ao cadastrar um cliente manualmente, ele nasce com cadastro_status
-- 'incompleto'. Sem aprovação, TODA reserva falha com PROFILE_PENDING_APPROVAL
-- (trigger enforce_approved_driver_before_reservation).
--
-- Caminho correto (testa a regra de negócio de ponta a ponta):
--   1. Cliente preenche o cadastro no app -> status vira 'em_analise'
--   2. Admin aprova no painel administrativo (RPC admin_review_driver_profile)
--
-- Atalho apenas se precisar destravar o teste:
-- update public.perfis
-- set cadastro_status = 'aprovado', avaliado_em = now()
-- where id = (select id from auth.users where email = 'CLIENTE_TESTE_AQUI');
