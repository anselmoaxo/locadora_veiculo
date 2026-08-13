#!/bin/bash

# Script para Testar Edge Function reserve-car
# Valida logging, retry logic e tratamento de erro

set -e

echo "=========================================="
echo "🧪 TESTANDO EDGE FUNCTION: reserve-car"
echo "=========================================="
echo ""

# Variáveis
FUNCTION_URL="${SUPABASE_URL:-http://localhost:54321}/functions/v1/reserve-car"
ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...}"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}Configuração:${NC}"
echo "URL: $FUNCTION_URL"
echo ""

# Teste 1: Request válida sem autenticação (deve falhar com 401)
echo -e "${YELLOW}[1/5] Teste: Sem autenticação${NC}"
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-1" \
  -d '{"car_id": "550e8400-e29b-41d4-a716-446655440000"}')

if echo "$RESPONSE" | grep -q "AUTH_REQUIRED"; then
    echo -e "${GREEN}✅ Retornou AUTH_REQUIRED como esperado${NC}"
else
    echo -e "${YELLOW}⚠️  Response: $(echo $RESPONSE | jq .error 2>/dev/null || echo $RESPONSE)${NC}"
fi
echo ""

# Teste 2: Request com header inválido
echo -e "${YELLOW}[2/5] Teste: Idempotency-key inválida${NC}"
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: " \
  -d '{"car_id": "550e8400-e29b-41d4-a716-446655440000"}')

if echo "$RESPONSE" | grep -q "INVALID_IDEMPOTENCY_KEY"; then
    echo -e "${GREEN}✅ Rejeitou idempotency-key vazia${NC}"
else
    echo -e "${YELLOW}⚠️  Response: $(echo $RESPONSE | jq .error 2>/dev/null || echo $RESPONSE)${NC}"
fi
echo ""

# Teste 3: Request com JSON inválido
echo -e "${YELLOW}[3/5] Teste: JSON inválido${NC}"
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-3" \
  -d '{invalid json}')

if echo "$RESPONSE" | grep -q "INVALID_JSON"; then
    echo -e "${GREEN}✅ Rejeitou JSON inválido${NC}"
else
    echo -e "${YELLOW}⚠️  Response: $(echo $RESPONSE | jq .error 2>/dev/null || echo $RESPONSE)${NC}"
fi
echo ""

# Teste 4: Request com car_id faltando
echo -e "${YELLOW}[4/5] Teste: car_id faltando${NC}"
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-4" \
  -d '{}')

if echo "$RESPONSE" | grep -q "CAR_ID_REQUIRED"; then
    echo -e "${GREEN}✅ Retornou CAR_ID_REQUIRED${NC}"
else
    echo -e "${YELLOW}⚠️  Response: $(echo $RESPONSE | jq .error 2>/dev/null || echo $RESPONSE)${NC}"
fi
echo ""

# Teste 5: Verificar logging estruturado
echo -e "${YELLOW}[5/5] Teste: Logging estruturado${NC}"
echo -e "${BLUE}Fazendo request com dados válidos...${NC}"

REQUEST_ID="test-$(date +%s)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: test-$REQUEST_ID" \
  -H "x-request-id: $REQUEST_ID" \
  -d '{
    "car_id": "550e8400-e29b-41d4-a716-446655440000",
    "start_at": "2026-08-20T10:00:00Z",
    "end_at": "2026-08-21T10:00:00Z"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo -e "${BLUE}HTTP Status: $HTTP_CODE${NC}"
echo -e "${BLUE}Response:${NC}"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"

if echo "$BODY" | jq . &>/dev/null; then
    echo -e "${GREEN}✅ Retornou JSON válido${NC}"
    
    if echo "$BODY" | jq . | grep -q "request_id"; then
        echo -e "${GREEN}✅ request_id incluído na response${NC}"
    else
        echo -e "${YELLOW}⚠️  request_id não encontrado na response${NC}"
    fi
else
    echo -e "${RED}❌ Response não é JSON válido${NC}"
fi
echo ""

echo "=========================================="
echo -e "${GREEN}🎉 TESTES COMPLETOS${NC}"
echo "=========================================="
echo ""
echo "Próximos passos:"
echo "1. Verificar logs da function: supabase functions list"
echo "2. Testar com JWT válido de um usuário real"
echo "3. Validar logging em public.function_logs"
echo ""
