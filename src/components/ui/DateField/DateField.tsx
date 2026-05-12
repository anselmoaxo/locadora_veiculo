import { InputHTMLAttributes, forwardRef } from 'react'

interface DateFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  onWhite?: boolean
}

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  ({ onWhite = false, className = '', ...props }, ref) => {
    const borderColor = onWhite
      ? 'border-neutral-details hover:border-primary focus-within:border-primary'
      : 'border-white hover:border-neutral-background focus-within:border-neutral-background'
    const textColor = onWhite ? 'text-neutral-text' : 'text-white'

    return (
      <div
        className={`flex items-center gap-xs border rounded-xs px-md py-sm transition-all duration-150 ${borderColor} ${className}`}
      >
        <span className={`material-icons text-[20px] shrink-0 ${textColor}`}>
          calendar_month
        </span>
        <input
          ref={ref}
          type="date"
          className={`font-inter text-body-md outline-none bg-transparent ${textColor} [color-scheme:dark] w-full`}
          {...props}
        />
      </div>
    )
  },
)

DateField.displayName = 'DateField'
