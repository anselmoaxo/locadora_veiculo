# Auditoria de RLS - Axio Locadoras

**Data**: 2026-08-12
**Status**: ✅ Completo
**Responsável**: Análise Automática

## Resumo Executivo

O projeto implementa Row Level Security (RLS) em 5 tabelas críticas com policies bem definidas. A segurança segue o princípio do **menor privilégio** (deny by default, grant explicit). Encontrados alguns pontos de melhoria em logging e tratamento de erros.

---

## 1. MATRIZ DE ACESSO RLS

### 1.1 Tabela: `perfis` (Dados de usuário / motorista)

| Role | SELECT | INSERT | UPDATE | DELETE | Condição |
|------|--------|--------|--------|--------|----------|
| `anon` | ❌ | ❌ | ❌ | ❌ | Bloqueado |
| `authenticated` | ✅ | ✅ | ✅ | ❌ | Apenas dados do próprio usuário (`id = auth.uid()`) |
| `admin` (via service_role) | ✅ | ✅ | ✅ | ✅ | Acesso irrestrito |

**Policies atuais**:
- `perfis_select_own`: SELECT onde `id = auth.uid()`
- `perfis_update_own`: UPDATE onde `id = auth.uid()`
- Sem policy DELETE (está correto, usuários não devem auto-deletar)

**Análise**: ✅ Seguro. O delete fica para admin/trigger.

---

### 1.2 Tabela: `veiculos` (Catálogo de veículos)

| Role | SELECT | INSERT | UPDATE | DELETE | Condição |
|------|--------|--------|--------|--------|----------|
| `anon` | ✅ | ❌ | ❌ | ❌ | Apenas veículos `ativo = true` |
| `authenticated` | ✅ | ❌ | ❌ | ❌ | Apenas veículos `ativo = true` |
| `admin` | ✅ | ✅ | ✅ | ✅ | Acesso irrestrito |

**Policies atuais**:
- `veiculos_select_public`: SELECT onde `ativo = true`
- INSERT/UPDATE/DELETE bloqueados para anon/authenticated

**Análise**: ✅ Seguro. Apenas admins registram veículos.

---

### 1.3 Tabela: `reservas` (Reservas de veículos)

| Role | SELECT | INSERT | UPDATE | DELETE | Condição |
|------|--------|--------|--------|--------|----------|
| `anon` | ❌ | ❌ | ❌ | ❌ | Bloqueado |
| `authenticated` | ✅ | ❌ | ❌ | ❌ | Apenas reservas do próprio usuário (`usuario_id = auth.uid()`) |
| `admin` | ✅ | ✅ | ✅ | ✅ | Acesso irrestrito |

**Policies atuais**:
- `reservas_select_own`: SELECT onde `usuario_id = auth.uid()`
- INSERT/UPDATE/DELETE bloqueados (criação via função `reserve_car_atomic`)

**Análise**: ✅ Seguro. INSERT apenas via função security_definer.

**Nota**: Existe política adicional para admins acessar todas as reservas.

---

### 1.4 Tabela: `car_blocks` (Bloqueios temporais de veículos)

| Role | SELECT | INSERT | UPDATE | DELETE | Condição |
|------|--------|--------|--------|--------|----------|
| `anon` | ❌ | ❌ | ❌ | ❌ | Bloqueado |
| `authenticated` | ❌ | ❌ | ❌ | ❌ | Bloqueado |
| `admin` | ✅ | ✅ | ✅ | ✅ | Via service_role |

**Policies atuais**:
- Sem policies públicas
- `revoke all ... from public, anon, authenticated`
- Acesso apenas via `service_role` (admin)

**Análise**: ✅ Correto. Tabela crítica, apenas backend acessa.

---

### 1.5 Tabela: `idempotency_requests` (Deduplicação de requisições)

| Role | SELECT | INSERT | UPDATE | DELETE | Condição |
|------|--------|--------|--------|--------|----------|
| `anon` | ❌ | ❌ | ❌ | ❌ | Bloqueado |
| `authenticated` | ❌ | ❌ | ❌ | ❌ | Bloqueado |
| `admin` | ✅ | ✅ | ✅ | ✅ | Via service_role |

**Policies atuais**:
- Sem policies públicas
- `revoke all ... from public, anon, authenticated`

**Análise**: ✅ Correto. Tabela crítica, apenas backend acessa via função.

---

### 1.6 Tabela: `reservation_jobs` (Fila de reservas)

| Role | SELECT | INSERT | UPDATE | DELETE | Condição |
|------|--------|--------|--------|--------|----------|
| `anon` | ❌ | ❌ | ❌ | ❌ | Bloqueado |
| `authenticated` | ✅ | ❌ | ❌ | ❌ | Apenas jobs do próprio usuário (`user_id = auth.uid()`) |
| `admin` | ✅ | ✅ | ✅ | ✅ | Via service_role |

**Policies atuais**:
- `reservation_jobs_select_own`: SELECT onde `user_id = auth.uid()`
- INSERT/UPDATE/DELETE bloqueados (apenas via função)

**Análise**: ✅ Seguro. Permite usuário consultar status de suas reservas.

---

### 1.7 Tabela: `administradores` (Usuários com permissão de admin)

| Role | SELECT | INSERT | UPDATE | DELETE | Condição |
|------|--------|--------|--------|--------|----------|
| `anon` | ❌ | ❌ | ❌ | ❌ | Bloqueado |
| `authenticated` | ✅ | ❌ | ❌ | ❌ | Apenas para verificar se é admin |
| `admin` | ✅ | ✅ | ✅ | ✅ | Via service_role |

**Nota**: Papel implementado com função `is_vehicle_administrator()`

**Análise**: ✅ Seguro. Check de admin nativo via function.

---

## 2. FUNÇÕES CRÍTICAS (security_definer)

### 2.1 `private.reserve_car_atomic()`
- **Permissões**: `security definer` (roda como `postgres` user)
- **Validações**: ✅ Todas presentes (auth, input, lógica)
- **Idempotência**: ✅ Via `idempotency_requests`
- **Logs**: ⚠️ Apenas console.error em case de erro

### 2.2 `private.enqueue_reservation_job()`
- **Permissões**: `security definer`
- **Validações**: ✅ Completas (profile status, CNH expiration)
- **Logs**: ⚠️ Apenas console.error

### 2.3 `private.process_reservation_queue()`
- **Permissões**: `security definer`
- **Validações**: ✅ Completas
- **Logs**: ⚠️ Minimal

### 2.4 `private.submit_driver_profile()`
- **Permissões**: `security definer`
- **Validações**: ✅ Completas (CPF, CNH, format, UF)
- **Logs**: ⚠️ Minimal

### 2.5 `private.is_vehicle_administrator()`
- **Permissões**: `security definer`
- **Validações**: ✅ Auth check
- **Logs**: ✅ Nenhum necessário (função pura)

---

## 3. RESULTADOS DA AUDITORIA

### ✅ Pontos Fortes

1. **Deny by Default**: Todas as tabelas começam com `revoke all` e concedem explicitamente
2. **Menor Privilégio**: Usuários só veem seus próprios dados
3. **Atomicidade**: Operações sensíveis (reserva) em transações via `security_definer`
4. **Idempotência**: Implementada para deduplicação
5. **Constraints**: CHECK constraints em todos os domínios críticos
6. **Índices**: Bem colocados para performance
7. **GIST Exclusion**: Previne sobrescrita de reservas em nível de banco

### ⚠️ Melhorias Recomendadas

#### Prioridade: ALTA

1. **Auditoria de Operações Críticas**
   - Adicionar tabela `audit_log` com trigger para registrar:
     - Aprovação/reprovação de motoristas
     - Criação de reservas
     - Cancelamento de reservas
   - Capturar: `user_id`, `table_name`, `action`, `changed_data`, `timestamp`

2. **Logging Estruturado em Edge Functions**
   - Adicionar contexto de erro estruturado (JSON)
   - Incluir: `request_id`, `user_id`, `error_code`, `timestamp`, `function_name`
   - Persistir em tabela `function_logs` para análise posterior

3. **Tratamento de Timeout em Functions**
   - Edge Functions têm limite de 10s
   - Adicionar retry logic com exponential backoff
   - Timeout handler para não deixar requisição pendurada

#### Prioridade: MÉDIA

4. **Rate Limiting por Função**
   - Implementar contador de requisições por `user_id` + `function_name`
   - Tabela `rate_limit_tracker` com TTL
   - Rejeitar se exceder limite (ex: 10 reservas/min por usuário)

5. **Validação de Schema com Type Safety**
   - Usar `zod` ou `ajv` nas Functions para validação de input
   - Garantir tipagem forte de requests/responses

6. **Tratamento de Erro Granular**
   - Mapear error codes PostgreSQL → HTTP status codes
   - Retornar mensagens de erro específicas ao usuário (não expor SQL)
   - Exemplo: `23P01` (constraint violation) → `409 Conflict`

#### Prioridade: BAIXA

7. **GDPR/LGPD Compliance**
   - Função para exportar dados do usuário (JSON/CSV)
   - Função para deletar usuário + cascade de dados
   - Trigger para registrar deleção em log imutável

---

## 4. TESTES RECOMENDADOS

### Testes de RLS

```sql
-- Como anon user, tentar ler perfis de outro (deve falhar)
set role anon;
select * from public.perfis where id != auth.uid();
-- Resultado esperado: sem linhas ou erro de permissão

-- Como authenticated user, tentar atualizar perfil de outro (deve falhar)
set role authenticated;
set request.jwt.claims = '{"sub": "uuid-1"}';
update public.perfis set nome_completo = 'Hacker' where id = 'uuid-2';
-- Resultado esperado: erro 42501 (permission denied)

-- Como admin (service_role), atualizar perfil (deve funcionar)
set role service_role;
update public.perfis set cadastro_status = 'aprovado' where id = 'uuid-1';
-- Resultado esperado: 1 row affected
```

### Testes de Idempotência

```sql
-- Primeira requisição
select private.enqueue_reservation_job(...);
-- Segunda requisição com mesmo idempotency_key e payload_hash
select private.enqueue_reservation_job(...);
-- Resultado esperado: mesma resposta que a primeira
```

### Testes de Concorrência

- Múltiplas requisições simultâneas para reservar mesmo carro no mesmo horário
- Esperado: Uma sucede, outras falham com `CAR_UNAVAILABLE`

---

## 5. CHECKLIST DE CONFORMIDADE

- [x] Todas as tabelas públicas têm RLS habilitado
- [x] Deny by default implementado
- [x] Roles bem definidos (anon, authenticated, admin/service_role)
- [x] Operações críticas em security_definer functions
- [x] Idempotência implementada
- [ ] Auditoria estruturada (PENDENTE)
- [ ] Logging centralizado em Functions (PENDENTE)
- [ ] Rate limiting implementado (PENDENTE)
- [ ] Tratamento de timeout (PENDENTE)
- [ ] Validação de schema com type safety (PENDENTE)
- [ ] GDPR/LGPD functions (PENDENTE)

---

## 6. PRÓXIMOS PASSOS

1. **Esta semana**: Implementar auditoria estruturada + logging
2. **Próxima semana**: Adicionar rate limiting + timeout handling
3. **Depois**: GDPR/LGPD functions + testes de conformidade

