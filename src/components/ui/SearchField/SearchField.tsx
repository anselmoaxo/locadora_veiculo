import { InputHTMLAttributes, forwardRef } from 'react'

interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ placeholder = 'O que você procura?', className = '', ...props }, ref) => {
    return (
      <div
        className={`flex items-center gap-xs border border-neutral-details rounded-xs px-md py-sm hover:border-primary focus-within:border-primary transition-all duration-150 ${className}`}
      >
        <span className="material-icons text-[20px] text-neutral-text shrink-0">search</span>
        <input
          ref={ref}
          type="text"
          placeholder={placeholder}
          className="flex-1 font-inter text-body-md text-neutral-text placeholder:text-neutral-text/60 outline-none bg-transparent min-w-0"
          {...props}
        />
      </div>
    )
  },
)

SearchField.displayName = 'SearchField'
