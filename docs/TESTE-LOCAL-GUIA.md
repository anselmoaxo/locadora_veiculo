# 🧪 GUIA DE TESTES LOCAL - Axio Locadoras Fase 1

**Status:** Pronto para executar testes antes de deploy em produção  
**Tempo estimado:** 30-45 minutos  
**Pré-requisitos:** Supabase CLI instalado, projeto Supabase configurado

---

## 📋 ROTEIRO DE TESTES

### PASSO 1: Setup Local (5 minutos)

```bash
# 1.1 Navegar até o projeto
cd C:\projetos\6309-Supabase

# 1.2 Instalar Supabase CLI (se não tiver)
npm install -g supabase

# 1.3 Verificar instalação
supabase --version

# 1.4 Login (se não estiver logado)
supabase login

# 1.5 Link ao projeto (usar seu project-id do Supabase)
supabase link --project-id seu-project-id-aqui
```

**Resultado esperado:** Conexão estabelecida com Supabase

---

### PASSO 2: Validar Setup (5 minutos)

```bash
# 2.1 Executar script de validação
bash test-setup.sh

# Resultado esperado:
# ✅ Supabase CLI encontrado
# ✅ Projeto Supabase configurado
# ✅ Total: 9 migrations
# ✅ Total: 5 functions
# ✅ SQL syntax validado
```

---

### PASSO 3: Testar Migration de Auditoria (10 minutos)

#### Opção A: Ambiente Local

```bash
# 3.1 Iniciar Supabase localmente
supabase start

# Aguardar até ver:
# Local development server is running at http://localhost:54323

# 3.2 Aplicar migrations localmente
supabase db pull

# 3.3 Verificar tabelas criadas
psql postgresql://postgres:postgres@localhost:54322/postgres -c \
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' \
   AND tablename IN ('audit_log', 'function_logs');"

# Resultado esperado:
#  tablename
# -----------
#  audit_log
#  function_logs
```

#### Opção B: Ambiente Staging/Prod do Supabase

```bash
# 3.1 Fazer deploy no Supabase (automático ao fazer git push)
git add supabase/migrations/20260813000000_*.sql
git commit -m "add: audit logging infrastructure"
git push

# 3.2 Verificar no Supabase Dashboard:
# - Ir para: SQL Editor
# - Executar:
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
AND tablename IN ('audit_log', 'function_logs');

# Resultado esperado: 2 linhas
```

---

### PASSO 4: Testar Edge Function (15 minutos)

#### Teste 4.1: Validação de Input

```bash
# Teste: Sem autenticação (deve retornar 401)
curl -X POST http://localhost:54321/functions/v1/reserve-car \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-1" \
  -d '{"car_id": "550e8400-e29b-41d4-a716-446655440000"}'

# Resultado esperado:
# {
#   "error": "AUTH_REQUIRED"
# }
```

#### Teste 4.2: Idempotency-Key Inválida

```bash
# Teste: Idempotency-key vazia (deve retornar 400)
curl -X POST http://localhost:54321/functions/v1/reserve-car \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: " \
  -d '{"car_id": "550e8400-e29b-41d4-a716-446655440000"}'

# Resultado esperado:
# {
#   "error": "INVALID_IDEMPOTENCY_KEY"
# }
```

#### Teste 4.3: Logging Estruturado

```bash
# Teste: Fazer request válida (para ver logging)
# Substituir $JWT_TOKEN pelo token real do user

curl -X POST http://localhost:54321/functions/v1/reserve-car \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-$(date +%s)" \
  -H "x-request-id: req-$(date +%s)" \
  -d '{
    "car_id": "550e8400-e29b-41d4-a716-446655440000",
    "start_at": "2026-08-20T10:00:00Z",
    "end_at": "2026-08-21T10:00:00Z"
  }'

# Resultado esperado:
# {
#   "job_id": "uuid-aqui",
#   "status": "pending",
#   "reservation_id": null,
#   "error_code": null,
#   "request_id": "req-timestamp"
# }
```

#### Teste 4.4: Verificar Logging

```bash
# Consultar logs estruturados
# No Supabase Dashboard SQL Editor:

SELECT 
  id,
  function_name,
  level,
  message,
  created_at
FROM public.function_logs
ORDER BY created_at DESC
LIMIT 10;

# Resultado esperado:
# id | function_name | level | message | created_at
# ---|---------------|-------|---------|----------
# uuid | reserve-car | DEBUG | Request received | timestamp
# uuid | reserve-car | INFO | User authenticated | timestamp
# ...
```

---

### PASSO 5: Testar Auditoria (10 minutos)

#### Teste 5.1: Registrar Auditoria

```bash
# 5.1.1 Criar uma reserva (via UI ou API)
# Isso deve disparar o trigger automaticamente

# 5.1.2 Verificar se foi registrada em audit_log
SELECT 
  table_name,
  action,
  user_id,
  record_id,
  created_at
FROM public.audit_log
ORDER BY created_at DESC
LIMIT 5;

# Resultado esperado:
# table_name | action | user_id | record_id | created_at
# -----------|--------|---------|-----------|----------
# reservas   | INSERT | uuid    | uuid      | timestamp
```

#### Teste 5.2: Funções de Admin

```bash
# 5.2.1 Listar logs de auditoria (como admin)
SELECT * FROM public.admin_get_audit_logs(
  p_limit => 10,
  p_error_only => false
);

# 5.2.2 Listar logs de function (como admin)
SELECT * FROM public.admin_get_function_logs(
  p_limit => 10,
  p_level => null
);
```

---

## 🔍 CHECKLIST DE TESTES

Marque cada um ao completar:

### Infraestrutura
- [ ] Supabase CLI instalado
- [ ] Projeto linkado com sucesso
- [ ] `test-setup.sh` passa sem erros

### Migrations
- [ ] Tabela `audit_log` criada
- [ ] Tabela `function_logs` criada
- [ ] Índices criados com sucesso
- [ ] Trigger `audit_reservas_trigger` ativo

### Edge Function
- [ ] Retorna 401 sem autenticação
- [ ] Retorna 400 com input inválido
- [ ] Retorna JSON com `request_id`
- [ ] Logging estruturado funciona
- [ ] Retry logic funciona (testar simulando timeout)

### Auditoria
- [ ] Trigger dispara ao criar reserva
- [ ] `audit_log` registra INSERT
- [ ] `admin_get_audit_logs()` retorna dados
- [ ] `admin_get_function_logs()` retorna dados

---

## ⚠️ PROBLEMAS COMUNS E SOLUÇÕES

### Problema: "Supabase CLI not found"
**Solução:**
```bash
npm install -g supabase
supabase --version
```

### Problema: "Cannot connect to database"
**Solução:**
```bash
# Verificar se Supabase está rodando
supabase start

# Aguardar conexão (pode levar 2-3 min)
```

### Problema: "JWT token inválido"
**Solução:**
```bash
# Gerar token válido no Supabase Dashboard:
# 1. Ir para: Authentication → Users
# 2. Criar usuário de teste
# 3. Copiar seu JWT token
# 4. Usar em curl com: -H "Authorization: Bearer $TOKEN"
```

### Problema: "Migration não foi aplicada"
**Solução:**
```bash
# Force rebuild
supabase db reset

# Ou aplique manualmente
supabase db push
```

### Problema: "Function returns 500 error"
**Solução:**
```bash
# Verificar logs
supabase functions list

# Ver erro detalhado em Supabase Dashboard:
# Functions → reserve-car → Logs
```

---

## 📊 RESULTADO ESPERADO

Após completar todos os testes:

```
✅ Migrations aplicadas
✅ Tabelas de auditoria criadas
✅ Triggers funcionando
✅ Edge Function respondendo
✅ Logging estruturado em JSON
✅ Retry logic testado
✅ RLS policies funcionando
✅ Admin functions acessíveis
```

**Status:** 🟢 Pronto para Deploy em Produção

---

## 🚀 PRÓXIMAS AÇÕES

### Se tudo passou ✅
1. Fazer git commit
2. Fazer git push (deploy automático)
3. Testar em staging/produção
4. Monitorar logs

### Se algo falhou ❌
1. Consultar logs detalhados
2. Comparar com `FASE-1-IMPLEMENTATION-GUIDE.md`
3. Abrir issue com stack trace completo

---

## 📞 DEBUGGING

**Ver logs de função:**
```bash
supabase functions list
supabase functions logs reserve-car
```

**Ver logs de banco:**
```bash
# Supabase Dashboard → Logs
# Filtrar por função ou erro
```

**Resetar ambiente local:**
```bash
supabase stop
supabase start --fresh
supabase db reset
```

---

**Tempo total de testes:** 30-45 minutos  
**Próximo passo:** Se tudo passar, fazer deploy em produção  
**Referência:** `docs/FASE-1-IMPLEMENTATION-GUIDE.md`
