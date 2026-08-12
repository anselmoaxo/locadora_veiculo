import { supabase } from '../lib/supabase'

export interface VehicleRecord {
  id: string
  created_at: string
  marca: string | null
  modelo: string | null
  ano: number | null
  versao: string | null
  categoria: string | null
  cambio: string | null
  preco_diaria: number | null
  imagens: string[]
  ar_condicionado: boolean
  trava_eletrica: boolean
  eletrico: boolean
  freio_abs: boolean
  direcao_assistida: boolean
  capacidade_pessoas: number | null
  capacidade_malas: number | null
  ativo: boolean
  popularidade: number
  updated_at: string
  cor: string | null
  grupo: string | null
}

export interface VehicleFeature {
  icon: string
  label: string
}

export interface Vehicle extends VehicleRecord {
  title: string
  subtitle: string
  pricePerDay: number
  imageUrl?: string
  images: string[]
  features: VehicleFeature[]
  category: string
}

export interface AvailabilityPeriod {
  locationId?: string
  pickupDate?: string
  pickupTime?: string
  returnDate?: string
  returnTime?: string
}

const VEHICLE_COLUMNS = [
  'id',
  'created_at',
  'marca',
  'modelo',
  'ano',
  'versao',
  'categoria',
  'cambio',
  'preco_diaria',
  'imagens',
  'ar_condicionado',
  'trava_eletrica',
  'eletrico',
  'freio_abs',
  'direcao_assistida',
  'capacidade_pessoas',
  'capacidade_malas',
  'ativo',
  'popularidade',
  'updated_at',
  'cor',
  'grupo',
].join(',')

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function toIso(date?: string, time?: string, endOfDay = false): string | null {
  if (!date) return null
  const resolvedTime = time || (endOfDay ? '23:59' : '00:00')
  const parsed = new Date(`${date}T${resolvedTime}:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function toVehicle(record: VehicleRecord): Vehicle {
  const category = record.categoria ?? 'outros'
  const titleParts = [record.marca, record.modelo, record.versao, record.ano]
  const title = titleParts.filter(Boolean).join(' ')
  const subtitleParts = [titleCase(category)]

  if (record.cambio) subtitleParts.push(`Câmbio ${record.cambio}`)

  const features: VehicleFeature[] = []
  if (record.ar_condicionado) features.push({ icon: 'ac_unit', label: 'Ar cond.' })
  if (record.trava_eletrica) features.push({ icon: 'lock', label: 'Travas' })
  if (record.eletrico) features.push({ icon: 'electric_car', label: 'Elétrico' })
  if (record.freio_abs) features.push({ icon: 'settings', label: 'Freio ABS' })
  if (record.direcao_assistida) features.push({ icon: 'circle', label: 'Direção' })
  if (record.cambio) {
    features.push({ icon: 'settings_input_component', label: `Câmbio ${record.cambio}` })
  }
  if (record.capacidade_pessoas) {
    features.push({ icon: 'groups', label: `${record.capacidade_pessoas} pessoas` })
  }
  if (record.capacidade_malas !== null) {
    features.push({ icon: 'luggage', label: `${record.capacidade_malas} malas` })
  }

  const images = (record.imagens ?? []).filter(Boolean)

  return {
    ...record,
    title: title || 'Veículo',
    subtitle: subtitleParts.join(' — '),
    pricePerDay: Number(record.preco_diaria ?? 0),
    imageUrl: images[0],
    images,
    features,
    category,
  }
}

export async function listVehicles(period?: AvailabilityPeriod): Promise<Vehicle[]> {
  const pickup = toIso(period?.pickupDate, period?.pickupTime)
  const dropoff = toIso(period?.returnDate, period?.returnTime, true)
  const hasDateFilter = Boolean(period?.pickupDate || period?.returnDate)

  if (hasDateFilter && (!pickup || !dropoff || new Date(dropoff) <= new Date(pickup))) {
    throw new Error('Informe um período de retirada e devolução válido.')
  }

  if (pickup && dropoff) {
    const durationInDays = (new Date(dropoff).getTime() - new Date(pickup).getTime()) / 86_400_000
    if (durationInDays > 90) {
      throw new Error('A consulta de disponibilidade aceita períodos de até 90 dias.')
    }

    if (!period?.locationId) {
      throw new Error('Informe o local de retirada para consultar a disponibilidade.')
    }

    const { data, error } = await supabase
      .rpc('buscar_veiculos_disponiveis', {
        p_retirada: pickup,
        p_devolucao: dropoff,
        p_local_id: period.locationId,
      })
      .select(VEHICLE_COLUMNS)
      .order('popularidade', { ascending: false })

    if (error) throw error
    return ((data ?? []) as unknown as VehicleRecord[]).map(toVehicle)
  }

  let query = supabase
    .from('catalogo_veiculos')
    .select(VEHICLE_COLUMNS)
    .eq('ativo', true)
    .order('popularidade', { ascending: false })

  if (period?.locationId) query = query.eq('local_id', period.locationId)

  const { data, error } = await query

  if (error) throw error
  return ((data ?? []) as unknown as VehicleRecord[]).map(toVehicle)
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from('catalogo_veiculos')
    .select(VEHICLE_COLUMNS)
    .eq('id', id)
    .eq('ativo', true)
    .maybeSingle()

  if (error) throw error
  return data ? toVehicle(data as unknown as VehicleRecord) : null
}

export function matchesVehicleFeature(vehicle: Vehicle, feature: string): boolean {
  const normalizedTransmission = vehicle.cambio?.toLowerCase() ?? ''

  const filters: Record<string, boolean> = {
    ac: vehicle.ar_condicionado,
    lock: vehicle.trava_eletrica,
    electric: vehicle.eletrico,
    abs: vehicle.freio_abs,
    'luggage-3': vehicle.capacidade_malas === 3,
    'luggage-2': vehicle.capacidade_malas === 2,
    manual: normalizedTransmission.includes('manual'),
    steering: vehicle.direcao_assistida,
    'people-4': vehicle.capacidade_pessoas === 4,
    'people-5': vehicle.capacidade_pessoas === 5,
  }

  return !feature || Boolean(filters[feature])
}

export function buildVehicleSearch(
  params: AvailabilityPeriod & { location?: string; locationId?: string },
): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}
