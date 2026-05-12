import { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ghost-google'
type ButtonSize = 'md' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xs font-inter text-body-md transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-dark active:bg-primary-dark focus:ring-primary',
  secondary:
    'bg-secondary text-white hover:bg-secondary-dark active:bg-secondary-dark focus:ring-secondary',
  ghost:
    'bg-transparent text-neutral-text border border-neutral-details hover:bg-neutral-divisor active:bg-neutral-divisor focus:ring-neutral-text',
  'ghost-google':
    'bg-white text-neutral-text border border-neutral-details hover:bg-neutral-background active:bg-neutral-divisor focus:ring-neutral-text',
}

const sizes: Record<ButtonSize, string> = {
  md: 'px-md py-sm',
  sm: 'px-xs py-xs text-body-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="material-icons text-[20px]">{icon}</span>}
      {children}
    </button>
  )
}
