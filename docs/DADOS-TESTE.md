# 📝 DADOS DE TESTE - Axio Locadoras

Use estes dados para testar localmente antes de fazer deploy.

---

## 1. USER IDS (Substitua nos testes)

```
admin_user_id: "550e8400-e29b-41d4-a716-446655440001"
regular_user_id: "550e8400-e29b-41d4-a716-446655440002"
driver_user_id: "550e8400-e29b-41d4-a716-446655440003"
```

---

## 2. CAR IDS (Substitua nos testes)

```
car_1: "550e8400-e29b-41d4-a716-446655440010"
car_2: "550e8400-e29b-41d4-a716-446655440011"
car_3: "550e8400-e29b-41d4-a716-446655440012"
```

---

## 3. LOCATION IDS (Substitua nos testes)

```
location_sao_paulo: "550e8400-e29b-41d4-a716-446655440020"
location_rio_janeiro: "550e8400-e29b-41d4-a716-446655440021"
```

---

## 4. CENÁRIOS DE TESTE

### Cenário 1: Reserva Válida

```bash
curl -X POST http://localhost:54321/functions/v1/reserve-car \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-valid-$(date +%s)" \
  -d '{
    "car_id": "550e8400-e29b-41d4-a716-446655440010",
    "start_at": "2026-08-20T10:00:00Z",
    "end_at": "2026-08-21T10:00:00Z",
    "pickup_location_id": "550e8400-e29b-41d4-a716-446655440020",
    "dropoff_location_id": "550e8400-e29b-41d4-a716-446655440021",
    "notes": "Cliente preferencia: carro confortável"
  }'

# Resultado esperado (202 Accepted):
# {
#   "job_id": "uuid",
#   "status": "pending",
#   "reservation_id": null,
#   "error_code": null,
#   "request_id": "uuid"
# }
```

### Cenário 2: Reserva com Conflito (mesmo período)

```bash
# Primeiro, fazer a primeira reserva (Cenário 1)

# Depois, tentar reservar o mesmo carro no mesmo período:
curl -X POST http://localhost:54321/functions/v1/reserve-car \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-conflict-$(date +%s)" \
  -d '{
    "car_id": "550e8400-e29b-41d4-a716-446655440010",
    "start_at": "2026-08-20T10:00:00Z",
    "end_at": "2026-08-21T10:00:00Z"
  }'

# Resultado esperado (409 Conflict):
# {
#   "error": "CAR_UNAVAILABLE",
#   "message": "Veículo não está disponível para este período.",
#   "request_id": "uuid"
# }
```

### Cenário 3: Idempotência (mesma requisição 2x)

```bash
KEY="test-idempotent-abc123"

# Primeira requisição:
curl -X POST http://localhost:54321/functions/v1/reserve-car \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: $KEY" \
  -d '{
    "car_id": "550e8400-e29b-41d4-a716-446655440011",
    "start_at": "2026-08-25T10:00:00Z",
    "end_at": "2026-08-26T10:00:00Z"
  }'

# Segunda requisição (idêntica):
curl -X POST http://localhost:54321/functions/v1/reserve-car \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: $KEY" \
  -d '{
    "car_id": "550e8400-e29b-41d4-a716-446655440011",
    "start_at": "2026-08-25T10:00:00Z",
    "end_at": "2026-08-26T10:00:00Z"
  }'

# Resultado esperado: MESMA resposta nas duas chamadas
# Demonstra que a idempotência funciona
```

### Cenário 4: Período Muito Curto (menos de 1 hora)

```bash
curl -X POST http://localhost:54321/functions/v1/reserve-car \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-short-$(date +%s)" \
  -d '{
    "car_id": "550e8400-e29b-41d4-a716-446655440012",
    "start_at": "2026-08-20T10:00:00Z",
    "end_at": "2026-08-20T10:30:00Z"
  }'

# Resultado esperado (400 Bad Request):
# {
#   "error": "MINIMUM_DURATION_IS_ONE_HOUR",
#   "message": "Duração mínima deve ser de 1 hora."
# }
```

### Cenário 5: Data no Passado

```bash
curl -X POST http://localhost:54321/functions/v1/reserve-car \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-past-$(date +%s)" \
  -d '{
    "car_id": "550e8400-e29b-41d4-a716-446655440010",
    "start_at": "2026-08-01T10:00:00Z",
    "end_at": "2026-08-02T10:00:00Z"
  }'

# Resultado esperado (400 Bad Request):
# {
#   "error": "START_AT_IN_THE_PAST"
# }
```

### Cenário 6: Período Muito Longo (mais de 90 dias)

```bash
curl -X POST http://localhost:54321/functions/v1/reserve-car \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-long-$(date +%s)" \
  -d '{
    "car_id": "550e8400-e29b-41d4-a716-446655440010",
    "start_at": "2026-08-20T10:00:00Z",
    "end_at": "2026-12-01T10:00:00Z"
  }'

# Resultado esperado (400 Bad Request):
# {
#   "error": "MAXIMUM_DURATION_IS_90_DAYS"
# }
```

### Cenário 7: JSON Inválido

```bash
curl -X POST http://localhost:54321/functions/v1/reserve-car \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-invalid-$(date +%s)" \
  -d '{invalid json here}'

# Resultado esperado (400 Bad Request):
# {
#   "error": "INVALID_JSON"
# }
```

### Cenário 8: Logging e Rastreamento

```bash
# Fazer uma requisição com request-id customizado:
REQUEST_ID="trace-$(date +%s)"

curl -v -X POST http://localhost:54321/functions/v1/reserve-car \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-trace-$(date +%s)" \
  -H "x-request-id: $REQUEST_ID" \
  -d '{
    "car_id": "550e8400-e29b-41d4-a716-446655440010",
    "start_at": "2026-08-20T10:00:00Z",
    "end_at": "2026-08-21T10:00:00Z"
  }'

# Depois, verificar logs:
# SELECT * FROM public.function_logs 
# WHERE request_id = '$REQUEST_ID'
# ORDER BY created_at DESC;

# Resultado esperado: Vários registros de log com levels
# DEBUG, INFO, WARN, ou ERROR
```

---

## 5. QUERIES DE VALIDAÇÃO

### Verificar logs de auditoria

```sql
-- Todas as reservas criadas
SELECT 
  al.id,
  al.action,
  u.email,
  al.created_at
FROM public.audit_log al
LEFT JOIN auth.users u ON u.id = al.user_id
WHERE al.table_name = 'reservas'
ORDER BY al.created_at DESC
LIMIT 10;
```

### Verificar logs de função

```sql
-- Erros nas últimas 24 horas
SELECT 
  fl.id,
  fl.function_name,
  fl.level,
  fl.message,
  fl.error_code,
  fl.created_at
FROM public.function_logs fl
WHERE fl.created_at > now() - interval '24 hours'
  AND fl.level IN ('WARN', 'ERROR')
ORDER BY fl.created_at DESC
LIMIT 20;
```

### Verificar deduplicação por idempotência

```sql
-- Ver se mesma chave foi processada 2x
SELECT 
  user_id,
  idempotency_key,
  count(*) as attempts,
  min(created_at) as first_attempt,
  max(completed_at) as completed
FROM public.idempotency_requests
GROUP BY user_id, idempotency_key
HAVING count(*) > 1
ORDER BY created_at DESC;
```

### Verificar bloqueios de carro (car_blocks)

```sql
-- Ver quais carros estão bloqueados e por quanto tempo
SELECT 
  cb.car_id,
  v.nome as car_name,
  cb.start_at,
  cb.end_at,
  cb.status,
  (cb.end_at - cb.start_at) as duration
FROM public.car_blocks cb
LEFT JOIN public.veiculos v ON v.id = cb.car_id
WHERE cb.status = 'active'
ORDER BY cb.start_at
LIMIT 10;
```

---

## 6. SCRIPT DE TESTE COMPLETO (bash)

```bash
#!/bin/bash

# Configuração
JWT_TOKEN="seu-jwt-aqui"
BASE_URL="http://localhost:54321"

echo "🧪 Iniciando testes..."

# Teste 1: Sem autenticação
echo -e "\n[1/8] Teste: Sem autenticação"
curl -s -X POST "$BASE_URL/functions/v1/reserve-car" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-1" \
  -d '{}' | jq .error

# Teste 2: Idempotency inválida
echo -e "\n[2/8] Teste: Idempotency inválida"
curl -s -X POST "$BASE_URL/functions/v1/reserve-car" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: " \
  -d '{}' | jq .error

# Teste 3: Car ID faltando
echo -e "\n[3/8] Teste: Car ID faltando"
curl -s -X POST "$BASE_URL/functions/v1/reserve-car" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-3" \
  -d '{}' | jq .error

# Teste 4: Período inválido
echo -e "\n[4/8] Teste: Período muito curto"
curl -s -X POST "$BASE_URL/functions/v1/reserve-car" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-4" \
  -d '{
    "car_id": "550e8400-e29b-41d4-a716-446655440010",
    "start_at": "2026-08-20T10:00:00Z",
    "end_at": "2026-08-20T10:30:00Z"
  }' | jq .error

# Teste 5: Request válida
echo -e "\n[5/8] Teste: Request válida"
RESPONSE=$(curl -s -X POST "$BASE_URL/functions/v1/reserve-car" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-$(date +%s)" \
  -d '{
    "car_id": "550e8400-e29b-41d4-a716-446655440010",
    "start_at": "2026-08-20T10:00:00Z",
    "end_at": "2026-08-21T10:00:00Z"
  }')
echo "$RESPONSE" | jq .

echo -e "\n✅ Testes completos!"
```

---

**Referência:** `docs/TESTE-LOCAL-GUIA.md`
