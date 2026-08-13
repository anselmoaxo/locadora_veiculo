#!/bin/bash

# Script para Testar Migration de Auditoria
# Valida que tabelas e funções foram criadas corretamente

set -e

echo "=========================================="
echo "🧪 TESTANDO MIGRATION DE AUDITORIA"
echo "=========================================="
echo ""

# Variáveis
PROJECT_ID=${SUPABASE_PROJECT_ID:-"your-project-id"}
DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Conectando ao banco local...${NC}"
echo "URL: $DB_URL"
echo ""

# Teste 1: Verificar se tabelas foram criadas
echo -e "${YELLOW}[1/4] Verificando tabelas...${NC}"

TABLES=$(psql "$DB_URL" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('audit_log', 'function_logs');" -t 2>/dev/null || echo "")

if echo "$TABLES" | grep -q "audit_log"; then
    echo -e "${GREEN}✅ Tabela audit_log criada${NC}"
else
    echo -e "${RED}❌ Tabela audit_log não encontrada${NC}"
fi

if echo "$TABLES" | grep -q "function_logs"; then
    echo -e "${GREEN}✅ Tabela function_logs criada${NC}"
else
    echo -e "${RED}❌ Tabela function_logs não encontrada${NC}"
fi
echo ""

# Teste 2: Verificar índices
echo -e "${YELLOW}[2/4] Verificando índices...${NC}"

INDEXES=$(psql "$DB_URL" -c "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('audit_log', 'function_logs');" -t 2>/dev/null || echo "")

if echo "$INDEXES" | grep -q "audit_log_created_at_idx"; then
    echo -e "${GREEN}✅ Índice audit_log_created_at_idx criado${NC}"
else
    echo -e "${YELLOW}⚠️  Índice audit_log_created_at_idx não encontrado${NC}"
fi
echo ""

# Teste 3: Verificar funções
echo -e "${YELLOW}[3/4] Verificando funções...${NC}"

FUNCTIONS=$(psql "$DB_URL" -c "SELECT routinename FROM information_schema.routines WHERE routine_schema = 'private' AND routine_type = 'FUNCTION';" -t 2>/dev/null || echo "")

if echo "$FUNCTIONS" | grep -q "log_audit"; then
    echo -e "${GREEN}✅ Função log_audit criada${NC}"
else
    echo -e "${RED}❌ Função log_audit não encontrada${NC}"
fi

if echo "$FUNCTIONS" | grep -q "log_function_call"; then
    echo -e "${GREEN}✅ Função log_function_call criada${NC}"
else
    echo -e "${RED}❌ Função log_function_call não encontrada${NC}"
fi
echo ""

# Teste 4: Verificar triggers
echo -e "${YELLOW}[4/4] Verificando triggers...${NC}"

TRIGGERS=$(psql "$DB_URL" -c "SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public' AND event_object_table = 'reservas';" -t 2>/dev/null || echo "")

if echo "$TRIGGERS" | grep -q "audit_reservas_trigger"; then
    echo -e "${GREEN}✅ Trigger audit_reservas_trigger criado${NC}"
else
    echo -e "${YELLOW}⚠️  Trigger audit_reservas_trigger não encontrado${NC}"
fi
echo ""

echo "=========================================="
echo -e "${GREEN}🎉 TESTES COMPLETOS${NC}"
echo "=========================================="
echo ""
echo "Para testar as funções de logging:"
echo "1. Inserir um registro em audit_log:"
echo "   SELECT private.log_audit('test_table', 'INSERT', auth.uid(), gen_random_uuid());"
echo ""
echo "2. Consultar logs:"
echo "   SELECT * FROM public.audit_log ORDER BY created_at DESC LIMIT 5;"
echo ""
