import { AnchorHTMLAttributes, ReactNode } from 'react'

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode
}

export function Link({ children, className = '', ...props }: LinkProps) {
  return (
    <a
      className={`font-inter text-body-md text-neutral-text underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:rounded-xs active:text-primary transition-colors duration-150 ${className}`}
      {...props}
    >
      {children}
    </a>
  )
}
