import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/TextField'

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_VEHICLE = {
  title: 'Hyundai HB20 1.0',
  subtitle: 'Intermediário Hatch Manual',
  group: 'Grupo C – Econômico Sedan com ar condicionado.',
  pricePerDay: 120,
  days: 4,
}

const MOCK_PROTECTION = {
  title: 'Básica',
  pricePerDay: 45,
  days: 4,
}

const MOCK_PICKUP = {
  date: '20/09/2025',
  time: '10:00',
  location: 'Aeroporto de Congonhas',
}

const MOCK_RETURN = {
  date: '24/09/2025',
  time: '10:00',
  location: 'Aeroporto de Congonhas',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormValues {
  name: string
  cpf: string
  phone: string
  email: string
}

interface FormErrors {
  name?: string
  cpf?: string
  phone?: string
  email?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'Nome completo é obrigatório.'
  }

  const cpfDigits = values.cpf.replace(/\D/g, '')
  if (!cpfDigits || cpfDigits.length !== 11) {
    errors.cpf = 'Informe um CPF válido (11 dígitos).'
  }

  const phoneDigits = values.phone.replace(/\D/g, '')
  if (!phoneDigits || phoneDigits.length < 10) {
    errors.phone = 'Informe um telefone válido.'
  }

  if (!values.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Informe um e-mail válido.'
  }

  return errors
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Divider() {
  return <hr className="border-t border-neutral-divisor w-full" />
}

interface SummaryRowProps {
  label: string
  value: string
}

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between font-inter text-body-md text-neutral-text">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  action?: string
  onAction?: () => void
}

function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-exo font-bold text-heading-sm text-neutral-text">{title}</h3>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-xs font-inter text-body-md text-neutral-text hover:text-primary transition-colors cursor-pointer"
        >
          <span className="material-icons text-[18px]">edit</span>
          {action}
        </button>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ReservationPage() {
  const navigate = useNavigate()
  const [values, setValues] = useState<FormValues>({
    name: '',
    cpf: '',
    phone: '',
    email: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const vehicleTotal = MOCK_VEHICLE.pricePerDay * MOCK_VEHICLE.days
  const protectionTotal = MOCK_PROTECTION.pricePerDay * MOCK_PROTECTION.days
  const grandTotal = vehicleTotal + protectionTotal

  function handleChange(field: keyof FormValues) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }))
      if (submitted) {
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      }
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    const validationErrors = validateForm(values)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-background">
      <Header isLoggedIn />

      <main className="flex-1 w-full max-w-[1480px] mx-auto px-md md:px-lg py-xl">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Carros', href: '/carros' },
            { label: 'HB20', href: '/carros/hb20' },
            { label: 'Reserva' },
          ]}
          className="mb-lg"
        />

        <div className="flex flex-col lg:flex-row gap-lg items-start">
          {/* ── Left column: Customer form ─────────────────────────────── */}
          <section className="flex-1 min-w-0 bg-white rounded-xs shadow-elevation-2 p-lg flex flex-col gap-lg">
            <h2 className="font-exo font-bold text-heading-md text-neutral-text">
              Dados do locatário
            </h2>

            <Divider />

            <form
              id="reservation-form"
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col gap-md"
            >
              <TextField
                label="Nome completo"
                placeholder="Insira seu nome completo"
                value={values.name}
                onChange={handleChange('name')}
                error={errors.name}
                autoComplete="name"
              />

              <TextField
                label="CPF"
                placeholder="000.000.000-00"
                value={values.cpf}
                onChange={handleChange('cpf')}
                error={errors.cpf}
                inputMode="numeric"
                maxLength={14}
                autoComplete="off"
              />

              <TextField
                label="Telefone / WhatsApp"
                placeholder="(11) 90000-0000"
                value={values.phone}
                onChange={handleChange('phone')}
                error={errors.phone}
                inputMode="tel"
                autoComplete="tel"
              />

              <TextField
                label="E-mail"
                placeholder="seuemail@exemplo.com"
                type="email"
                value={values.email}
                onChange={handleChange('email')}
                error={errors.email}
                autoComplete="email"
              />
            </form>

            <Divider />

            {/* Terms notice */}
            <p className="font-inter text-body-sm text-neutral-text">
              Ao confirmar a reserva, você concorda com os nossos{' '}
              <a href="#" className="text-primary underline underline-offset-2 hover:text-primary-dark">
                Termos de uso
              </a>{' '}
              e{' '}
              <a href="#" className="text-primary underline underline-offset-2 hover:text-primary-dark">
                Política de privacidade
              </a>
              .
            </p>

            {/* Action buttons */}
            <div className="flex flex-col gap-xs">
              <Button
                variant="primary"
                className="w-full"
                type="submit"
                form="reservation-form"
              >
                Confirmar reserva
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                type="button"
                onClick={() => navigate(-1 as never)}
                icon="arrow_back"
              >
                Voltar
              </Button>
            </div>
          </section>

          {/* ── Right column: Reservation summary ─────────────────────── */}
          <aside className="w-full lg:w-[420px] shrink-0 bg-white rounded-xs shadow-elevation-2 flex flex-col gap-lg p-lg">
            <h2 className="font-exo font-bold text-heading-sm text-neutral-text">
              Resumo da reserva
            </h2>

            <Divider />

            {/* Vehicle */}
            <div className="flex flex-col gap-xs">
              <SectionHeader title="Veículo" action="Editar" />
              <p className="font-exo font-bold text-heading-xs text-neutral-text">
                {MOCK_VEHICLE.title}
              </p>
              <p className="font-inter text-body-md text-neutral-text">
                {MOCK_VEHICLE.subtitle}.
                <br />
                {MOCK_VEHICLE.group}
              </p>
            </div>

            <Divider />

            {/* Pickup */}
            <div className="flex flex-col gap-xs">
              <SectionHeader title="Retirada" action="Editar" />
              <div className="flex flex-col gap-xxs">
                <div className="flex items-center gap-xs font-inter text-body-md text-neutral-text">
                  <span className="font-exo font-bold text-heading-xs">Data:</span>
                  <span>{MOCK_PICKUP.date}</span>
                </div>
                <div className="flex items-center gap-xs font-inter text-body-md text-neutral-text">
                  <span className="font-exo font-bold text-heading-xs">Horário:</span>
                  <span>{MOCK_PICKUP.time}</span>
                </div>
                <div className="flex items-center gap-xs font-inter text-body-md text-neutral-text">
                  <span className="font-exo font-bold text-heading-xs">Local:</span>
                  <span>{MOCK_PICKUP.location}</span>
                </div>
              </div>
            </div>

            <Divider />

            {/* Return */}
            <div className="flex flex-col gap-xs">
              <SectionHeader title="Devolução" action="Editar" />
              <div className="flex flex-col gap-xxs">
                <div className="flex items-center gap-xs font-inter text-body-md text-neutral-text">
                  <span className="font-exo font-bold text-heading-xs">Data:</span>
                  <span>{MOCK_RETURN.date}</span>
                </div>
                <div className="flex items-center gap-xs font-inter text-body-md text-neutral-text">
                  <span className="font-exo font-bold text-heading-xs">Horário:</span>
                  <span>{MOCK_RETURN.time}</span>
                </div>
                <div className="flex items-center gap-xs font-inter text-body-md text-neutral-text">
                  <span className="font-exo font-bold text-heading-xs">Local:</span>
                  <span>{MOCK_RETURN.location}</span>
                </div>
              </div>
            </div>

            <Divider />

            {/* Daily rates */}
            <div className="flex flex-col gap-xs">
              <h3 className="font-exo font-bold text-heading-sm text-neutral-text">Diárias</h3>
              <SummaryRow
                label={`${MOCK_VEHICLE.days}x ${formatCurrency(MOCK_VEHICLE.pricePerDay)}`}
                value={formatCurrency(vehicleTotal)}
              />
            </div>

            <Divider />

            {/* Protection */}
            <div className="flex flex-col gap-xs">
              <SectionHeader title="Proteção" action="Remover" />
              <p className="font-exo font-bold text-heading-xs text-neutral-text">
                {MOCK_PROTECTION.title}
              </p>
              <SummaryRow
                label={`${MOCK_PROTECTION.days}x ${formatCurrency(MOCK_PROTECTION.pricePerDay)}`}
                value={formatCurrency(protectionTotal)}
              />
            </div>

            <Divider />

            {/* Grand total */}
            <div className="flex items-center justify-between">
              <span className="font-exo font-bold text-heading-sm text-neutral-text">
                Valor total previsto
              </span>
              <span className="font-exo font-bold text-heading-sm text-neutral-text">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
