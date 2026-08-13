import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { TextField } from '../components/ui/TextField'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'
import { submitDriverProfile, type DriverProfileInput, type DriverProfileStatus } from '../services/driverProfiles'
import {
  brazilianStates,
  driverLicenseCategories,
  isFutureOrToday,
  isValidCpf,
  isValidDriverLicenseNumber,
  isValidPhone,
  onlyDigits,
} from '../utils/driverProfile'
import { maskCpf, maskDriverLicense, maskPhone } from '../utils/inputMasks'

const initialForm: DriverProfileInput = {
  fullName: '',
  cpf: '',
  phone: '',
  cnhNumber: '',
  cnhCategory: 'B',
  cnhExpiration: '',
  cnhState: '',
}

const statusContent: Record<DriverProfileStatus, { label: string; description: string; className: string }> = {
  incompleto: {
    label: 'Cadastro incompleto',
    description: 'Preencha seus dados e a CNH para solicitar a análise.',
    className: 'border-feedback-warning text-feedback-warning',
  },
  em_analise: {
    label: 'Em análise',
    description: 'Seus dados foram enviados e aguardam a avaliação do administrador.',
    className: 'border-primary text-primary',
  },
  aprovado: {
    label: 'Cadastro aprovado',
    description: 'Você pode concluir reservas enquanto sua CNH estiver válida.',
    className: 'border-feedback-positive text-feedback-positive',
  },
  reprovado: {
    label: 'Cadastro reprovado',
    description: 'Revise os dados abaixo e envie novamente para análise.',
    className: 'border-feedback-negative text-feedback-negative',
  },
}

export function DriverProfilePage() {
  const [searchParams] = useSearchParams()
  const { user, profile, refreshProfile } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    refreshProfile().catch(() => setError('Não foi possível atualizar seu cadastro.'))
  }, [refreshProfile])

  useEffect(() => {
    if (!profile) return
    setForm({
      fullName: profile.nome_completo ?? '',
      cpf: maskCpf(profile.cpf ?? ''),
      phone: maskPhone(profile.telefone ?? ''),
      cnhNumber: maskDriverLicense(profile.cnh_numero ?? ''),
      cnhCategory: profile.cnh_categoria ?? 'B',
      cnhExpiration: profile.cnh_validade ?? '',
      cnhState: profile.cnh_uf ?? '',
    })
  }, [profile])

  function update<K extends keyof DriverProfileInput>(field: K, value: DriverProfileInput[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setSuccess('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (form.fullName.trim().length < 3) return setError('Informe seu nome completo.')
    if (!isValidCpf(form.cpf)) return setError('Informe um CPF válido.')
    if (!isValidPhone(form.phone)) return setError('Informe um telefone com DDD.')
    if (!isValidDriverLicenseNumber(form.cnhNumber)) return setError('Informe o número da CNH com 11 dígitos.')
    if (!isFutureOrToday(form.cnhExpiration)) return setError('A CNH está vencida ou a validade é inválida.')
    if (!form.cnhState) return setError('Informe o estado emissor da CNH.')

    setBusy(true)
    try {
      await submitDriverProfile({
        ...form,
        fullName: form.fullName.trim(),
        cpf: onlyDigits(form.cpf),
        phone: onlyDigits(form.phone),
        cnhNumber: onlyDigits(form.cnhNumber),
      })
      await refreshProfile()
      setSuccess('Dados enviados. Seu cadastro está em análise.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o cadastro.')
    } finally {
      setBusy(false)
    }
  }

  const status = profile?.cadastro_status ?? 'incompleto'
  const content = statusContent[status]
  const reservationReason = searchParams.get('reason') === 'reservation'

  return (
    <div className="min-h-screen flex flex-col bg-neutral-background">
      <Header />
      <main className="flex-1 max-w-[960px] mx-auto w-full px-md md:px-lg py-xl flex flex-col gap-lg">
        <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Meu cadastro' }]} />

        {reservationReason && status !== 'aprovado' ? (
          <section className="bg-white border-l-4 border-primary rounded-xs shadow-elevation-1 p-lg" role="status">
            <h1 className="font-exo font-bold text-heading-sm text-secondary">Etapa 2 de 2: complete seu perfil</h1>
            <p className="font-inter text-body-md text-neutral-text mt-xs">Para reservar um carro, precisamos validar seu CPF, telefone e dados da CNH. Depois do envio, o cadastro ficará em análise.</p>
          </section>
        ) : null}

        <section className={`bg-white border-l-4 ${content.className} rounded-xs shadow-elevation-1 p-lg`} aria-live="polite">
          <h1 className="font-exo font-bold text-heading-sm text-secondary">{content.label}</h1>
          <p className="font-inter text-body-md text-neutral-text mt-xs">{content.description}</p>
          {profile?.avaliacao_observacao ? (
            <p className="font-inter text-body-sm text-neutral-text mt-sm"><strong>Observação:</strong> {profile.avaliacao_observacao}</p>
          ) : null}
        </section>

        <form onSubmit={submit} className="bg-white rounded-modal shadow-elevation-1 p-lg flex flex-col gap-lg" noValidate>
          <div>
            <h2 className="font-exo font-bold text-heading-xs text-secondary">Dados do condutor</h2>
            <p className="font-inter text-body-sm text-neutral-text mt-xxs">Estes dados são necessários para aprovar a retirada do veículo. Alterações em cadastro aprovado passam por nova análise.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <TextField className="sm:col-span-2" label="Nome completo" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} autoComplete="name" required />
            <TextField label="CPF" inputMode="numeric" value={form.cpf} onChange={(event) => update('cpf', maskCpf(event.target.value))} placeholder="000.000.000-00" maxLength={14} autoComplete="off" required />
            <TextField label="Telefone com DDD" type="tel" inputMode="tel" value={form.phone} onChange={(event) => update('phone', maskPhone(event.target.value))} placeholder="(00) 00000-0000" maxLength={15} autoComplete="tel" required />
            <TextField label="Número da CNH" inputMode="numeric" value={form.cnhNumber} onChange={(event) => update('cnhNumber', maskDriverLicense(event.target.value))} placeholder="00000000000" maxLength={11} required />
            <SelectField label="Categoria da CNH" value={form.cnhCategory} onChange={(value) => update('cnhCategory', value)}>
              {driverLicenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </SelectField>
            <TextField label="Validade da CNH" type="date" value={form.cnhExpiration} onChange={(event) => update('cnhExpiration', event.target.value)} required />
            <SelectField label="Estado emissor" value={form.cnhState} onChange={(value) => update('cnhState', value)}>
              <option value="">Selecione</option>
              {brazilianStates.map((state) => <option key={state} value={state}>{state}</option>)}
            </SelectField>
            <TextField className="sm:col-span-2" label="E-mail da conta" value={user?.email ?? ''} disabled />
          </div>

          {error ? <p role="alert" className="rounded-xs border border-feedback-negative bg-feedback-negative/10 p-md font-inter text-body-md text-feedback-negative">{error}</p> : null}
          {success ? <p role="status" className="rounded-xs border border-feedback-positive bg-white p-md font-inter text-body-md text-feedback-positive">{success}</p> : null}

          <div className="flex flex-col sm:flex-row gap-sm sm:items-center sm:justify-between">
            <Link to="/" className="font-inter text-body-md text-primary hover:underline">Voltar ao início</Link>
            <Button type="submit" disabled={busy} className="w-full sm:w-auto min-w-[220px]" icon="badge">
              {busy ? 'Enviando...' : 'Enviar para análise'}
            </Button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  )
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = `profile-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div className="flex flex-col gap-xxs">
      <label htmlFor={id} className="font-inter text-body-md text-neutral-text">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-neutral-text rounded-xs px-md py-sm bg-white font-inter text-body-md text-neutral-text outline-none focus:border-primary">
        {children}
      </select>
    </div>
  )
}
