import { InputHTMLAttributes, forwardRef } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const inputBase =
  'w-full border rounded-xs px-md py-sm font-inter text-body-md text-neutral-text placeholder:text-neutral-text/60 outline-none transition-all duration-150'

const inputStates =
  'border-neutral-text focus:border-primary hover:border-primary active:border-primary'

const inputError = 'border-feedback-negative focus:border-feedback-negative'

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className={`flex flex-col gap-xxs ${className}`}>
        {label && (
          <label htmlFor={inputId} className="font-inter text-body-md text-neutral-text">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`${inputBase} ${error ? inputError : inputStates}`}
          {...props}
        />
        {error && (
          <span className="font-inter text-body-sm text-feedback-negative">{error}</span>
        )}
      </div>
    )
  },
)

TextField.displayName = 'TextField'
