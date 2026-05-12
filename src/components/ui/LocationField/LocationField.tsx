import { InputHTMLAttributes, forwardRef } from 'react'

interface LocationFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  onWhite?: boolean
}

export const LocationField = forwardRef<HTMLInputElement, LocationFieldProps>(
  ({ onWhite = false, className = '', ...props }, ref) => {
    const borderColor = onWhite
      ? 'border-neutral-details hover:border-primary focus-within:border-primary'
      : 'border-white hover:border-neutral-background focus-within:border-neutral-background'
    const textColor = onWhite ? 'text-neutral-text' : 'text-white'
    const placeholderColor = onWhite
      ? 'placeholder:text-neutral-text/60'
      : 'placeholder:text-white/70'

    return (
      <div
        className={`flex items-center gap-xs border rounded-xs px-md py-sm transition-all duration-150 ${borderColor} ${className}`}
      >
        <span className={`material-icons text-[20px] shrink-0 ${textColor}`}>location_on</span>
        <input
          ref={ref}
          type="text"
          placeholder="Local de retirada"
          className={`flex-1 font-inter text-body-md outline-none bg-transparent min-w-0 ${textColor} ${placeholderColor}`}
          {...props}
        />
      </div>
    )
  },
)

LocationField.displayName = 'LocationField'
