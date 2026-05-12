import { ButtonHTMLAttributes } from 'react'

type Direction = 'left' | 'right'

interface IconArrowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  direction?: Direction
}

export function IconArrowButton({
  direction = 'right',
  className = '',
  ...props
}: IconArrowButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center w-8 h-8 rounded-xs text-neutral-text border border-neutral-details hover:bg-neutral-divisor active:bg-neutral-divisor focus:outline-none focus:ring-2 focus:ring-neutral-text transition-all duration-150 cursor-pointer ${className}`}
      {...props}
    >
      <span className="material-icons text-[20px]">
        {direction === 'right' ? 'arrow_forward' : 'arrow_back'}
      </span>
    </button>
  )
}
