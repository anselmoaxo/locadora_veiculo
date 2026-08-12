drop index if exists public.perfis_cpf_unique_idx;

create index if not exists perfis_avaliado_por_idx
  on public.perfis (avaliado_por)
  where avaliado_por is not null;
