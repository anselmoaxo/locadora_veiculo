interface CategoryIconProps {
  label: string
  icon: string
  active?: boolean
  onClick?: () => void
  className?: string
}

export function CategoryIcon({
  label,
  icon,
  active = false,
  onClick,
  className = '',
}: CategoryIconProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-xs p-xs rounded-xs transition-all duration-150 cursor-pointer w-[88px] h-[88px] ${
        active
          ? 'bg-primary text-white'
          : 'bg-white text-neutral-text border border-neutral-details hover:border-primary hover:text-primary'
      } ${className}`}
    >
      <span className="material-icons text-[32px]">{icon}</span>
      <span className="font-inter text-body-sm text-center leading-tight">{label}</span>
    </button>
  )
}

export const CATEGORY_ICONS = [
  { value: 'ac', label: 'AC', icon: 'ac_unit' },
  { value: 'lock', label: 'Trava', icon: 'lock' },
  { value: 'electric', label: 'Elétrico', icon: 'electric_car' },
  { value: 'abs', label: 'Freio ABS', icon: 'settings' },
  { value: 'luggage-3', label: '3 malas', icon: 'luggage' },
  { value: 'luggage-2', label: '2 malas', icon: 'luggage' },
  { value: 'manual', label: 'Câmbio manual', icon: 'settings_input_component' },
  { value: 'steering', label: 'Direção', icon: 'circle' },
  { value: 'people-4', label: '4 pessoas', icon: 'group' },
  { value: 'people-5', label: '5 pessoas', icon: 'groups' },
] as const
