/**
 * Templates de Email Customizados para AXIO Locadoras
 *
 * Este arquivo contém templates HTML para emails de confirmação,
 * reset de senha e outras comunicações da plataforma.
 */

export interface EmailTemplate {
  name: string
  subject: string
  html: string
  text: string
}

/**
 * Template de Confirmação de Email
 */
export const confirmationEmailTemplate: EmailTemplate = {
  name: 'confirmation',
  subject: 'Confirme seu email - AXIO Locadoras',
  html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu email</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .email-wrapper {
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
      letter-spacing: 2px;
    }
    .content {
      padding: 40px 30px;
      text-align: center;
    }
    .content h1 {
      color: #1e40af;
      font-size: 24px;
      margin-bottom: 15px;
      font-weight: 700;
    }
    .content p {
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    .cta-button {
      display: inline-block;
      background-color: #1e40af;
      color: white;
      padding: 14px 40px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      transition: background-color 0.3s;
      margin-bottom: 30px;
    }
    .cta-button:hover {
      background-color: #1e3a8a;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #eee;
    }
    .footer p {
      color: #999;
      font-size: 12px;
      margin: 5px 0;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 12px 15px;
      margin: 20px 0;
      border-radius: 4px;
      color: #856404;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="email-wrapper">
      <div class="header">
        <div class="logo">AXIO</div>
        <p>Locadoras</p>
      </div>

      <div class="content">
        <h1>Bem-vindo à AXIO Locadoras!</h1>
        <p>Obrigado por se registrar. Para completar sua inscrição, por favor confirme seu endereço de email clicando no botão abaixo:</p>

        <a href="{{ .ConfirmationURL }}" class="cta-button">Confirmar Email</a>

        <div class="warning">
          <strong>⏱️ Atenção:</strong> Este link é temporário. Se você não criou esta conta, ignore este email.
        </div>

        <p style="margin-top: 20px; color: #999; font-size: 13px;">
          Ou copie este link no seu navegador:<br>
          <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">{{ .ConfirmationURL }}</code>
        </p>
      </div>

      <div class="footer">
        <p><strong>AXIO Locadoras</strong></p>
        <p>© 2026 - Todos os direitos reservados</p>
        <p>Dúvidas? Entre em contato conosco pelo suporte</p>
      </div>
    </div>
  </div>
</body>
</html>`,
  text: `Bem-vindo à AXIO Locadoras!

Obrigado por se registrar. Para completar sua inscrição, por favor confirme seu endereço de email visitando o link abaixo:

{{ .ConfirmationURL }}

Este link é temporário.

Se você não criou esta conta, ignore este email.

---
AXIO Locadoras © 2026`,
}

/**
 * Template de Reset de Senha
 */
export const resetPasswordEmailTemplate: EmailTemplate = {
  name: 'recovery',
  subject: 'Redefinir sua senha - AXIO Locadoras',
  html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinir Senha</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .email-wrapper {
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
      letter-spacing: 2px;
    }
    .content {
      padding: 40px 30px;
      text-align: center;
    }
    .content h1 {
      color: #d32f2f;
      font-size: 24px;
      margin-bottom: 15px;
      font-weight: 700;
    }
    .content p {
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    .cta-button {
      display: inline-block;
      background-color: #d32f2f;
      color: white;
      padding: 14px 40px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      transition: background-color 0.3s;
      margin-bottom: 30px;
    }
    .cta-button:hover {
      background-color: #b71c1c;
    }
    .security-notice {
      background-color: #fff3cd;
      border-left: 4px solid #ff9800;
      padding: 12px 15px;
      margin: 20px 0;
      border-radius: 4px;
      color: #856404;
      font-size: 13px;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #eee;
    }
    .footer p {
      color: #999;
      font-size: 12px;
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="email-wrapper">
      <div class="header">
        <div class="logo">AXIO</div>
        <p>Locadoras</p>
      </div>

      <div class="content">
        <h1>🔐 Redefinir Senha</h1>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:</p>

        <a href="{{ .ConfirmationURL }}" class="cta-button">Redefinir Senha</a>

        <div class="security-notice">
          <strong>⚠️ Segurança:</strong> Este link é temporário. Se você não solicitou essa redefinição, ignore este email e não compartilhe o link.
        </div>

        <p style="margin-top: 20px; color: #999; font-size: 13px;">
          Ou copie este link no seu navegador:<br>
          <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px; word-break: break-all;">{{ .ConfirmationURL }}</code>
        </p>
      </div>

      <div class="footer">
        <p><strong>AXIO Locadoras</strong></p>
        <p>© 2026 - Todos os direitos reservados</p>
        <p>Precisa de ajuda? Entre em contato com nosso suporte</p>
      </div>
    </div>
  </div>
</body>
</html>`,
  text: `Redefinir Senha

Recebemos uma solicitação para redefinir a senha da sua conta. Visite o link abaixo para criar uma nova senha:

{{ .ConfirmationURL }}

Este link é temporário.

Se você não solicitou essa redefinição, ignore este email e não compartilhe o link.

---
AXIO Locadoras © 2026`,
}

/**
 * Template de Confirmação de Atualização de Email
 */
export const emailChangeTemplate: EmailTemplate = {
  name: 'email_change',
  subject: 'Confirmar novo email - AXIO Locadoras',
  html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmar novo email</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .email-wrapper {
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
      letter-spacing: 2px;
    }
    .content {
      padding: 40px 30px;
      text-align: center;
    }
    .content h1 {
      color: #1e40af;
      font-size: 24px;
      margin-bottom: 15px;
      font-weight: 700;
    }
    .content p {
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    .cta-button {
      display: inline-block;
      background-color: #1e40af;
      color: white;
      padding: 14px 40px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      transition: background-color 0.3s;
      margin-bottom: 30px;
    }
    .cta-button:hover {
      background-color: #1e3a8a;
    }
    .info-box {
      background-color: #e3f2fd;
      border-left: 4px solid #1e40af;
      padding: 12px 15px;
      margin: 20px 0;
      border-radius: 4px;
      color: #1565c0;
      font-size: 13px;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #eee;
    }
    .footer p {
      color: #999;
      font-size: 12px;
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="email-wrapper">
      <div class="header">
        <div class="logo">AXIO</div>
        <p>Locadoras</p>
      </div>

      <div class="content">
        <h1>Confirmar Novo Email</h1>
        <p>Você solicitou a alteração do email da sua conta. Clique no botão abaixo para confirmar o novo endereço:</p>

        <a href="{{ .ConfirmationURL }}" class="cta-button">Confirmar Email</a>

        <div class="info-box">
          <strong>ℹ️ Informação:</strong> Se você não solicitou essa alteração, ignore este email e sua conta permanecerá segura.
        </div>

        <p style="margin-top: 20px; color: #999; font-size: 13px;">
          Ou copie este link no seu navegador:<br>
          <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px; word-break: break-all;">{{ .ConfirmationURL }}</code>
        </p>
      </div>

      <div class="footer">
        <p><strong>AXIO Locadoras</strong></p>
        <p>© 2026 - Todos os direitos reservados</p>
        <p>Dúvidas sobre sua conta? Entre em contato com nosso suporte</p>
      </div>
    </div>
  </div>
</body>
</html>`,
  text: `Confirmar Novo Email

Você solicitou a alteração do email da sua conta. Visite o link abaixo para confirmar o novo endereço:

{{ .ConfirmationURL }}

Se você não solicitou essa alteração, ignore este email.

---
AXIO Locadoras © 2026`,
}

/**
 * Exportar todos os templates em um objeto para fácil acesso
 */
export const emailTemplates = {
  confirmation: confirmationEmailTemplate,
  recovery: resetPasswordEmailTemplate,
  email_change: emailChangeTemplate,
}
