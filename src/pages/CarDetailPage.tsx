import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { ReservationForm } from '../components/ReservationForm'
import { IconArrowButton } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'
import { getVehicle, type Vehicle } from '../services/vehicles'

export function CarDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin } = useAuth()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    let active = true
    if (!id) {
      setLoadError('Veículo não informado.')
      setLoading(false)
      return () => { active = false }
    }

    getVehicle(id)
      .then((data) => {
        if (!active) return
        setVehicle(data)
        if (!data) setLoadError('Veículo não encontrado.')
      })
      .catch(() => {
        if (active) setLoadError('Não foi possível carregar este veículo.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [id])

  if (loading || !vehicle || !id) {
    return (
      <div className="min-h-screen flex flex-col bg-neutral-background">
        <Header />
        <main className="flex-1 flex items-center justify-center px-md">
          <p className="font-inter text-body-lg text-neutral-text">{loading ? 'Carregando veículo...' : loadError}</p>
        </main>
        <Footer />
      </div>
    )
  }

  const pickupDate = searchParams.get('pickupDate') ?? ''
  const pickupTime = searchParams.get('pickupTime') ?? ''
  const returnDate = searchParams.get('returnDate') ?? ''
  const returnTime = searchParams.get('returnTime') ?? ''
  const locationId = searchParams.get('locationId')
  const initialStartAt = pickupDate && pickupTime ? `${pickupDate}T${pickupTime}` : ''
  const initialEndAt = returnDate && returnTime ? `${returnDate}T${returnTime}` : ''
  const redirect = `${location.pathname}${location.search}`
  const image = vehicle.images[currentImageIndex]
  const imageCount = vehicle.images.length

  function previousImage() {
    setCurrentImageIndex((current) => current === 0 ? imageCount - 1 : current - 1)
  }

  function nextImage() {
    setCurrentImageIndex((current) => current === imageCount - 1 ? 0 : current + 1)
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-background">
      <Header />
      <main className="flex-1 max-w-[1480px] mx-auto w-full px-md md:px-lg py-lg">
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Carros', href: `/carros?${searchParams.toString()}` },
            { label: vehicle.title },
          ]}
          className="mb-lg"
        />

        <div className="flex flex-col lg:flex-row gap-lg items-start">
          <section className="flex-1 min-w-0 bg-white rounded-xs shadow-elevation-2 p-lg flex flex-col gap-lg">
            <div className="relative w-full aspect-[16/9] bg-neutral-divisor rounded-xs overflow-hidden flex items-center justify-center">
              {image ? (
                <img src={image} alt={`${vehicle.title}, imagem ${currentImageIndex + 1}`} className="w-full h-full object-cover" />
              ) : (
                <span className="material-icons text-[96px] text-neutral-details" aria-hidden="true">directions_car</span>
              )}
              {imageCount > 1 ? (
                <div className="absolute inset-0 flex items-center justify-between px-xs pointer-events-none">
                  <IconArrowButton direction="left" onClick={previousImage} aria-label="Imagem anterior" className="pointer-events-auto shadow-elevation-2 bg-white" />
                  <IconArrowButton direction="right" onClick={nextImage} aria-label="Próxima imagem" className="pointer-events-auto shadow-elevation-2 bg-white" />
                </div>
              ) : null}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-md">
              <div>
                <h1 className="font-exo font-bold text-heading-md text-neutral-text">{vehicle.title}</h1>
                <p className="font-inter text-body-md text-neutral-text">{vehicle.subtitle}</p>
                <p className="font-inter text-body-md text-neutral-text">{vehicle.grupo ?? vehicle.category}</p>
              </div>
              {isAdmin ? (
                <Link to={`/veiculos/${vehicle.id}/editar`} className="inline-flex items-center justify-center gap-xxs rounded-xs border border-primary px-md py-sm font-inter text-body-md font-bold text-primary hover:bg-primary-light/30">
                  <span className="material-icons text-[20px]" aria-hidden="true">edit</span>
                  Alterar veículo
                </Link>
              ) : null}
            </div>

            <div className="flex items-baseline gap-1">
              <span className="font-exo font-bold text-heading-md text-primary">
                {vehicle.pricePerDay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <span className="font-inter text-body-lg text-neutral-text">/diária</span>
            </div>

            <hr className="border-t border-neutral-details" />
            <div className="flex flex-col gap-md">
              <h2 className="font-exo font-bold text-heading-xs text-neutral-text">Características</h2>
              <div className="flex flex-wrap gap-xs">
                {vehicle.features.map((feature) => (
                  <div key={feature.label} className="flex flex-col items-center justify-center gap-xs p-xs rounded-xs border border-neutral-details w-[96px] h-[88px]">
                    <span className="material-icons text-[30px] text-neutral-text" aria-hidden="true">{feature.icon}</span>
                    <span className="font-inter text-body-sm text-neutral-text text-center leading-tight">{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="w-full lg:w-[440px] shrink-0 bg-white rounded-xs shadow-elevation-2 overflow-hidden sticky top-[108px]">
            <div className="bg-primary px-lg py-lg">
              <p className="font-inter text-body-sm text-white/80 uppercase tracking-wide font-bold">Reserva segura</p>
              <h2 className="font-exo font-bold text-heading-md text-white">Escolha o período</h2>
            </div>
            <div className="p-lg">
              <ReservationForm
                carId={id}
                pricePerDay={vehicle.pricePerDay}
                pickupLocationId={locationId}
                dropoffLocationId={locationId}
                initialStartAt={initialStartAt}
                initialEndAt={initialEndAt}
                onAuthRequired={() => navigate(`/auth?redirect=${encodeURIComponent(redirect)}`)}
                onProfileRequired={() => navigate(`/minha-conta?redirect=${encodeURIComponent(redirect)}`)}
                onChooseAnotherCar={() => navigate(`/carros?${searchParams.toString()}`)}
              />
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default CarDetailPage
