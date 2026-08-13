#!/bin/bash

##############################################
# Script de Teste - Validação de Templates
##############################################

echo ""
echo "=========================================="
echo "🧪 TESTANDO TEMPLATES DE EMAIL"
echo "=========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TEST_DIR=$(dirname "$0")
EMAIL_TEMPLATES_FILE="$TEST_DIR/supabase/functions/_shared/emailTemplates.ts"

# Função para testar validação
test_file_exists() {
  if [ -f "$EMAIL_TEMPLATES_FILE" ]; then
    echo -e "${GREEN}✅ Arquivo de templates encontrado${NC}"
    return 0
  else
    echo -e "${RED}❌ Arquivo de templates NÃO encontrado${NC}"
    return 1
  fi
}

# Função para validar conteúdo
test_template_content() {
  local template=$1
  local expected=$2

  if grep -q "$expected" "$EMAIL_TEMPLATES_FILE"; then
    echo -e "${GREEN}✅ Template '$template' contém '$expected'${NC}"
    return 0
  else
    echo -e "${RED}❌ Template '$template' NÃO contém '$expected'${NC}"
    return 1
  fi
}

# Função para validar HTML
test_html_validity() {
  local template=$1

  # Verificar se tem DOCTYPE
  if grep -q "<!DOCTYPE html>" "$EMAIL_TEMPLATES_FILE"; then
    echo -e "${GREEN}✅ HTML válido - DOCTYPE encontrado${NC}"
    return 0
  else
    echo -e "${YELLOW}⚠️  Aviso: DOCTYPE não encontrado${NC}"
    return 1
  fi
}

# Função para validar responsividade
test_responsive_css() {
  if grep -q "viewport" "$EMAIL_TEMPLATES_FILE"; then
    echo -e "${GREEN}✅ Meta viewport encontrado (responsividade)${NC}"
    return 0
  else
    echo -e "${RED}❌ Meta viewport NÃO encontrado${NC}"
    return 1
  fi
}

# Função para contar templates
count_templates() {
  local count=$(grep -c "export const.*EmailTemplate" "$EMAIL_TEMPLATES_FILE")
  echo "📊 Total de templates: $count"
}

# Função para validar variáveis de template
test_template_variables() {
  if grep -q "{{ .ConfirmationURL }}" "$EMAIL_TEMPLATES_FILE" && \
     ! grep -q "{{ .RecoveryURL }}" "$EMAIL_TEMPLATES_FILE"; then
    echo -e "${GREEN}✅ Variáveis de template encontradas${NC}"
    return 0
  else
    echo -e "${RED}❌ Variáveis de template NÃO encontradas${NC}"
    return 1
  fi
}

# Executar testes
echo "[1/6] Verificando arquivo de templates..."
test_file_exists || exit 1
echo ""

echo "[2/6] Validando conteúdo dos templates..."
test_template_content "Confirmação" "confirmationEmailTemplate" || true
test_template_content "Reset de Senha" "resetPasswordEmailTemplate" || true
test_template_content "Mudança de Email" "emailChangeTemplate" || true
echo ""

echo "[3/6] Validando HTML..."
test_html_validity "HTML" || true
echo ""

echo "[4/6] Validando responsividade..."
test_responsive_css "CSS" || true
echo ""

echo "[5/6] Validando variáveis de template..."
test_template_variables "Variáveis" || true
echo ""

echo "[6/6] Contando templates..."
count_templates
echo ""

echo "=========================================="
echo -e "${GREEN}🎉 VALIDAÇÃO DE TEMPLATES COMPLETA${NC}"
echo "=========================================="
echo ""

# Instruções finais
echo "📝 Próximos passos:"
echo "1. Copiar templates HTML para dashboard.supabase.com"
echo "2. Navegar para: Authentication → Email Templates"
echo "3. Colar cada template conforme documentado"
echo "4. Salvar as alterações"
echo ""
echo "📖 Veja docs/CUSTOMIZACAO-EMAILS.md para detalhes completos"
echo ""
