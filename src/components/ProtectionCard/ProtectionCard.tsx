import { Button } from '../ui/Button'

type ProtectionTier = 'basic' | 'standard' | 'advanced'

interface ProtectionFeature {
  label: string
}

interface ProtectionCardProps {
  tier: ProtectionTier
  title: string
  pricePerDay: number
  features: ProtectionFeature[]
  onAdd?: () => void
  selected?: boolean
  className?: string
}

const tierConfig: Record<ProtectionTier, { accent: string }> = {
  basic: { accent: 'text-neutral-text' },
  standard: { accent: 'text-primary' },
  advanced: { accent: 'text-secondary' },
}

export function ProtectionCard({
  tier,
  title,
  pricePerDay,
  features,
  onAdd,
  selected = false,
  className = '',
}: ProtectionCardProps) {
  const { accent } = tierConfig[tier]

  return (
    <article
      className={`bg-white rounded-xs shadow-elevation-1 flex flex-col gap-md p-md transition-shadow duration-200 hover:shadow-elevation-2 w-[336px] ${
        selected ? 'ring-2 ring-primary' : ''
      } ${className}`}
    >
      <div className="flex flex-col gap-xs">
        <h3 className={`font-exo font-bold text-heading-xs ${accent}`}>{title}</h3>
        <ul className="list-disc pl-md font-inter text-body-sm text-neutral-text flex flex-col gap-1">
          {features.map((f) => (
            <li key={f.label}>{f.label}</li>
          ))}
        </ul>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-1">
        <span className="font-exo font-bold text-heading-xs text-neutral-text">
          R${pricePerDay}
        </span>
        <span className="font-inter text-body-lg text-neutral-text">/diária</span>
      </div>

      <Button variant="primary" className="w-full" onClick={onAdd}>
        {selected ? 'Selecionado' : 'Adicionar'}
      </Button>
    </article>
  )
}
