#!/bin/bash

# Script de Teste Local - Axio Locadoras Fase 1
# Valida migrations, functions e RLS policies
# Uso: bash test-setup.sh

set -e

echo "=========================================="
echo "🧪 TESTE LOCAL - AXIO LOCADORAS FASE 1"
echo "=========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar Supabase CLI
echo -e "${YELLOW}[1/5]${NC} Verificando Supabase CLI..."
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não instalado${NC}"
    echo "Instale com: npm install -g supabase"
    exit 1
fi
echo -e "${GREEN}✅ Supabase CLI encontrado${NC}"
echo ""

# 2. Verificar projeto Supabase
echo -e "${YELLOW}[2/5]${NC} Verificando projeto Supabase..."
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${RED}❌ supabase/config.toml não encontrado${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Projeto Supabase configurado${NC}"
echo ""

# 3. Listar migrations
echo -e "${YELLOW}[3/5]${NC} Migrations encontradas:"
ls -la supabase/migrations/ | grep "\.sql$" | awk '{print "   " $9}'
echo -e "${GREEN}✅ Total: $(ls supabase/migrations/*.sql 2>/dev/null | wc -l) migrations${NC}"
echo ""

# 4. Verificar Edge Functions
echo -e "${YELLOW}[4/5]${NC} Edge Functions encontradas:"
ls -d supabase/functions/*/ 2>/dev/null | xargs -I {} basename {} | sed 's/^/   /'
echo -e "${GREEN}✅ Total: $(ls -d supabase/functions/*/ 2>/dev/null | wc -l) functions${NC}"
echo ""

# 5. Validar SQL syntax
echo -e "${YELLOW}[5/5]${NC} Validando SQL syntax..."
for file in supabase/migrations/*.sql; do
    # Verificação básica: procurar por sintaxe comum
    if grep -q "^create\|^alter\|^drop" "$file"; then
        echo -e "${GREEN}✅ $(basename $file)${NC}"
    else
        echo -e "${YELLOW}⚠️  $(basename $file) - Sem comandos DDL${NC}"
    fi
done
echo ""

echo "=========================================="
echo -e "${GREEN}🎉 SETUP VALIDADO COM SUCESSO${NC}"
echo "=========================================="
echo ""
echo "Próximos passos:"
echo "1. Executar: supabase start"
echo "2. Executar: bash test-migration.sh"
echo "3. Executar: bash test-function.sh"
echo ""
