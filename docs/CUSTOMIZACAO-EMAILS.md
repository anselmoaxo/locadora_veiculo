# Personalização de Templates de Email - AXIO Locadoras

## 📧 Visão Geral

Este documento descreve como os templates de email foram customizados para a AXIO Locadoras. Os templates cobrem três cenários principais de autenticação:

1. **Confirmação de Email** - Enviado quando um novo usuário se registra
2. **Reset de Senha** - Enviado quando o usuário solicita recuperação de senha
3. **Confirmação de Alteração de Email** - Enviado quando o usuário altera seu email

## 🎨 Templates Criados

### Local dos Templates

Os templates estão centralizados em:
```
supabase/functions/_shared/emailTemplates.ts
```

Este arquivo exporta objetos TypeScript com as seguintes propriedades:
- `name` - Identificador do template
- `subject` - Linha de assunto do email
- `html` - Versão HTML do email
- `text` - Versão texto puro do email

### Estrutura Visual

Todos os templates seguem um design consistente:

```
┌─────────────────────────────────┐
│  [Header Azul com Logo AXIO]    │
├─────────────────────────────────┤
│                                 │
│  Título do Email                │
│  Descrição clara da ação        │
│                                 │
│  [Botão CTA Principal]          │
│                                 │
│  [Aviso ou Informação]          │
│                                 │
├─────────────────────────────────┤
│  Footer com Copyright           │
└─────────────────────────────────┘
```

## 🔧 Como Configurar no Supabase Dashboard

Embora os templates estejam definidos no código, o Supabase Auth permite customizar os templates via Dashboard. Para usar os templates customizados:

### Passo 1: Acessar Email Templates no Dashboard

1. Vá para [https://app.supabase.com](https://app.supabase.com)
2. Selecione seu projeto
3. Navegue para: **Authentication** → **Email Templates**

### Passo 2: Atualizar Cada Template

Para cada template (Confirmation, Recovery, Email Change):

1. Clique no template para editar
2. Copie o conteúdo HTML correspondente do arquivo `emailTemplates.ts`
3. Cole no editor de templates
4. Clique em "Save"

#### Template de Confirmação

- **Quando é enviado**: Após registro ou atualização de email
- **Variáveis disponíveis**: `{{ .ConfirmationURL }}`
- **Arquivo de referência**: `confirmationEmailTemplate` em `emailTemplates.ts`

#### Template de Reset de Senha

- **Quando é enviado**: Quando usuário solicita recuperação de senha
- **Variáveis disponíveis**: `{{ .ConfirmationURL }}`
- **Arquivo de referência**: `resetPasswordEmailTemplate` em `emailTemplates.ts`

#### Template de Email Change

- **Quando é enviado**: Quando usuário altera seu email
- **Variáveis disponíveis**: `{{ .ConfirmationURL }}`
- **Arquivo de referência**: `emailChangeTemplate` em `emailTemplates.ts`

## 📝 Customizações Realizadas

### Cores e Branding

- **Cor Primária**: `#1e40af` (Azul)
- **Cor Secundária**: `#d32f2f` (Vermelho para avisos)
- **Logo**: "AXIO" com texto "Locadoras"
- **Fonte**: Sistema padrão com fallback para Sans-serif

### Recursos de UX

1. **Responsividade**: Todos os templates são mobile-friendly
2. **Acessibilidade**: Uso adequado de hierarquia de títulos e contraste
3. **Clareza**: Texto em português com instruções claras
4. **Segurança**: Avisos sobre expiração de links
5. **Alternativa de Links**: Versão copiável dos URLs para usuários que não conseguem clicar

### Conteúdo por Template

#### 1. Confirmação de Email
- ✅ Boas-vindas calorosas
- ✅ Explicação clara da ação
- ✅ Aviso de que o link é temporário
- ✅ Instruções para ignorar se não for o usuário
- ✅ Link copiável como alternativa

#### 2. Reset de Senha
- 🔐 Ícone de segurança
- ✅ Contexto da solicitação
- ✅ Aviso de que o link é temporário
- ✅ Informação de segurança
- ✅ Link copiável como alternativa

#### 3. Confirmação de Email Change
- ✅ Confirmação clara da ação
- ✅ Instruções de confirmação
- ✅ Aviso se não foi solicitado pelo usuário
- ✅ Link copiável como alternativa

## 🔄 Fluxo de Autenticação

### Registro (Sign Up)

```
1. Usuário registra com email e senha
2. Supabase Auth envia email de confirmação
3. Template: confirmationEmailTemplate
4. Usuário clica no link
5. Email confirmado ✅
```

### Recuperação de Senha

```
1. Usuário clica "Esqueceu a senha?"
2. Insere seu email
3. Context chama: supabase.auth.resetPasswordForEmail(email)
4. Template: resetPasswordEmailTemplate
5. Usuário clica no link
6. Define nova senha ✅
```

### Atualização de Email

```
1. Usuário altera seu email na conta
2. Supabase Auth envia email de confirmação
3. Template: emailChangeTemplate
4. Usuário confirma no novo email
5. Email atualizado ✅
```

## 📱 Versões dos Emails

Cada template possui duas versões:

### Versão HTML
- Design completo com CSS
- Imagens e formatação
- Melhor experiência visual

### Versão Texto
- Plain text puro
- Sem formatação
- Para clientes de email que não suportam HTML
- Mantém todas as informações essenciais

## 🧪 Testando os Templates

### No Ambiente Local

1. Inicie o Supabase local:
```bash
supabase start
```

2. Execute o script de teste:
```bash
bash test-setup.sh
```

3. Registre um novo usuário na aplicação
4. Verifique se o email de confirmação foi recebido (no console do Supabase local)

### Na Produção

1. Faça deployment para o seu projeto Supabase
2. Execute testes de autenticação
3. Verifique o recebimento de emails
4. Valide o design em diferentes clientes de email (Gmail, Outlook, Apple Mail)

## 🚀 Próximos Passos

### Melhorias Futuras

1. **Tradução**: Adicionar suporte a múltiplos idiomas
2. **Dinâmica**: Incluir nome do usuário nos emails
3. **Marketing**: Adicionar links para social media ou FAQ
4. **Tracking**: Implementar pixel de rastreamento de abertura (opcional)
5. **Temas**: Suporte a modo claro/escuro automático

### Integração com Edge Functions

Para maior controle sobre o envio de emails, considere criar uma Edge Function customizada que:

1. Intercepte o evento de autenticação
2. Envie emails com lógica customizada via Resend, SendGrid, etc.
3. Registre eventos de envio para auditoria

Exemplo de caminho futuro:
```typescript
// supabase/functions/send-email/index.ts
export async function sendConfirmationEmail(email: string, confirmationUrl: string) {
  // Usar emailTemplates.confirmation
  // Enviar via serviço de email externo
}
```

## 📊 Arquivos Modificados

- ✅ `supabase/functions/_shared/emailTemplates.ts` - Criado com templates
- ✅ `docs/CUSTOMIZACAO-EMAILS.md` - Este arquivo

## ✅ Testes Realizados

- [x] Validação de sintaxe HTML
- [x] Responsividade mobile
- [x] Variáveis oficiais de template (`{{ .ConfirmationURL }}`)
- [x] Estrutura de fallback text
- [x] Compatibilidade com Supabase Auth

## 🔗 Referências

- [Supabase Email Templates Documentation](https://supabase.com/docs/guides/auth/auth-email)
- [MJML - Responsive Email Framework](https://mjml.io/)
- [Email Best Practices](https://www.campaignmonitor.com/resources/guides/email-best-practices/)

---

**Última atualização**: 2026-08-13
**Versão**: 1.0
**Status**: ✅ Produção Pronta
