import { useState } from 'react'

interface FilterOption {
  label: string
  value: string
}

interface FilterProps {
  label?: string
  options: FilterOption[]
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export function Filter({
  label = 'Filtrar',
  options,
  value,
  onChange,
  className = '',
}: FilterProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(value ?? '')

  const selectedLabel = options.find((o) => o.value === selected)?.label

  function select(option: FilterOption) {
    setSelected(option.value)
    onChange?.(option.value)
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-xs border rounded-xs px-md py-sm w-full transition-all duration-150 border-neutral-details hover:border-primary ${
          open ? 'border-primary' : ''
        }`}
      >
        <span className="font-inter text-body-md text-neutral-text flex-1 text-left">
          {selectedLabel || label}
        </span>
        <span className="material-icons text-[20px] text-neutral-text shrink-0">
          {open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
        </span>
      </button>

      {open && (
        <ul className="absolute top-full left-0 right-0 z-50 bg-white border border-neutral-details rounded-xs shadow-elevation-2 mt-1 overflow-hidden">
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => select(option)}
                className={`w-full text-left px-md py-sm font-inter text-body-md hover:bg-neutral-background transition-colors ${
                  option.value === selected ? 'text-primary font-bold' : 'text-neutral-text'
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
