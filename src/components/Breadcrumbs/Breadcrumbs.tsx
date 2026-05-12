interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-xs ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <span key={index} className="flex items-center gap-xs">
            {item.href && !isLast ? (
              <a
                href={item.href}
                className="font-inter text-body-md text-primary hover:underline underline-offset-2 transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <span
                className={`font-inter text-body-md ${
                  isLast ? 'text-neutral-text' : 'text-primary'
                }`}
              >
                {item.label}
              </span>
            )}
            {!isLast && (
              <span className="material-icons text-[16px] text-neutral-text">
                chevron_right
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
