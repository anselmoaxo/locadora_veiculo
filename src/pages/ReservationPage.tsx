import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { ReservationForm } from '../components/ReservationForm'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'
import { getVehicle, type Vehicle } from '../services/vehicles'
import {
  findLocationByName,
  listLocations,
  type RentalLocation,
  type ReserveCarResult,
} from '../services/reservations'

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function displayDateTime(value: string) {
  if (!value) return 'Não informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function Divider() {
  return <hr className="border-t border-neutral-divisor w-full" />
}

export function ReservationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [locations, setLocations] = useState<RentalLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [confirmation, setConfirmation] = useState<ReserveCarResult | null>(null)
  const { profile, profileLoading } = useAuth()

  const pickupDate = searchParams.get('pickupDate') ?? ''
  const pickupTime = searchParams.get('pickupTime') ?? ''
  const returnDate = searchParams.get('returnDate') ?? ''
  const returnTime = searchParams.get('returnTime') ?? ''
  const locationName = searchParams.get('location') ?? ''
  const locationId = searchParams.get('locationId') ?? ''
  const initialStartAt = pickupDate && pickupTime ? `${pickupDate}T${pickupTime}` : ''
  const initialEndAt = returnDate && returnTime ? `${returnDate}T${returnTime}` : ''
  const redirect = `${location.pathname}${location.search}`

  useEffect(() => {
    if (profileLoading) return
    if (!profile || profile.cadastro_status === 'incompleto' || profile.cadastro_status === 'reprovado') {
      navigate(`/minha-conta?redirect=${encodeURIComponent(redirect)}&reason=reservation`, { replace: true })
    }
  }, [navigate, profile, profileLoading, redirect])

  useEffect(() => {
    let active = true
    if (!id) {
      setLoadError('Veículo não informado.')
      setLoading(false)
      return () => { active = false }
    }

    Promise.all([getVehicle(id), listLocations()])
      .then(([vehicleData, locationData]) => {
        if (!active) return
        if (!vehicleData) throw new Error('Veículo não encontrado.')
        setVehicle(vehicleData)
        setLocations(locationData)
      })
      .catch(() => {
        if (active) setLoadError('Não foi possível preparar esta reserva.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [id])

  if (loading || profileLoading || !vehicle || !id) {
    return (
      <div className="min-h-screen flex flex-col bg-neutral-background">
        <Header />
        <main className="flex-1 flex items-center justify-center px-md">
          <p className="font-inter text-body-lg text-neutral-text">
            {loading || profileLoading ? 'Preparando sua reserva...' : loadError}
          </p>
        </main>
        <Footer />
      </div>
    )
  }

  const selectedLocation = locations.find((item) => item.id === locationId)
    ?? findLocationByName(locations, locationName)
  const detailUrl = `/carros/${vehicle.id}?${searchParams.toString()}`

  return (
    <div className="min-h-screen flex flex-col bg-neutral-background">
      <Header />
      <main className="flex-1 w-full max-w-[1480px] mx-auto px-md md:px-lg py-xl">
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Carros', href: '/carros' },
            { label: vehicle.modelo ?? vehicle.title, href: detailUrl },
            { label: 'Reserva' },
          ]}
          className="mb-lg"
        />

        {confirmation ? (
          <section className="mb-lg bg-white border border-feedback-positive rounded-xs shadow-elevation-1 p-lg" role="status">
            <div className="flex items-start gap-md">
              <span className="material-icons text-[36px] text-feedback-positive" aria-hidden="true">check_circle</span>
              <div>
                <h1 className="font-exo font-bold text-heading-sm text-secondary">Reserva criada!</h1>
                <p className="font-inter text-body-md text-neutral-text">
                  Protocolo <strong>{confirmation.reservation_id.slice(0, 8).toUpperCase()}</strong>. A reserva está pendente.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <div className="flex flex-col lg:flex-row gap-lg items-start">
          <section className="flex-1 min-w-0 bg-white rounded-xs shadow-elevation-2 p-lg flex flex-col gap-lg">
            <div>
              <p className="font-inter text-body-sm text-primary font-bold uppercase tracking-wide">Última etapa</p>
              <h1 className="font-exo font-bold text-heading-md text-neutral-text">Escolha o período</h1>
              <p className="font-inter text-body-md text-neutral-text mt-xs">
                Confira as datas e reserve com segurança. O carro será bloqueado atomicamente para evitar duplicidade.
              </p>
            </div>
            <Divider />
            <ReservationForm
              carId={id}
              pricePerDay={vehicle.pricePerDay}
              pickupLocationId={selectedLocation?.id ?? null}
              dropoffLocationId={selectedLocation?.id ?? null}
              initialStartAt={initialStartAt}
              initialEndAt={initialEndAt}
              onSuccess={setConfirmation}
              onAuthRequired={() => navigate(`/auth?redirect=${encodeURIComponent(redirect)}`, { replace: true })}
              onProfileRequired={() => navigate(`/minha-conta?redirect=${encodeURIComponent(redirect)}`)}
              onChooseAnotherCar={() => navigate(`/carros?${searchParams.toString()}`)}
            />
            <Button variant="ghost" className="w-full" type="button" onClick={() => navigate(detailUrl)} icon="arrow_back">
              Voltar aos detalhes
            </Button>
          </section>

          <aside className="w-full lg:w-[420px] shrink-0 bg-white rounded-xs shadow-elevation-2 flex flex-col gap-lg p-lg sticky top-[108px]">
            <h2 className="font-exo font-bold text-heading-sm text-neutral-text">Resumo da reserva</h2>
            <Divider />
            <div className="flex items-center gap-md">
              <div className="w-24 h-20 rounded-xs bg-neutral-divisor overflow-hidden shrink-0">
                {vehicle.imageUrl ? <img src={vehicle.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
              </div>
              <div>
                <p className="font-exo font-bold text-heading-xs text-neutral-text">{vehicle.title}</p>
                <p className="font-inter text-body-sm text-neutral-text">{vehicle.subtitle}</p>
              </div>
            </div>
            <Divider />
            <div className="font-inter text-body-md text-neutral-text flex flex-col gap-xs">
              <p><strong>Retirada:</strong> {displayDateTime(initialStartAt)}</p>
              <p><strong>Devolução:</strong> {displayDateTime(initialEndAt)}</p>
              <p><strong>Local:</strong> {selectedLocation?.nome ?? 'Local atual do veículo'}</p>
            </div>
            <Divider />
            <div className="flex items-center justify-between gap-md">
              <span className="font-inter text-body-md text-neutral-text">Diária a partir de</span>
              <strong className="font-exo text-heading-xs text-primary">{formatCurrency(vehicle.pricePerDay)}</strong>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}
