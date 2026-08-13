import { useEffect, useState } from 'react'
import { LocationField } from '../ui/LocationField'
import { DateField } from '../ui/DateField'
import { TimeDropdown } from '../ui/TimeDropdown'
import { Button } from '../ui/Button'
import { listLocations, type RentalLocation } from '../../services/reservations'

export interface CarSearchParams {
  location: string
  locationId: string
  pickupDate: string
  pickupTime: string
  returnDate: string
  returnTime: string
}

interface CarSearchBarProps {
  initialValues?: Partial<CarSearchParams>
  onSearch?: (params: CarSearchParams) => void
}

export function CarSearchBar({ initialValues, onSearch }: CarSearchBarProps) {
  const [location, setLocation] = useState(initialValues?.location ?? '')
  const [locationId, setLocationId] = useState(initialValues?.locationId ?? '')
  const [pickupDate, setPickupDate] = useState(initialValues?.pickupDate ?? '')
  const [pickupTime, setPickupTime] = useState(initialValues?.pickupTime ?? '')
  const [returnDate, setReturnDate] = useState(initialValues?.returnDate ?? '')
  const [returnTime, setReturnTime] = useState(initialValues?.returnTime ?? '')
  const [expanded, setExpanded] = useState(false)
  const [locations, setLocations] = useState<RentalLocation[]>([])

  useEffect(() => {
    let active = true
    listLocations()
      .then((locations) => {
        if (!active) return
        setLocations(locations)
        if (locations.length === 1) {
          setLocation((current) => current || locations[0].nome)
          setLocationId((current) => current || locations[0].id)
        }
      })
      .catch(() => setLocations([]))

    return () => {
      active = false
    }
  }, [])

  function handleLocationChange(value: string) {
    setLocation(value)
    const match = locations.find((item) => item.nome === value)
    setLocationId(match?.id ?? '')
  }

  function handleSearch() {
    onSearch?.({ location, locationId, pickupDate, pickupTime, returnDate, returnTime })
  }

  return (
    <section className="bg-gradient-to-br from-primary-dark to-primary py-lg px-md relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_85%_20%,white,transparent_32%)]" aria-hidden="true" />
      <div className="max-w-[1480px] mx-auto">
        <div className="relative mb-md text-white">
          <p className="font-inter text-body-sm font-bold uppercase tracking-[0.18em] text-white/75">Reserve seu carro</p>
          <h2 className="mt-xxs font-exo text-heading-sm font-extrabold">Onde começa a sua viagem?</h2>
        </div>
        {/* Mobile collapsed */}
        <div className="relative md:hidden flex flex-col gap-md rounded-modal bg-white p-md shadow-elevation-2">
          <LocationField
            value={location}
            options={locations.map((item) => item.nome)}
            onChange={(e) => handleLocationChange(e.target.value)}
            onFocus={() => setExpanded(true)}
            className='flex-2'
          />
          {expanded && (
            <>
              <div className="flex gap-md">
                <DateField
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="flex-1"
                  title="Retirada"
                />
                <TimeDropdown
                  value={pickupTime}
                  onChange={setPickupTime}
                  className="flex-1"
                />
              </div>
              <div className="flex gap-md">
                <DateField
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="flex-1"
                  title="Devolução"
                />
                <TimeDropdown
                  value={returnTime}
                  onChange={setReturnTime}
                  className="flex-1"
                />
              </div>
            </>
          )}
          <Button className="w-full" onClick={handleSearch} icon="search">
            Buscar carros
          </Button>
        </div>

        {/* Desktop */}
        <div className="relative hidden md:flex items-end gap-md flex-wrap rounded-modal bg-white p-md shadow-elevation-2">
          <LocationField
            value={location}
            options={locations.map((item) => item.nome)}
            onChange={(e) => handleLocationChange(e.target.value)}
            className="w-[220px] shrink-0"
          />
          <DateField
            value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
            className="flex-1 min-w-[160px]"
          />
          <TimeDropdown
            value={pickupTime}
            onChange={setPickupTime}
            className="w-[128px] shrink-0"
          />
          <DateField
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            className="flex-1 min-w-[160px]"
          />
          <TimeDropdown
            value={returnTime}
            onChange={setReturnTime}
            className="w-[128px] shrink-0"
          />
          <Button onClick={handleSearch} icon="search" className="min-h-[48px] px-lg">
            Buscar carros
          </Button>
        </div>
      </div>
    </section>
  )
}
