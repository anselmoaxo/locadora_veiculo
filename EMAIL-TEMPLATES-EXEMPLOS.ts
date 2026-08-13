/**
 * Exemplo de Como Usar os Templates de Email
 *
 * Este arquivo mostra exemplos práticos de como integrar
 * os templates customizados em diferentes cenários.
 */

// ============================================
// Exemplo 1: Usar templates no contexto
// ============================================

// Em: src/contexts/AuthContext.tsx
import { emailTemplates } from '../_shared/emailTemplates'

export function AuthProvider({ children }: { children: ReactNode }) {
  const signUp = async (input: { fullName: string; email: string; password: string }) => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
        },
        // O Supabase automaticamente usa o template de confirmação
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    })

    if (error) throw error

    // Aqui você pode logar que um email de confirmação foi enviado
    console.log('Email de confirmação enviado para:', input.email)
    console.log('Template usado:', emailTemplates.confirmation.name)

    return data.session
  }

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // O Supabase automaticamente usa o template de recovery
      redirectTo: `${window.location.origin}/auth`,
    })

    if (error) throw error

    // Log do template utilizado
    console.log('Email de reset enviado para:', email)
    console.log('Template usado:', emailTemplates.recovery.name)
  }
}

// ============================================
// Exemplo 2: Edge Function customizada
// ============================================

// Em: supabase/functions/send-welcome-email/index.ts
import { emailTemplates } from '../_shared/emailTemplates.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface EmailRequest {
  userId: string
  email: string
  confirmationUrl: string
}

Deno.serve(async (req: Request) => {
  // Apenas POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { userId, email, confirmationUrl } = await req.json() as EmailRequest

  // Usar o template de confirmação
  const template = emailTemplates.confirmation

  console.log(`Sending confirmation email to ${email}`)
  console.log(`Template: ${template.name}`)
  console.log(`Subject: ${template.subject}`)

  // Aqui você integraria com um serviço de email como Resend, SendGrid, etc.
  // Exemplo com Resend:
  /*
  const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
  const response = await resend.emails.send({
    from: 'noreply@axiolocadoras.com.br',
    to: email,
    subject: template.subject,
    html: template.html,
  })
  */

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Email enviado com sucesso',
      template: template.name,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

// ============================================
// Exemplo 3: Validar templates em teste
// ============================================

// Em: __tests__/email-templates.test.ts
import { emailTemplates } from '../supabase/functions/_shared/emailTemplates'

describe('Email Templates', () => {
  test('Confirmação template tem variáveis corretas', () => {
    const { html, text, subject } = emailTemplates.confirmation

    // Verificar que template tem as variáveis necessárias
    expect(html).toContain('{{ .ConfirmationURL }}')
    expect(text).toContain('{{ .ConfirmationURL }}')
    expect(subject).toContain('email')
    expect(html).toContain('Bem-vindo')
  })

  test('Recovery template tem variáveis corretas', () => {
    const { html, text, subject } = emailTemplates.recovery

    expect(html).toContain('{{ .ConfirmationURL }}')
    expect(text).toContain('{{ .ConfirmationURL }}')
    expect(subject).toContain('Redefinir')
    expect(html).toContain('segurança')
  })

  test('Email Change template tem variáveis corretas', () => {
    const { html, text, subject } = emailTemplates.email_change

    expect(html).toContain('{{ .ConfirmationURL }}')
    expect(text).toContain('{{ .ConfirmationURL }}')
    expect(subject).toContain('email')
  })

  test('Templates são responsivos', () => {
    Object.values(emailTemplates).forEach(template => {
      expect(template.html).toContain('viewport')
      expect(template.html).toContain('<!DOCTYPE html>')
      expect(template.html).toContain('<meta')
    })
  })

  test('Templates têm versão em texto', () => {
    Object.values(emailTemplates).forEach(template => {
      expect(template.text).toBeTruthy()
      expect(template.text.length > 0).toBe(true)
    })
  })
})

// ============================================
// Exemplo 4: Renderizar template em preview
// ============================================

// Em: src/components/EmailPreview.tsx
import { emailTemplates } from '../_shared/emailTemplates'

export function EmailPreview({ templateName }: { templateName: keyof typeof emailTemplates }) {
  const template = emailTemplates[templateName]

  // Exemplo de URL para preview
  const previewUrl = templateName === 'recovery'
    ? 'https://app.example.com/auth/update-password'
    : 'https://app.example.com/auth/confirm'

  // Substituir variáveis para preview
  const previewHtml = template.html.replaceAll('{{ .ConfirmationURL }}', previewUrl)

  return (
    <div>
      <h2>{template.subject}</h2>
      <div style={{ backgroundColor: '#f5f5f5', padding: '20px' }}>
        <iframe
          srcDoc={previewHtml}
          style={{
            width: '100%',
            height: '600px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
          title={`Preview: ${template.name}`}
        />
      </div>
      <h3>Texto alternativo:</h3>
      <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
        {template.text}
      </pre>
    </div>
  )
}

// ============================================
// Exemplo 5: Customizar templates dinamicamente
// ============================================

// Em: src/utils/emailTemplateUtils.ts
import { emailTemplates, type EmailTemplate } from '../_shared/emailTemplates'

/**
 * Renderiza um template com dados dinâmicos
 */
export function renderEmailTemplate(
  templateName: keyof typeof emailTemplates,
  variables: Record<string, string>
): EmailTemplate {
  const template = emailTemplates[templateName]

  let html = template.html
  let text = template.text

  // Substituir todas as variáveis
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{ .${key} }}`
    html = html.replace(placeholder, value)
    text = text.replace(placeholder, value)
  })

  return {
    ...template,
    html,
    text,
  }
}

// Uso:
// const rendered = renderEmailTemplate('confirmation', {
//   ConfirmationURL: 'https://app.example.com/auth/confirm?token=xyz'
// })

// ============================================
// Exemplo 6: Enviar com Resend (via Edge Function)
// ============================================

// Em: supabase/functions/send-email-resend/index.ts
import { emailTemplates } from '../_shared/emailTemplates.ts'

interface SendEmailRequest {
  type: 'confirmation' | 'recovery' | 'email_change'
  email: string
  confirmationUrl?: string
  recoveryUrl?: string
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { type, email, confirmationUrl, recoveryUrl } = await req.json() as SendEmailRequest

  const template = emailTemplates[type as keyof typeof emailTemplates]

  // Preparar conteúdo
  let html = template.html
  let text = template.text

  if (confirmationUrl) {
    html = html.replace('{{ .ConfirmationURL }}', confirmationUrl)
    text = text.replace('{{ .ConfirmationURL }}', confirmationUrl)
  }

  if (recoveryUrl) {
    html = html.replace('{{ .ConfirmationURL }}', recoveryUrl)
    text = text.replace('{{ .ConfirmationURL }}', recoveryUrl)
  }

  try {
    // Usar a API do Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: 'noreply@axiolocadoras.com.br',
        to: email,
        subject: template.subject,
        html: html,
        text: text,
      }),
    })

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Erro ao enviar email:', error)
    return new Response(
      JSON.stringify({ error: 'Falha ao enviar email' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================
// Exemplo 7: Logger de emails (para auditoria)
// ============================================

// Em: src/utils/emailLogger.ts
import { emailTemplates } from '../_shared/emailTemplates'

export interface EmailLog {
  id: string
  type: keyof typeof emailTemplates
  recipient: string
  subject: string
  sentAt: Date
  status: 'pending' | 'sent' | 'failed'
  error?: string
}

const emailLogs: EmailLog[] = []

export async function logEmailSend(
  type: keyof typeof emailTemplates,
  recipient: string
) {
  const template = emailTemplates[type]
  const log: EmailLog = {
    id: crypto.randomUUID(),
    type,
    recipient,
    subject: template.subject,
    sentAt: new Date(),
    status: 'pending',
  }

  emailLogs.push(log)
  console.log(`[EMAIL LOG] ${type} sent to ${recipient}`)

  return log
}

export function getEmailLogs() {
  return emailLogs
}

// ============================================
// Exemplo 8: Adicionar a um arquivo de configuração
// ============================================

// Em: src/config/emailConfig.ts
import { emailTemplates } from '../_shared/emailTemplates'

export const EMAIL_CONFIG = {
  templates: emailTemplates,
  provider: process.env.VITE_EMAIL_PROVIDER || 'supabase', // supabase, resend, sendgrid
  defaultFrom: process.env.VITE_EMAIL_FROM || 'noreply@axiolocadoras.com.br',
  defaultReplyTo: process.env.VITE_EMAIL_REPLY_TO || 'support@axiolocadoras.com.br',
  retryAttempts: 3,
  retryDelay: 1000,
}

// Uso: import { EMAIL_CONFIG } from '@/config/emailConfig'

// ============================================
// Resumo de Uso
// ============================================

/*

RESUMO - Como usar os templates:

1. IMPORTAR:
   import { emailTemplates } from '../_shared/emailTemplates'

2. ACESSAR:
   - emailTemplates.confirmation
   - emailTemplates.recovery
   - emailTemplates.email_change

3. PROPRIEDADES:
   - template.name      // 'confirmation', 'recovery', etc.
   - template.subject   // Linha de assunto
   - template.html      // Versão HTML completa
   - template.text      // Versão texto puro

4. SUBSTITUIR VARIÁVEIS:
   - {{ .ConfirmationURL }}  // URL de confirmação
   - {{ .ConfirmationURL }}  // URL de confirmação ou recuperação

5. ENVIAR COM SUPABASE AUTH:
   - Automático! Supabase usa os templates do dashboard

6. ENVIAR COM SERVIÇO EXTERNO:
   - Use um Edge Function com Resend, SendGrid, etc.
   - Exemplo: supabase/functions/send-email-resend/

7. TESTAR:
   - bash test-email-templates.sh
   - Verificar no dashboard do Supabase

*/
