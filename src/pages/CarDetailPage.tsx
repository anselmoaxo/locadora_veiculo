import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { ProtectionCard } from '../components/ProtectionCard'
import { Button } from '../components/ui/Button'
import { IconArrowButton } from '../components/ui/Button'

// ─── Types ───────────────────────────────────────────────────────────────────

type ProtectionTier = 'none' | 'basic' | 'standard' | 'advanced'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_VEHICLE = {
  id: 'hyundai-hb20-2024',
  title: 'Hyundai HB20 1.0',
  subtitle: 'Intermediário Hatch Manual',
  category: 'Grupo C – Econômico Sedan com ar condicionado',
  pricePerDay: 120,
  images: [
    null, // placeholder images — will render a car icon
    null,
    null,
  ],
  features: [
    { icon: 'ac_unit', label: 'Ar cond.' },
    { icon: 'lock', label: 'Travas' },
    { icon: 'settings', label: 'Freio ABS' },
    { icon: 'settings_input_component', label: 'Câmbio manual' },
    { icon: 'groups', label: '5 pessoas' },
    { icon: 'luggage', label: '2 malas' },
  ],
}

const MOCK_RESERVATION = {
  pickup: {
    date: '20/09/2025',
    time: '10:00',
    location: 'Aeroporto de Congonhas',
  },
  dropoff: {
    date: '24/09/2025',
    time: '10:00',
    location: 'Aeroporto de Congonhas',
  },
  days: 4,
}

const PROTECTION_PLANS = [
  {
    tier: 'basic' as const,
    title: 'Básica',
    pricePerDay: 45,
    features: [
      { label: 'Proteção contra furto' },
      { label: 'Proteção contra incêndio' },
      { label: 'Perda total do veículo' },
    ],
  },
  {
    tier: 'standard' as const,
    title: 'Padrão',
    pricePerDay: 80,
    features: [
      { label: 'Proteção contra furto' },
      { label: 'Proteção contra incêndio' },
      { label: 'Perda total do veículo' },
      { label: 'Danos/avarias por colisões e eventos adversos' },
      { label: 'Redução de Coparticipação' },
    ],
  },
  {
    tier: 'advanced' as const,
    title: 'Avançada',
    pricePerDay: 120,
    features: [
      { label: 'Proteção contra roubo' },
      { label: 'Proteção contra furto' },
      { label: 'Proteção contra incêndio' },
      { label: 'Perda total do veículo' },
      { label: 'Danos/avarias por colisões e eventos adversos' },
      { label: 'Danos a vidros e pneus' },
      { label: 'Proteção contra Terceiros' },
      { label: 'Isenção total de Coparticipação' },
    ],
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function Divider() {
  return <hr className="border-t border-neutral-details w-full" />
}

interface SummaryRowProps {
  label: string
  value: string
}
function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between w-full font-inter text-body-md text-neutral-text">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

interface SummarySectionProps {
  title: string
  onEdit?: () => void
  children: React.ReactNode
}
function SummarySection({ title, onEdit, children }: SummarySectionProps) {
  return (
    <div className="flex flex-col gap-xs w-full">
      <div className="flex items-center justify-between w-full">
        <h3 className="font-exo font-bold text-heading-sm text-neutral-text">{title}</h3>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-xs font-inter text-body-md text-neutral-text hover:text-primary transition-colors cursor-pointer px-md py-sm"
          >
            <span className="material-icons text-[16px]">edit</span>
            Editar
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CarDetailPage() {
  const navigate = useNavigate()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [selectedProtection, setSelectedProtection] = useState<ProtectionTier>('none')

  const vehicle = MOCK_VEHICLE
  const reservation = MOCK_RESERVATION

  // Compute totals
  const vehicleTotal = vehicle.pricePerDay * reservation.days
  const selectedPlan = PROTECTION_PLANS.find((p) => p.tier === selectedProtection)
  const protectionTotal = selectedPlan ? selectedPlan.pricePerDay * reservation.days : 0
  const grandTotal = vehicleTotal + protectionTotal

  function handleProtectionSelect(tier: ProtectionTier) {
    setSelectedProtection((prev) => (prev === tier ? 'none' : tier))
  }

  function handlePrevImage() {
    setCurrentImageIndex((i) => (i === 0 ? vehicle.images.length - 1 : i - 1))
  }

  function handleNextImage() {
    setCurrentImageIndex((i) => (i === vehicle.images.length - 1 ? 0 : i + 1))
  }

  function handleReserve() {
    navigate(`/reserva/${vehicle.id}`)
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-background">
      {/* Header */}
      <Header isLoggedIn={false} />

      {/* Breadcrumbs */}
      <div className="max-w-[1480px] mx-auto w-full px-md md:px-lg pt-md">
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Carros', href: '/carros' },
            { label: vehicle.title },
          ]}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-[1480px] mx-auto w-full px-md md:px-lg py-lg flex flex-col lg:flex-row gap-lg items-start">

        {/* ── Left column: vehicle detail + protection plans ── */}
        <div className="flex flex-col gap-lg flex-1 min-w-0">

          {/* Vehicle card */}
          <section className="bg-white rounded-xs shadow-elevation-2 flex flex-col gap-lg p-lg">

            {/* Image gallery */}
            <div className="relative w-full aspect-[16/9] bg-neutral-divisor rounded-xs overflow-hidden flex items-center justify-center">
              {vehicle.images[currentImageIndex] ? (
                <img
                  src={vehicle.images[currentImageIndex] as string}
                  alt={`${vehicle.title} – imagem ${currentImageIndex + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="material-icons text-[96px] text-neutral-details">
                  directions_car
                </span>
              )}

              {/* Navigation arrows */}
              <div className="absolute inset-0 flex items-center justify-between px-xs pointer-events-none">
                <IconArrowButton
                  direction="left"
                  onClick={handlePrevImage}
                  aria-label="Imagem anterior"
                  className="pointer-events-auto shadow-elevation-2 bg-white"
                />
                <IconArrowButton
                  direction="right"
                  onClick={handleNextImage}
                  aria-label="Próxima imagem"
                  className="pointer-events-auto shadow-elevation-2 bg-white"
                />
              </div>

              {/* Dots indicator */}
              <div className="absolute bottom-xs left-0 right-0 flex justify-center gap-xs">
                {vehicle.images.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentImageIndex(idx)}
                    aria-label={`Ir para imagem ${idx + 1}`}
                    className={`w-2 h-2 rounded-full transition-colors cursor-pointer ${
                      idx === currentImageIndex ? 'bg-primary' : 'bg-white opacity-70'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Vehicle info */}
            <div className="flex flex-col gap-xs">
              <h1 className="font-exo font-bold text-heading-md text-neutral-text">
                {vehicle.title}
              </h1>
              <p className="font-inter text-body-md text-neutral-text">{vehicle.subtitle}</p>
              <p className="font-inter text-body-md text-neutral-text">{vehicle.category}</p>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-1">
              <span className="font-exo font-bold text-heading-md text-primary">
                R${vehicle.pricePerDay}
              </span>
              <span className="font-inter text-body-lg text-neutral-text">/diária</span>
            </div>

            <Divider />

            {/* Features */}
            <div className="flex flex-col gap-md">
              <h2 className="font-exo font-bold text-heading-xs text-neutral-text">
                Características
              </h2>
              <div className="flex flex-wrap gap-xs">
                {vehicle.features.map((feature) => (
                  <div
                    key={feature.label}
                    className="flex flex-col items-center justify-center gap-xs p-xs rounded-xs bg-white border border-neutral-details w-[88px] h-[88px]"
                  >
                    <span className="material-icons text-[32px] text-neutral-text">
                      {feature.icon}
                    </span>
                    <span className="font-inter text-body-sm text-neutral-text text-center leading-tight">
                      {feature.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Protection plans ── */}
          <section className="bg-secondary rounded-xs overflow-hidden shadow-elevation-2">
            {/* Section header */}
            <div className="bg-secondary px-lg py-xl">
              <h2 className="font-exo font-bold text-heading-md text-white">
                Adicione mais segurança
              </h2>
            </div>

            <div className="px-lg pb-lg flex flex-col gap-lg">
              <p className="font-inter text-body-md text-neutral-details">
                Para uma viagem mais segura, escolha uma proteção para o seu aluguel (opcional):
              </p>

              <div className="flex flex-wrap gap-lg justify-start">
                {PROTECTION_PLANS.map((plan) => (
                  <ProtectionCard
                    key={plan.tier}
                    tier={plan.tier}
                    title={plan.title}
                    pricePerDay={plan.pricePerDay}
                    features={plan.features}
                    selected={selectedProtection === plan.tier}
                    onAdd={() => handleProtectionSelect(plan.tier)}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ── Right column: reservation summary ── */}
        <aside className="w-full lg:w-[420px] shrink-0">
          <div className="bg-white rounded-xs shadow-elevation-2 flex flex-col overflow-hidden sticky top-[108px]">

            {/* Summary header */}
            <div className="bg-primary px-lg py-xl">
              <h2 className="font-exo font-bold text-heading-md text-white">
                Resumo da sua reserva
              </h2>
            </div>

            <div className="flex flex-col gap-lg p-lg">

              {/* Vehicle section */}
              <SummarySection title="Veículo" onEdit={() => navigate('/carros')}>
                <div className="flex flex-col gap-xs">
                  <p className="font-exo font-bold text-heading-xs text-neutral-text">
                    {vehicle.title}
                  </p>
                  <p className="font-inter text-body-md text-neutral-text">
                    {vehicle.subtitle}.<br />
                    {vehicle.category}.
                  </p>
                </div>
              </SummarySection>

              <Divider />

              {/* Pickup section */}
              <SummarySection title="Retirada">
                <div className="flex flex-col gap-xxs font-inter text-body-md text-neutral-text">
                  <div className="flex gap-xs">
                    <span className="font-exo font-bold text-heading-xs">Data:</span>
                    <span className="self-center">{reservation.pickup.date}</span>
                  </div>
                  <div className="flex gap-xs">
                    <span className="font-exo font-bold text-heading-xs">Horário:</span>
                    <span className="self-center">{reservation.pickup.time}</span>
                  </div>
                  <div className="flex gap-xs">
                    <span className="font-exo font-bold text-heading-xs">Local:</span>
                    <span className="self-center">{reservation.pickup.location}</span>
                  </div>
                </div>
              </SummarySection>

              <Divider />

              {/* Drop-off section */}
              <SummarySection title="Devolução">
                <div className="flex flex-col gap-xxs font-inter text-body-md text-neutral-text">
                  <div className="flex gap-xs">
                    <span className="font-exo font-bold text-heading-xs">Data:</span>
                    <span className="self-center">{reservation.dropoff.date}</span>
                  </div>
                  <div className="flex gap-xs">
                    <span className="font-exo font-bold text-heading-xs">Horário:</span>
                    <span className="self-center">{reservation.dropoff.time}</span>
                  </div>
                  <div className="flex gap-xs">
                    <span className="font-exo font-bold text-heading-xs">Local:</span>
                    <span className="self-center">{reservation.dropoff.location}</span>
                  </div>
                </div>
              </SummarySection>

              <Divider />

              {/* Daily totals */}
              <SummarySection title="Diárias">
                <SummaryRow
                  label={`${reservation.days}×R$${vehicle.pricePerDay},00`}
                  value={`R$${vehicleTotal},00`}
                />
              </SummarySection>

              <Divider />

              {/* Protection */}
              <SummarySection
                title="Proteção"
                onEdit={selectedProtection !== 'none' ? () => setSelectedProtection('none') : undefined}
              >
                {selectedProtection === 'none' ? (
                  <p className="font-inter text-body-md text-neutral-text italic">
                    Nenhuma proteção selecionada
                  </p>
                ) : (
                  <div className="flex flex-col gap-xs">
                    <p className="font-exo font-bold text-heading-xs text-neutral-text">
                      {selectedPlan?.title}
                    </p>
                    <SummaryRow
                      label={`${reservation.days}×R$${selectedPlan?.pricePerDay},00`}
                      value={`R$${protectionTotal},00`}
                    />
                  </div>
                )}
              </SummarySection>
            </div>

            {/* Total + CTA */}
            <div className="bg-primary flex flex-col gap-md px-lg py-lg">
              <div className="flex items-center justify-between">
                <span className="font-exo font-bold text-heading-md text-white">
                  Valor total:
                </span>
                <span className="font-exo font-bold text-heading-md text-white">
                  R${grandTotal},00
                </span>
              </div>

              <Button
                variant="secondary"
                className="w-full"
                onClick={handleReserve}
              >
                Confirmar reserva
              </Button>
            </div>
          </div>
        </aside>
      </main>

      <Footer />
    </div>
  )
}

export default CarDetailPage
