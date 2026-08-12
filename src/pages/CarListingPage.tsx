import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { CarSearchBar } from '../components/CarSearchBar'
import { VehicleCard } from '../components/VehicleCard'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { CategoryIcon, CATEGORY_ICONS } from '../components/CategoryIcon'
import { Filter } from '../components/ui/Filter'
import { Button } from '../components/ui/Button'
import {
  buildVehicleSearch,
  listVehicles,
  matchesVehicleFeature,
  type AvailabilityPeriod,
  type Vehicle,
} from '../services/vehicles'

const SORT_OPTIONS = [
  { label: 'Menor preço', value: 'price-asc' },
  { label: 'Maior preço', value: 'price-desc' },
  { label: 'Mais recentes', value: 'newest' },
  { label: 'Mais populares', value: 'popular' },
]

const CATEGORY_OPTIONS = [
  { label: 'Todos', value: '' },
  { label: 'Hatch', value: 'hatch' },
  { label: 'SUV', value: 'suv' },
  { label: 'Sedan', value: 'sedan' },
  { label: 'Minivan', value: 'minivan' },
]

const CARS_PER_PAGE = 8

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SearchParams {
  location?: string
  locationId?: string
  pickupDate?: string
  pickupTime?: string
  returnDate?: string
  returnTime?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CarListingPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sortBy, setSortBy] = useState('price-asc')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [activeFeature, setActiveFeature] = useState('')
  const [visibleCount, setVisibleCount] = useState(CARS_PER_PAGE)

  const periodKey = searchParams.toString()

  useEffect(() => {
    let active = true
    const currentSearch = new URLSearchParams(periodKey)
    const period: AvailabilityPeriod = {
      locationId: currentSearch.get('locationId') ?? undefined,
      pickupDate: currentSearch.get('pickupDate') ?? undefined,
      pickupTime: currentSearch.get('pickupTime') ?? undefined,
      returnDate: currentSearch.get('returnDate') ?? undefined,
      returnTime: currentSearch.get('returnTime') ?? undefined,
    }

    setLoading(true)
    setLoadError('')
    listVehicles(period)
      .then((data) => {
        if (active) setVehicles(data)
      })
      .catch((error: unknown) => {
        if (!active) return
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Não foi possível consultar os veículos disponíveis.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [periodKey])

  const filteredByCategory = vehicles.filter((vehicle) => {
    const matchesCategory = categoryFilter ? vehicle.category === categoryFilter : true
    return matchesCategory && matchesVehicleFeature(vehicle, activeFeature)
  })

  // Sort
  const sorted = [...filteredByCategory].sort((a, b) => {
    if (sortBy === 'price-asc') return a.pricePerDay - b.pricePerDay
    if (sortBy === 'price-desc') return b.pricePerDay - a.pricePerDay
    if (sortBy === 'newest') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    if (sortBy === 'popular') return b.popularidade - a.popularidade
    return 0
  })

  const visible = sorted.slice(0, visibleCount)
  const hasMore = visibleCount < sorted.length

  function toggleFeature(value: string) {
    setActiveFeature((prev) => (prev === value ? '' : value))
  }

  function handleLoadMore() {
    setVisibleCount((c) => c + CARS_PER_PAGE)
  }

  function handleSearch(params: AvailabilityPeriod & { location: string; locationId: string }) {
    setSearchParams(new URLSearchParams(buildVehicleSearch(params).slice(1)))
    setVisibleCount(CARS_PER_PAGE)
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-background">
      {/* Header */}
      <Header />

      {/* Search bar */}
      <CarSearchBar
        initialValues={{
          location: searchParams.get('location') ?? '',
          locationId: searchParams.get('locationId') ?? '',
          pickupDate: searchParams.get('pickupDate') ?? '',
          pickupTime: searchParams.get('pickupTime') ?? '',
          returnDate: searchParams.get('returnDate') ?? '',
          returnTime: searchParams.get('returnTime') ?? '',
        }}
        onSearch={handleSearch}
      />

      {/* Main content */}
      <main className="flex-1 max-w-[1480px] mx-auto w-full px-md md:px-lg py-xl flex flex-col gap-lg">

        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: 'Início', href: '/' },
            { label: 'Carros' },
          ]}
        />

        {/* Page title + result count */}
        <div className="flex flex-col gap-xs">
          <h1 className="font-exo font-bold text-heading-sm text-neutral-black">
            Veículos disponíveis
          </h1>
          <p className="font-inter text-body-md text-neutral-text">
            {sorted.length} {sorted.length === 1 ? 'veículo encontrado' : 'veículos encontrados'}
            {''}
          </p>
        </div>

        {/* Feature category icons filter row */}
        <div className="flex flex-wrap gap-xs">
          {CATEGORY_ICONS.map((cat) => (
            <CategoryIcon
              key={cat.value}
              label={cat.label}
              icon={cat.icon}
              active={activeFeature === cat.value}
              onClick={() => toggleFeature(cat.value)}
            />
          ))}
        </div>

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md border-b border-neutral-divisor pb-md">
          <p className="font-inter text-body-md text-neutral-text">
            Mostrando <span className="font-bold text-neutral-black">{visible.length}</span>{' '}
            de <span className="font-bold text-neutral-black">{sorted.length}</span> veículos
          </p>

          <div className="flex items-center gap-md flex-wrap">
            <Filter
              label="Categoria"
              options={CATEGORY_OPTIONS}
              value={categoryFilter}
              onChange={(val) => {
                setCategoryFilter(val)
                setVisibleCount(CARS_PER_PAGE)
              }}
              className="w-[180px]"
            />
            <Filter
              label="Ordenar por"
              options={SORT_OPTIONS}
              value={sortBy}
              onChange={setSortBy}
              className="w-[200px]"
            />
          </div>
        </div>

        {/* Vehicle grid */}
        {loading ? (
          <p className="font-inter text-body-md text-neutral-text py-xl text-center">
            Consultando veículos disponíveis...
          </p>
        ) : loadError ? (
          <p className="font-inter text-body-md text-neutral-text py-xl text-center">
            {loadError}
          </p>
        ) : visible.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-lg justify-items-center">
            {visible.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                size="lg"
                title={vehicle.title}
                subtitle={vehicle.subtitle}
                pricePerDay={vehicle.pricePerDay}
                imageUrl={vehicle.imageUrl}
                onDetailsClick={() => navigate(`/carros/${vehicle.id}?${searchParams.toString()}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-[80px] gap-md">
            <span className="material-icons text-[64px] text-neutral-details">
              directions_car
            </span>
            <p className="font-inter text-body-lg text-neutral-text text-center">
              Nenhum veículo encontrado para os filtros selecionados.
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                setCategoryFilter('')
                setActiveFeature('')
                setVisibleCount(CARS_PER_PAGE)
              }}
            >
              Limpar filtros
            </Button>
          </div>
        )}

        {/* Load more */}
        {!loading && !loadError && hasMore && (
          <div className="flex justify-center pt-md">
            <Button variant="secondary" onClick={handleLoadMore}>
              Ver mais veículos
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
