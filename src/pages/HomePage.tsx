import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { CarSearchBar } from '../components/CarSearchBar'
import { VehicleCard } from '../components/VehicleCard'
import { CategoryIcon, CATEGORY_ICONS } from '../components/CategoryIcon'
import { Filter } from '../components/ui/Filter'
import {
  buildVehicleSearch,
  listVehicles,
  matchesVehicleFeature,
  type Vehicle,
} from '../services/vehicles'

const imgHeroBanner = 'https://www.figma.com/api/mcp/asset/2171eefa-6efb-4c88-942e-91998b95507e'

const CATEGORY_FILTER_OPTIONS = [
  { label: 'Todas as categorias', value: '' },
  { label: 'Hatch', value: 'hatch' },
  { label: 'SUV', value: 'suv' },
  { label: 'Sedan', value: 'sedan' },
  { label: 'Minivan', value: 'minivan' },
]

const SORT_OPTIONS = [
  { label: 'Menor preço', value: 'price-asc' },
  { label: 'Maior preço', value: 'price-desc' },
]

// ─── Component ───────────────────────────────────────────────────────────────
export function HomePage() {
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('')
  const [sortOrder, setSortOrder] = useState('')

  useEffect(() => {
    let active = true

    listVehicles()
      .then((data) => {
        if (active) setVehicles(data)
      })
      .catch(() => {
        if (active) setLoadError('Não foi possível carregar os veículos agora.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  function handleCategoryIconClick(value: string) {
    setActiveCategory(activeCategory === value ? '' : value)
  }

  function handleFilterCategoryChange(value: string) {
    setSelectedFilterCategory(value)
  }

  // Filter + sort vehicles
  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesCategory = selectedFilterCategory
      ? vehicle.category === selectedFilterCategory
      : true
    return matchesCategory && matchesVehicleFeature(vehicle, activeCategory)
  }).sort((a, b) => {
    if (sortOrder === 'price-asc') return a.pricePerDay - b.pricePerDay
    if (sortOrder === 'price-desc') return b.pricePerDay - a.pricePerDay
    return 0
  })

  return (
    <div className="min-h-screen flex flex-col bg-neutral-background">
      {/* ── Header ── */}
      <Header />

      {/* ── Search bar ── */}
      <CarSearchBar onSearch={(params) => navigate(`/carros${buildVehicleSearch(params)}`)} />

      {/* ── Hero banner ── */}
      <section className="relative bg-secondary-dark overflow-hidden min-h-[420px] md:min-h-[500px] flex items-center">
        <div className="absolute -left-24 -top-32 h-[360px] w-[360px] rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        {/* Background decorative car image */}
        <div className="absolute inset-0 flex items-center justify-end pointer-events-none">
          <img
            src={imgHeroBanner}
            alt=""
            aria-hidden="true"
            className="h-full w-auto max-w-[72%] object-cover object-left opacity-90"
          />
          {/* Gradient overlay so text stays legible */}
          <div className="absolute inset-0 bg-gradient-to-r from-secondary-dark via-secondary-dark/90 to-secondary-dark/10" />
        </div>

        {/* Hero text */}
        <div className="relative max-w-[1480px] mx-auto w-full px-md md:px-lg py-xl">
          <div className="max-w-[650px]">
            <p className="mb-md font-exo text-body-sm font-bold uppercase tracking-[0.24em] text-primary">
              Mobilidade do seu jeito
            </p>
            <h1 className="font-exo font-extrabold text-heading-md md:text-[58px] lg:text-[72px] leading-[1.05] tracking-[-0.04em] text-white">
              Seu caminho começa com o <span className="text-primary">carro certo.</span>
            </h1>
            <p className="mt-lg max-w-[520px] font-inter text-body-lg leading-relaxed text-white/75">
              Escolha, reserve e siga viagem com praticidade, segurança e transparência.
            </p>
          </div>
        </div>
      </section>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-[1480px] mx-auto w-full px-md md:px-lg py-xl flex flex-col gap-xl">

        {/* ── Category icons filter ── */}
        <section className="flex flex-col gap-md">
          <h2 className="font-exo font-bold text-heading-xs text-secondary">
            Filtrar por características
          </h2>
          <div className="flex flex-wrap gap-xs">
            {CATEGORY_ICONS.map((cat) => (
              <CategoryIcon
                key={cat.value}
                label={cat.label}
                icon={cat.icon}
                active={activeCategory === cat.value}
                onClick={() => handleCategoryIconClick(cat.value)}
              />
            ))}
          </div>
        </section>

        {/* ── Vehicles section ── */}
        <section className="flex flex-col gap-lg">
          {/* Section header with filters */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md">
            <h2 className="font-exo font-bold text-heading-xs text-secondary">
              Veículos disponíveis
            </h2>
            <div className="flex gap-md flex-wrap">
              <Filter
                label="Selecione a categoria"
                options={CATEGORY_FILTER_OPTIONS}
                value={selectedFilterCategory}
                onChange={handleFilterCategoryChange}
                className="w-[220px]"
              />
              <Filter
                label="Ordenar por"
                options={SORT_OPTIONS}
                value={sortOrder}
                onChange={setSortOrder}
                className="w-[180px]"
              />
            </div>
          </div>

          {/* Vehicle grid */}
          {loading ? (
            <p className="font-inter text-body-md text-neutral-text">Carregando veículos...</p>
          ) : loadError ? (
            <p className="font-inter text-body-md text-neutral-text">{loadError}</p>
          ) : filteredVehicles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-lg">
              {filteredVehicles.map((vehicle) => (
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
            <div className="flex flex-col items-center justify-center py-xl gap-md text-neutral-text">
              <span className="material-icons text-[64px] text-neutral-details">
                directions_car
              </span>
              <p className="font-inter text-body-lg">
                Nenhum veículo encontrado para essa categoria.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* ── Footer ── */}
      <Footer />

    </div>
  )
}
