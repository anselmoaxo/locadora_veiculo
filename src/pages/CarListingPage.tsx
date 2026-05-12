import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { CarSearchBar } from '../components/CarSearchBar'
import { VehicleCard } from '../components/VehicleCard'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { CategoryIcon, CATEGORY_ICONS } from '../components/CategoryIcon'
import { Filter } from '../components/ui/Filter'
import { Button } from '../components/ui/Button'

// ── Mock data ──────────────────────────────────────────────────────────────────

interface MockVehicle {
  id: string
  title: string
  subtitle: string
  pricePerDay: number
  imageUrl?: string
  category: string
}

const MOCK_VEHICLES: MockVehicle[] = [
  {
    id: '1',
    title: 'Hyundai HB20 2024',
    subtitle: 'Hatch — Câmbio automático',
    pricePerDay: 120,
    category: 'hatch',
  },
  {
    id: '2',
    title: 'Toyota Corolla Cross 2023',
    subtitle: 'SUV — Câmbio automático',
    pricePerDay: 240,
    category: 'suv',
  },
  {
    id: '3',
    title: 'Volkswagen Polo 2024',
    subtitle: 'Hatch — Manual',
    pricePerDay: 95,
    category: 'hatch',
  },
  {
    id: '4',
    title: 'Fiat Pulse 2023',
    subtitle: 'SUV — Automático',
    pricePerDay: 175,
    category: 'suv',
  },
  {
    id: '5',
    title: 'Honda Civic 2023',
    subtitle: 'Sedan — Automático CVT',
    pricePerDay: 200,
    category: 'sedan',
  },
  {
    id: '6',
    title: 'Chevrolet Onix 2024',
    subtitle: 'Hatch — Automático',
    pricePerDay: 110,
    category: 'hatch',
  },
  {
    id: '7',
    title: 'Jeep Compass 2023',
    subtitle: 'SUV — Automático 4x4',
    pricePerDay: 290,
    category: 'suv',
  },
  {
    id: '8',
    title: 'Toyota Yaris 2024',
    subtitle: 'Sedan — Automático',
    pricePerDay: 145,
    category: 'sedan',
  },
  {
    id: '9',
    title: 'Volkswagen T-Cross 2023',
    subtitle: 'SUV — Automático',
    pricePerDay: 210,
    category: 'suv',
  },
  {
    id: '10',
    title: 'Renault Kwid 2024',
    subtitle: 'Hatch — Manual',
    pricePerDay: 85,
    category: 'hatch',
  },
  {
    id: '11',
    title: 'Nissan Kicks 2023',
    subtitle: 'SUV — CVT',
    pricePerDay: 225,
    category: 'suv',
  },
  {
    id: '12',
    title: 'Ford Territory 2023',
    subtitle: 'SUV — Automático',
    pricePerDay: 260,
    category: 'suv',
  },
]

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
]

const CARS_PER_PAGE = 8

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SearchParams {
  location?: string
  pickupDate?: string
  pickupTime?: string
  returnDate?: string
  returnTime?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CarListingPage() {
  const navigate = useNavigate()
  const [sortBy, setSortBy] = useState('price-asc')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [activeFeature, setActiveFeature] = useState('')
  const [visibleCount, setVisibleCount] = useState(CARS_PER_PAGE)

  // Filter by category dropdown
  const filteredByCategory = categoryFilter
    ? MOCK_VEHICLES.filter((v) => v.category === categoryFilter)
    : MOCK_VEHICLES

  // Sort
  const sorted = [...filteredByCategory].sort((a, b) => {
    if (sortBy === 'price-asc') return a.pricePerDay - b.pricePerDay
    if (sortBy === 'price-desc') return b.pricePerDay - a.pricePerDay
    // 'newest' and 'popular' keep insertion order (mock)
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

  return (
    <div className="min-h-screen flex flex-col bg-neutral-background">
      {/* Header */}
      <Header />

      {/* Search bar */}
      <CarSearchBar onSearch={(p) => console.log('new search', p)} />

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
        {visible.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-lg justify-items-center">
            {visible.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                size="lg"
                title={vehicle.title}
                subtitle={vehicle.subtitle}
                pricePerDay={vehicle.pricePerDay}
                imageUrl={vehicle.imageUrl}
                onDetailsClick={() => navigate(`/carros/${vehicle.id}`)}
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
        {hasMore && (
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
