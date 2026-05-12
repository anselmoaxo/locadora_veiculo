import { useState, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TextField } from '../components/ui/TextField'
import { PasswordField } from '../components/ui/PasswordField'
import { Button } from '../components/ui/Button'
import logoSrc from '../assets/logo.svg'
import googleIconSrc from '../assets/google-icon.svg'

type Tab = 'login' | 'register'

export function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultTab = searchParams.get('tab') === 'register' ? 'register' : 'login'
  const [tab, setTab] = useState<Tab>(defaultTab as Tab)

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register state
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState(false)

  function handleLogin(e: FormEvent) {
    e.preventDefault()
    // TODO: integrar com auth
    navigate('/')
  }

  function handleRegister(e: FormEvent) {
    e.preventDefault()
    setRegError('')
    if (regPassword !== regConfirm) {
      setRegError('As senhas não coincidem.')
      return
    }
    if (regPassword.length < 6) {
      setRegError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    // TODO: integrar com auth
    setRegSuccess(true)
  }

  return (
    <div className="min-h-screen bg-neutral-background flex flex-col">
      {/* Top bar */}
      <header className="bg-white shadow-elevation-1 px-md py-md flex items-center justify-between">
        <a href="/">
          <img src={logoSrc} alt="Hermex Locadora" className="h-[52px] w-auto" />
        </a>
        <button
          onClick={() => navigate(-1 as never)}
          className="flex items-center gap-xs font-inter text-body-md text-neutral-text hover:text-primary transition-colors cursor-pointer"
        >
          <span className="material-icons text-[20px]">arrow_back</span>
          Voltar ao site
        </button>
      </header>

      {/* Card central */}
      <main className="flex-1 flex items-center justify-center px-md py-xl">
        <div className="bg-white rounded-modal shadow-elevation-2 w-full max-w-[440px] p-xl flex flex-col gap-xl">
          {/* Logo */}
          <div className="flex justify-center">
            <img src={logoSrc} alt="Hermex Locadora" className="h-[60px] w-auto" />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-neutral-divisor">
            <button
              className={`flex-1 py-sm font-inter text-body-md transition-colors border-b-2 -mb-px ${
                tab === 'login'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-neutral-text hover:text-primary'
              }`}
              onClick={() => { setTab('login'); setRegError('') }}
            >
              Entrar
            </button>
            <button
              className={`flex-1 py-sm font-inter text-body-md transition-colors border-b-2 -mb-px ${
                tab === 'register'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-neutral-text hover:text-primary'
              }`}
              onClick={() => { setTab('register'); setRegError(''); setRegSuccess(false) }}
            >
              Criar conta
            </button>
          </div>

          {/* ── Login ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-md" noValidate>
              <TextField
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="email"
              />
              <PasswordField
                label="Senha"
                placeholder="Insira sua senha"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
              />

              <Button type="submit" variant="primary" className="w-full">
                Entrar
              </Button>

              <button
                type="button"
                className="font-inter text-body-sm text-primary hover:underline text-center"
              >
                Esqueci minha senha
              </button>

              <Divider label="Ou entrar com" />

              <Button
                type="button"
                variant="ghost-google"
                className="w-full"
                icon={<img src={googleIconSrc} alt="Google" className="w-5 h-5" />}
              >
                Google
              </Button>
            </form>
          )}

          {/* ── Cadastro ── */}
          {tab === 'register' && !regSuccess && (
            <form onSubmit={handleRegister} className="flex flex-col gap-md" noValidate>
              <TextField
                label="Nome completo"
                type="text"
                placeholder="Seu nome completo"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                autoComplete="name"
              />
              <TextField
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                autoComplete="email"
              />
              <PasswordField
                label="Senha"
                placeholder="Mínimo 6 caracteres"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                autoComplete="new-password"
              />
              <PasswordField
                label="Confirmar senha"
                placeholder="Repita a senha"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                autoComplete="new-password"
              />

              {regError && (
                <p className="font-inter text-body-sm text-feedback-negative">{regError}</p>
              )}

              <Button type="submit" variant="primary" className="w-full">
                Criar conta
              </Button>

              <Divider label="Ou cadastrar com" />

              <Button
                type="button"
                variant="ghost-google"
                className="w-full"
                icon={<img src={googleIconSrc} alt="Google" className="w-5 h-5" />}
              >
                Google
              </Button>
            </form>
          )}

          {/* ── Sucesso do cadastro ── */}
          {tab === 'register' && regSuccess && (
            <div className="flex flex-col items-center gap-md text-center">
              <span className="material-icons text-[64px] text-feedback-positive">
                check_circle
              </span>
              <h2 className="font-exo font-bold text-heading-xs text-secondary">
                Conta criada com sucesso!
              </h2>
              <p className="font-inter text-body-md text-neutral-text">
                Em breve você receberá um e-mail de confirmação em <strong>{regEmail}</strong>.
              </p>
              <Button variant="primary" className="w-full" onClick={() => setTab('login')}>
                Ir para o login
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-md">
      <hr className="flex-1 border-neutral-divisor" />
      <span className="font-inter text-body-sm text-neutral-text whitespace-nowrap">{label}</span>
      <hr className="flex-1 border-neutral-divisor" />
    </div>
  )
}
