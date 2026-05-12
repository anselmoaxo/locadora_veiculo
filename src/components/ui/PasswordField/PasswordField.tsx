import { InputHTMLAttributes, forwardRef, useState } from 'react'

interface PasswordFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    const inputId = id ?? 'password-field'

    return (
      <div className={`flex flex-col gap-xxs ${className}`}>
        {label && (
          <label htmlFor={inputId} className="font-inter text-body-md text-neutral-text">
            {label}
          </label>
        )}
        <div
          className={`flex items-center gap-xs border rounded-xs px-md py-sm transition-all duration-150 ${
            error
              ? 'border-feedback-negative'
              : 'border-neutral-text hover:border-primary focus-within:border-primary'
          }`}
        >
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            className="flex-1 font-inter text-body-md text-neutral-text placeholder:text-neutral-text/60 outline-none bg-transparent"
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="material-icons text-[20px] text-neutral-text cursor-pointer hover:text-primary transition-colors"
            tabIndex={-1}
          >
            {visible ? 'visibility_off' : 'visibility'}
          </button>
        </div>
        {error && (
          <span className="font-inter text-body-sm text-feedback-negative">{error}</span>
        )}
      </div>
    )
  },
)

PasswordField.displayName = 'PasswordField'
