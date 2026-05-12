import { useState } from 'react'
import { LocationField } from '../ui/LocationField'
import { DateField } from '../ui/DateField'
import { TimeDropdown } from '../ui/TimeDropdown'
import { Button } from '../ui/Button'

interface CarSearchBarProps {
  onSearch?: (params: {
    location: string
    pickupDate: string
    pickupTime: string
    returnDate: string
    returnTime: string
  }) => void
}

export function CarSearchBar({ onSearch }: CarSearchBarProps) {
  const [location, setLocation] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [returnTime, setReturnTime] = useState('')
  const [expanded, setExpanded] = useState(false)

  function handleSearch() {
    onSearch?.({ location, pickupDate, pickupTime, returnDate, returnTime })
  }

  return (
    <section className="bg-primary-dark py-xl px-md">
      <div className="max-w-[1480px] mx-auto">
        {/* Mobile collapsed */}
        <div className="md:hidden flex flex-col gap-md">
          <LocationField
            value={location}
            onChange={(e) => setLocation(e.target.value)}
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
          <Button variant="secondary" className="w-full" onClick={handleSearch}>
            Buscar
          </Button>
        </div>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-md flex-wrap">
          <LocationField
            value={location}
            onChange={(e) => setLocation(e.target.value)}
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
          <Button variant="secondary" onClick={handleSearch}>
            Buscar
          </Button>
        </div>
      </div>
    </section>
  )
}
