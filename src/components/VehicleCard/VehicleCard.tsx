import { Button } from '../ui/Button'

type CardSize = 'lg' | 'sm'

interface VehicleCardProps {
  size?: CardSize
  title: string
  subtitle?: string
  pricePerDay: number
  imageUrl?: string
  onDetailsClick?: () => void
  className?: string
}

export function VehicleCard({
  size = 'lg',
  title,
  subtitle,
  pricePerDay,
  imageUrl,
  onDetailsClick,
  className = '',
}: VehicleCardProps) {
  const isLg = size === 'lg'

  return (
    <article
      className={`bg-white rounded-xs shadow-elevation-2 flex flex-col items-center gap-md p-lg transition-shadow duration-200 hover:shadow-elevation-3 w-full ${className}`}
    >
      {/* Image */}
      <div
        className={`bg-neutral-divisor rounded-xs overflow-hidden shrink-0 flex items-center justify-center w-full ${
          isLg ? 'h-[160px]' : 'h-[140px]'
        }`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <span className="material-icons text-[48px] text-neutral-details">
            directions_car
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-md w-full">
        <div className="flex flex-col gap-xs">
          <h3
            className={`font-inter text-neutral-black leading-[1.25] ${
              isLg ? 'text-body-lg' : 'text-body-md'
            }`}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="font-inter text-body-md text-neutral-black">{subtitle}</p>
          )}
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="font-exo font-bold text-heading-xs text-neutral-black">
            R${pricePerDay}
          </span>
          <span className="font-inter text-body-lg text-neutral-black">/diária</span>
        </div>

        {/* CTA */}
        <Button variant="primary" className="w-full" onClick={onDetailsClick}>
          Ver detalhes
        </Button>
      </div>
    </article>
  )
}
