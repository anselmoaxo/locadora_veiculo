# Status atual do projeto

Atualizado em 13 de agosto de 2026.

## Concluído e verificado

- Build de produção do frontend aprovado.
- Migration de auditoria aplicada no projeto Supabase `Api Principal`.
- Tabelas `audit_log` e `function_logs` com RLS habilitada e sem acesso direto
  para `anon` ou `authenticated`.
- View direta de auditoria removida; leitura administrativa permanece restrita
  às RPCs que verificam o papel de administrador.
- Rate limiting atômico criado no schema `private`, com uma RPC pública
  `security invoker` executável apenas por `service_role`.
- Teste remoto do rate limiter aprovado: duas chamadas permitidas e a terceira
  bloqueada dentro da mesma janela.
- Edge Functions `reserve-car`, `reserve-status` e `process-reserve-queue`
  implantadas com `verify_jwt = true`, logger compartilhado e rate limiting.
- Logger compartilhado e rate limiting atômico aplicados e implantados em
  `cadastrar-veiculo` (v5) e `alterar-veiculo` (v2).
- ESLint configurado e aprovado; build de produção aprovado e `npm audit`
  concluído com zero vulnerabilidades conhecidas.
- Limpeza dos contadores de rate limiting agendada diariamente pelo `pg_cron`,
  com retenção operacional de dois dias.
- Templates de autenticação corrigidos para usar as variáveis oficiais do
  Supabase; validação local dos três templates aprovada.

## Pendente para encerrar a Fase 1

- Executar smoke tests autenticados das cinco Edge Functions e confirmar a
  persistência de erros/alertas em `function_logs`.
- Testar as RPCs administrativas de logs com um administrador e com um usuário
  comum, comprovando permitido e negado respectivamente.
- Executar o fluxo de homologação completo de cadastro, aprovação, busca,
  reserva e consulta do status.
- Aplicar os templates de e-mail no Dashboard e testar entrega real. Projetos
  Free criados após 3 de junho de 2026 precisam de SMTP próprio para permitir
  essa personalização.

## Advisors

- Os avisos `RLS Enabled No Policy` nas tabelas de log e rate limiting são
  esperados: o modelo adotado é negar acesso direto e operar por funções
  restritas ou `service_role`.
- As duas RPCs administrativas são `security definer` e aparecem como aviso
  porque são chamáveis por `authenticated`; ambas executam
  `private.assert_vehicle_administrator()` antes de ler dados. Ainda assim,
  convém migrá-las futuramente para wrappers `security invoker` com a
  implementação privilegiada mantida no schema `private`.
- Índices recém-criados aparecem como não utilizados porque ainda não houve
  carga representativa. Não devem ser removidos antes da homologação.

## Segurança operacional

O script `scripts/reset-homologacao.sql` permanece bloqueado por um guard
explícito. Ele não deve ser liberado sem confirmar ambiente, backup e ausência
de usuários ativos.

O script agora possui guards independentes para a limpeza de usuários e para a
redução da frota. A seleção considera somente veículos ativos, usa desempate
determinístico, exige exatamente cinco veículos e limpa logs/contadores que
possam reter dados pessoais de homologação.
