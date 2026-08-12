import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TextField } from '../components/ui/TextField'
import { PasswordField } from '../components/ui/PasswordField'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'
import {
  brazilianStates,
  driverLicenseCategories,
  isFutureOrToday,
  isValidCpf,
  isValidDriverLicenseNumber,
  isValidPhone,
  onlyDigits,
} from '../utils/driverProfile'
import logoSrc from '../assets/logo.svg'
import googleIconSrc from '../assets/google-icon.svg'

type Tab = 'login' | 'register'

function safeRedirect(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('invalid login credentials')) return 'E-mail ou senha inválidos.'
  if (message.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (message.includes('user already registered')) return 'Este e-mail já possui cadastro.'
  if (message.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.'
  if (message.includes('provider is not enabled')) return 'O login com Google ainda não está habilitado.'
  return error instanceof Error ? error.message : 'Não foi possível concluir a autenticação.'
}

export function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    user,
    isPasswordRecovery,
    signIn,
    signUp,
    signInWithGoogle,
    sendPasswordReset,
    updatePassword,
  } = useAuth()

  const defaultTab: Tab = searchParams.get('tab') === 'register' ? 'register' : 'login'
  const redirect = safeRedirect(searchParams.get('redirect'))
  const [tab, setTab] = useState<Tab>(defaultTab)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regCpf, setRegCpf] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regCnh, setRegCnh] = useState('')
  const [regCnhCategory, setRegCnhCategory] = useState('B')
  const [regCnhExpiration, setRegCnhExpiration] = useState('')
  const [regCnhState, setRegCnhState] = useState('')
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [recoveryError, setRecoveryError] = useState('')

  useEffect(() => {
    if (!user || isPasswordRecovery) return
    const pendingRedirect = safeRedirect(sessionStorage.getItem('auth_redirect'))
    sessionStorage.removeItem('auth_redirect')
    navigate(pendingRedirect !== '/' ? pendingRedirect : redirect, { replace: true })
  }, [isPasswordRecovery, navigate, redirect, user])

  async function handleLogin(event: FormEvent) {
    event.preventDefault()
    setLoginError('')
    setNotice('')
    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Informe e-mail e senha.')
      return
    }

    setBusy(true)
    try {
      await signIn(loginEmail.trim(), loginPassword)
      navigate(redirect, { replace: true })
    } catch (error) {
      setLoginError(authErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault()
    setRegError('')
    setNotice('')
    if (!regName.trim()) {
      setRegError('Informe seu nome completo.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      setRegError('Informe um e-mail válido.')
      return
    }
    if (!isValidCpf(regCpf)) {
      setRegError('Informe um CPF válido.')
      return
    }
    if (!isValidPhone(regPhone)) {
      setRegError('Informe um telefone com DDD.')
      return
    }
    if (!isValidDriverLicenseNumber(regCnh)) {
      setRegError('Informe o número da CNH com 11 dígitos.')
      return
    }
    if (!regCnhState || !isFutureOrToday(regCnhExpiration)) {
      setRegError('Informe o estado emissor e uma CNH dentro da validade.')
      return
    }
    if (regPassword !== regConfirm) {
      setRegError('As senhas não coincidem.')
      return
    }
    if (regPassword.length < 6) {
      setRegError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setBusy(true)
    try {
      const session = await signUp({
        fullName: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        cpf: onlyDigits(regCpf),
        phone: onlyDigits(regPhone),
        cnhNumber: onlyDigits(regCnh),
        cnhCategory: regCnhCategory,
        cnhExpiration: regCnhExpiration,
        cnhState: regCnhState,
      })
      if (session) {
        navigate(redirect, { replace: true })
      } else {
        setRegSuccess(true)
      }
    } catch (error) {
      setRegError(authErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setLoginError('')
    setRegError('')
    sessionStorage.setItem('auth_redirect', redirect)
    try {
      await signInWithGoogle()
    } catch (error) {
      sessionStorage.removeItem('auth_redirect')
      const message = authErrorMessage(error)
      if (tab === 'login') setLoginError(message)
      else setRegError(message)
    }
  }

  async function handleForgotPassword() {
    setLoginError('')
    setNotice('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
      setLoginError('Informe seu e-mail para recuperar a senha.')
      return
    }

    setBusy(true)
    try {
      await sendPasswordReset(loginEmail.trim())
      setNotice('Enviamos as instruções de recuperação para o seu e-mail.')
    } catch (error) {
      setLoginError(authErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function handlePasswordUpdate(event: FormEvent) {
    event.preventDefault()
    setRecoveryError('')
    if (newPassword.length < 6) {
      setRecoveryError('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setRecoveryError('As senhas não coincidem.')
      return
    }

    setBusy(true)
    try {
      await updatePassword(newPassword)
      setNotice('Senha atualizada com sucesso.')
      navigate('/', { replace: true })
    } catch (error) {
      setRecoveryError(authErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-background flex flex-col">
      <header className="bg-white shadow-elevation-1 px-md py-md flex items-center justify-between">
        <button type="button" onClick={() => navigate('/')}>
          <img src={logoSrc} alt="Axo Locadoras" className="h-[52px] w-auto" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-xs font-inter text-body-md text-neutral-text hover:text-primary transition-colors cursor-pointer"
        >
          <span className="material-icons text-[20px]">arrow_back</span>
          Voltar ao site
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-md py-xl">
        <div className={`bg-white rounded-modal shadow-elevation-2 w-full ${tab === 'register' ? 'max-w-[720px]' : 'max-w-[440px]'} p-xl flex flex-col gap-xl`}>
          <div className="flex justify-center">
            <img src={logoSrc} alt="Axo Locadoras" className="h-[60px] w-auto" />
          </div>

          {isPasswordRecovery ? (
            <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-md" noValidate>
              <h1 className="font-exo font-bold text-heading-sm text-secondary">Criar nova senha</h1>
              <PasswordField
                id="new-password"
                label="Nova senha"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
              <PasswordField
                id="new-password-confirm"
                label="Confirmar nova senha"
                value={newPasswordConfirm}
                onChange={(event) => setNewPasswordConfirm(event.target.value)}
                autoComplete="new-password"
              />
              {recoveryError ? <ErrorMessage message={recoveryError} /> : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Atualizando...' : 'Atualizar senha'}
              </Button>
            </form>
          ) : (
            <>
              <div className="flex border-b border-neutral-divisor">
                <button
                  type="button"
                  className={`flex-1 py-sm font-inter text-body-md transition-colors border-b-2 -mb-px ${tab === 'login' ? 'border-primary text-primary font-bold' : 'border-transparent text-neutral-text hover:text-primary'}`}
                  onClick={() => { setTab('login'); setRegError(''); setNotice('') }}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  className={`flex-1 py-sm font-inter text-body-md transition-colors border-b-2 -mb-px ${tab === 'register' ? 'border-primary text-primary font-bold' : 'border-transparent text-neutral-text hover:text-primary'}`}
                  onClick={() => { setTab('register'); setLoginError(''); setNotice(''); setRegSuccess(false) }}
                >
                  Criar conta
                </button>
              </div>

              {notice ? <p className="font-inter text-body-sm text-feedback-positive">{notice}</p> : null}

              {tab === 'login' ? (
                <form onSubmit={handleLogin} className="flex flex-col gap-md" noValidate>
                  <TextField label="E-mail" type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} autoComplete="email" />
                  <PasswordField id="login-password" label="Senha" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} autoComplete="current-password" />
                  {loginError ? <ErrorMessage message={loginError} /> : null}
                  <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</Button>
                  <button type="button" onClick={() => void handleForgotPassword()} className="font-inter text-body-sm text-primary hover:underline text-center" disabled={busy}>Esqueci minha senha</button>
                  <Divider label="Ou entrar com" />
                  <Button type="button" variant="ghost-google" className="w-full" onClick={() => void handleGoogle()} disabled={busy} icon={<img src={googleIconSrc} alt="" className="w-5 h-5" />}>Google</Button>
                </form>
              ) : regSuccess ? (
                <div className="flex flex-col items-center gap-md text-center">
                  <span className="material-icons text-[64px] text-feedback-positive">check_circle</span>
                  <h2 className="font-exo font-bold text-heading-xs text-secondary">Conta criada com sucesso!</h2>
                  <p className="font-inter text-body-md text-neutral-text">Confirme o cadastro pelo e-mail enviado para <strong>{regEmail}</strong>.</p>
                  <Button className="w-full" onClick={() => setTab('login')}>Ir para o login</Button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="flex flex-col gap-md" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                    <TextField className="sm:col-span-2" label="Nome completo" value={regName} onChange={(event) => setRegName(event.target.value)} autoComplete="name" required />
                    <TextField label="CPF" inputMode="numeric" value={regCpf} onChange={(event) => setRegCpf(onlyDigits(event.target.value).slice(0, 11))} maxLength={11} required />
                    <TextField label="Telefone com DDD" type="tel" value={regPhone} onChange={(event) => setRegPhone(onlyDigits(event.target.value).slice(0, 13))} autoComplete="tel" required />
                    <TextField className="sm:col-span-2" label="E-mail" type="email" value={regEmail} onChange={(event) => setRegEmail(event.target.value)} autoComplete="email" required />
                    <TextField label="Número da CNH" inputMode="numeric" value={regCnh} onChange={(event) => setRegCnh(onlyDigits(event.target.value).slice(0, 11))} maxLength={11} required />
                    <SelectField label="Categoria da CNH" value={regCnhCategory} onChange={setRegCnhCategory}>
                      {driverLicenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </SelectField>
                    <TextField label="Validade da CNH" type="date" value={regCnhExpiration} onChange={(event) => setRegCnhExpiration(event.target.value)} min={new Date().toISOString().slice(0, 10)} required />
                    <SelectField label="Estado emissor" value={regCnhState} onChange={setRegCnhState}>
                      <option value="">Selecione</option>
                      {brazilianStates.map((state) => <option key={state} value={state}>{state}</option>)}
                    </SelectField>
                    <PasswordField id="register-password" label="Senha" value={regPassword} onChange={(event) => setRegPassword(event.target.value)} autoComplete="new-password" />
                    <PasswordField id="register-password-confirm" label="Confirmar senha" value={regConfirm} onChange={(event) => setRegConfirm(event.target.value)} autoComplete="new-password" />
                  </div>
                  <p className="font-inter text-body-sm text-neutral-text">Após confirmar o e-mail, seus dados serão enviados para análise do administrador antes da primeira reserva.</p>
                  {regError ? <ErrorMessage message={regError} /> : null}
                  <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Criando conta...' : 'Criar conta'}</Button>
                  <Divider label="Ou cadastrar com" />
                  <Button type="button" variant="ghost-google" className="w-full" onClick={() => void handleGoogle()} disabled={busy} icon={<img src={googleIconSrc} alt="" className="w-5 h-5" />}>Google</Button>
                </form>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return <div className="flex items-center gap-md"><hr className="flex-1 border-neutral-divisor" /><span className="font-inter text-body-sm text-neutral-text whitespace-nowrap">{label}</span><hr className="flex-1 border-neutral-divisor" /></div>
}

function ErrorMessage({ message }: { message: string }) {
  return <p role="alert" className="font-inter text-body-sm text-feedback-negative">{message}</p>
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = `register-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div className="flex flex-col gap-xxs">
      <label htmlFor={id} className="font-inter text-body-md text-neutral-text">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-neutral-text rounded-xs px-md py-sm bg-white font-inter text-body-md text-neutral-text outline-none focus:border-primary" required>
        {children}
      </select>
    </div>
  )
}
