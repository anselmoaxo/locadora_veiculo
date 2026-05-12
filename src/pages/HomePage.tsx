import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { CarSearchBar } from '../components/CarSearchBar'
import { VehicleCard } from '../components/VehicleCard'
import { CategoryIcon, CATEGORY_ICONS } from '../components/CategoryIcon'
import { Filter } from '../components/ui/Filter'

// ─── Figma asset URLs (valid for 7 days) ────────────────────────────────────
const imgHb20 = 'https://www.figma.com/api/mcp/asset/29d2a928-abca-4e2e-9b27-aafbd5cbb9a5'
const imgHondaCity = 'https://www.figma.com/api/mcp/asset/243f836a-dc53-4554-9077-44072d0f2d73'
const imgRenegade = 'https://www.figma.com/api/mcp/asset/238d0c5d-fca0-45bd-b835-fa9935092b72'
const imgFiatCronos = 'https://www.figma.com/api/mcp/asset/43bc454e-f245-4eb9-9291-9d1dc352ce91'
const imgOnix = 'https://www.figma.com/api/mcp/asset/b594eb51-41b7-46c2-884f-2abbf26dc325'
const imgGmSpin = 'https://www.figma.com/api/mcp/asset/5f3e9d17-6c5d-48ac-b026-6155c911ab91'
const imgVwTCross = 'https://www.figma.com/api/mcp/asset/e4b03aed-90e5-4f25-a0ae-cd4ce4a96cf5'
const imgHondaCitySedan = 'https://www.figma.com/api/mcp/asset/5225a3b8-78b5-4322-984e-4677ef171f93'
const imgFiatMobi = 'https://www.figma.com/api/mcp/asset/97a84499-a24b-4d02-af5d-61df6b3d65dd'
const imgHeroBanner = 'https://www.figma.com/api/mcp/asset/2171eefa-6efb-4c88-942e-91998b95507e'

// ─── Mock vehicle data ───────────────────────────────────────────────────────
interface Vehicle {
  id: string
  title: string
  subtitle: string
  pricePerDay: number
  imageUrl: string
  category: string
}

const VEHICLES: Vehicle[] = [
  {
    id: '1',
    title: 'Hyundai HB20 1.0',
    subtitle: 'Hatch Manual',
    pricePerDay: 120,
    imageUrl: imgHb20,
    category: 'hatch',
  },
  {
    id: '2',
    title: 'Honda City',
    subtitle: 'Hatch Automático',
    pricePerDay: 130,
    imageUrl: imgHondaCity,
    category: 'hatch',
  },
  {
    id: '3',
    title: 'Jeep Renegade 1.3',
    subtitle: 'SUV Automático',
    pricePerDay: 140,
    imageUrl: imgRenegade,
    category: 'suv',
  },
  {
    id: '4',
    title: 'Fiat Cronos',
    subtitle: 'Sedan Manual',
    pricePerDay: 130,
    imageUrl: imgFiatCronos,
    category: 'sedan',
  },
  {
    id: '5',
    title: 'Onix LTZ 1.0',
    subtitle: 'Hatch Automático',
    pricePerDay: 130,
    imageUrl: imgOnix,
    category: 'hatch',
  },
  {
    id: '6',
    title: 'GM Spin 1.8',
    subtitle: 'Minivan Automática 7 Lugares',
    pricePerDay: 320,
    imageUrl: imgGmSpin,
    category: 'minivan',
  },
  {
    id: '7',
    title: 'VW T-Cross 1.0 Turbo',
    subtitle: 'SUV Automático',
    pricePerDay: 150,
    imageUrl: imgVwTCross,
    category: 'suv',
  },
  {
    id: '8',
    title: 'Honda City Sedan AT',
    subtitle: 'Intermediário Automático',
    pricePerDay: 150,
    imageUrl: imgHondaCitySedan,
    category: 'sedan',
  },
  {
    id: '9',
    title: 'Fiat Mobi 1.0',
    subtitle: 'Compacto com Ar',
    pricePerDay: 100,
    imageUrl: imgFiatMobi,
    category: 'hatch',
  },
]

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
  const [loggedIn, setLoggedIn] = useState(false)
  const [activeCategory, setActiveCategory] = useState('')
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('')
  const [sortOrder, setSortOrder] = useState('')

  function handleCategoryIconClick(value: string) {
    setActiveCategory(activeCategory === value ? '' : value)
    setSelectedFilterCategory(activeCategory === value ? '' : value)
  }

  function handleFilterCategoryChange(value: string) {
    setSelectedFilterCategory(value)
    setActiveCategory(value)
  }

  // Filter + sort vehicles
  const filteredVehicles = VEHICLES.filter((v) =>
    selectedFilterCategory ? v.category === selectedFilterCategory : true
  ).sort((a, b) => {
    if (sortOrder === 'price-asc') return a.pricePerDay - b.pricePerDay
    if (sortOrder === 'price-desc') return b.pricePerDay - a.pricePerDay
    return 0
  })

  return (
    <div className="min-h-screen flex flex-col bg-neutral-background">
      {/* ── Header ── */}
      <Header
        isLoggedIn={loggedIn}
        userName="João Silva"
        onLoginClick={() => navigate('/auth')}
        onRegisterClick={() => navigate('/auth?tab=register')}
        onLogoutClick={() => setLoggedIn(false)}
      />

      {/* ── Search bar ── */}
      <CarSearchBar onSearch={(p) => console.log('search', p)} />

      {/* ── Hero banner ── */}
      <section className="relative bg-secondary-dark overflow-hidden min-h-[380px] md:min-h-[460px] flex items-center">
        {/* Background decorative car image */}
        <div className="absolute inset-0 flex items-center justify-end pointer-events-none">
          <img
            src={imgHeroBanner}
            alt=""
            aria-hidden="true"
            className="h-full w-auto max-w-[65%] object-cover object-left"
          />
          {/* Gradient overlay so text stays legible */}
          <div className="absolute inset-0 bg-gradient-to-r from-secondary-dark via-secondary-dark/80 to-transparent" />
        </div>

        {/* Hero text */}
        <div className="relative max-w-[1480px] mx-auto w-full px-md md:px-lg py-xl">
          <h1 className="font-exo font-bold text-heading-md md:text-[56px] lg:text-[76px] leading-[1.25] max-w-[600px]">
            <span className="text-primary">Encontre o carro ideal</span>
            <span className="text-white"> para todas as ocasiões</span>
          </h1>
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
          {filteredVehicles.length > 0 ? (
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
