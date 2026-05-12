import { useState } from 'react'

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, '0')
  return `${h}:00`
})

interface TimeDropdownProps {
  value?: string
  onChange?: (value: string) => void
  onWhite?: boolean
  className?: string
}

export function TimeDropdown({
  value,
  onChange,
  onWhite = false,
  className = '',
}: TimeDropdownProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(value ?? '')

  const borderColor = onWhite
    ? 'border-neutral-details hover:border-primary'
    : 'border-white hover:border-neutral-background'
  const textColor = onWhite ? 'text-neutral-text' : 'text-white'

  function select(hour: string) {
    setSelected(hour)
    onChange?.(hour)
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-xs border rounded-xs px-md py-sm w-full transition-all duration-150 ${borderColor} ${open ? (onWhite ? 'border-primary' : 'border-neutral-background') : ''}`}
      >
        <span className={`font-inter text-body-md flex-1 text-left ${textColor}`}>
          {selected || 'Horário'}
        </span>
        <span className={`material-icons text-[20px] shrink-0 ${textColor}`}>
          {open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
        </span>
      </button>

      {open && (
        <ul className="absolute top-full left-0 right-0 z-50 bg-white border border-neutral-details rounded-xs shadow-elevation-2 max-h-48 overflow-y-auto mt-1">
          {HOURS.map((hour) => (
            <li key={hour}>
              <button
                type="button"
                onClick={() => select(hour)}
                className={`w-full text-left px-md py-sm font-inter text-body-md hover:bg-neutral-background transition-colors ${
                  hour === selected ? 'text-primary font-bold' : 'text-neutral-text'
                }`}
              >
                {hour}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
