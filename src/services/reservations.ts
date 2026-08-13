import { supabase, supabasePublishableKey, supabaseUrl } from '../lib/supabase'

export interface RentalLocation {
  id: string
  codigo: string
  nome: string
  tipo: 'agencia' | 'aeroporto'
  cidade: string
  estado: string
}

export type ProtectionTier = 'basic' | 'standard' | 'advanced'

export interface ProtectionPlan {
  id: string
  tier: ProtectionTier
  title: string
  description: string | null
  pricePerDay: number
  features: Array<{ label: string }>
}

export interface ReservationResult {
  reserva_id: string
  codigo: string
  status: string
  quantidade_diarias: number
  valor_total: number
}

export interface CreateReservationInput {
  vehicleId: string
  pickupLocationId: string
  returnLocationId: string
  pickupAt: string
  returnAt: string
  protectionId: string | null
  fullName: string
  cpf: string
  phone: string
}

export interface ReserveCarInput {
  carId: string
  startAt: string
  endAt: string
  pickupLocationId?: string | null
  dropoffLocationId?: string | null
  notes?: string | null
}

export interface ReserveCarResult {
  reservation_id: string
  car_id: string
  start_at: string
  end_at: string
  status: 'pending' | string
}

export type ReservationJobStatus = 'pending' | 'processing' | 'succeeded' | 'failed'

export interface ReservationJobResult {
  job_id: string
  status: ReservationJobStatus
  reservation_id: string | null
  result?: ReserveCarResult | null
  error_code?: string | null
  attempts?: number
  max_attempts?: number
}

export interface MyReservationJob extends ReservationJobResult {
  car_id: string
  start_at: string
  end_at: string
  created_at: string
  updated_at: string
}

export type ReserveCarErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_OR_EXPIRED_TOKEN'
  | 'FORBIDDEN'
  | 'CAR_UNAVAILABLE'
  | 'INVALID_RESERVATION_PERIOD'
  | 'START_AT_IN_THE_PAST'
  | 'MINIMUM_DURATION_IS_ONE_HOUR'
  | 'MAXIMUM_DURATION_IS_90_DAYS'
  | 'LOCATION_UNAVAILABLE'
  | 'NOTES_TOO_LONG'
  | 'PROFILE_INCOMPLETE'
  | 'PROFILE_PENDING_APPROVAL'
  | 'PROFILE_REJECTED'
  | 'DRIVER_LICENSE_EXPIRED'
  | 'INTERNAL_ERROR'
  | string

interface ReserveCarErrorPayload {
  error?: string
  code?: string
  message?: string
  details?: unknown
}

export class ReserveCarError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ReserveCarErrorCode,
    public readonly details?: unknown,
  ) {
    super(reserveCarErrorMessage(status, code))
    this.name = 'ReserveCarError'
  }

  get retryable() {
    return this.status >= 500
  }
}

function reserveCarErrorMessage(status: number, code: string): string {
  const messages: Record<string, string> = {
    AUTH_REQUIRED: 'Entre na sua conta para reservar.',
    INVALID_OR_EXPIRED_TOKEN: 'Sua sessão expirou. Entre novamente para continuar.',
    FORBIDDEN: 'Sua conta não tem permissão para concluir esta reserva.',
    CAR_UNAVAILABLE: 'Esse carro não está disponível nesse período.',
    INVALID_RESERVATION_PERIOD: 'A devolução deve acontecer depois da retirada.',
    START_AT_IN_THE_PAST: 'A retirada precisa estar no futuro.',
    MINIMUM_DURATION_IS_ONE_HOUR: 'A reserva deve durar pelo menos 1 hora.',
    MAXIMUM_DURATION_IS_90_DAYS: 'O período informado ultrapassa o limite permitido.',
    LOCATION_UNAVAILABLE: 'O local escolhido não está disponível.',
    NOTES_TOO_LONG: 'As observações ultrapassam o limite permitido.',
    PROFILE_INCOMPLETE: 'Complete seu cadastro e informe uma CNH válida antes de reservar.',
    PROFILE_PENDING_APPROVAL: 'Seu cadastro ainda está aguardando aprovação do administrador.',
    PROFILE_REJECTED: 'Seu cadastro precisa ser corrigido e enviado novamente para análise.',
    DRIVER_LICENSE_EXPIRED: 'Sua CNH está vencida. Atualize o cadastro para continuar.',
    QUEUE_TIMEOUT: 'A reserva continua na fila. Consulte Minhas reservas em alguns instantes.',
  }
  return messages[code]
    ?? (status >= 500
      ? 'Não foi possível concluir agora. Tente novamente.'
      : 'Revise os dados da reserva e tente novamente.')
}

const reserveCarEndpoint = `${supabaseUrl}/functions/v1/reserve-car`
const reserveStatusEndpoint = `${supabaseUrl}/functions/v1/reserve-status`

export async function reserveCarAtomic(
  input: ReserveCarInput,
  idempotencyKey: string,
): Promise<ReservationJobResult> {
  const { data, error: sessionError } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (sessionError || !accessToken) throw new ReserveCarError(401, 'AUTH_REQUIRED')

  let response: Response
  try {
    response = await fetch(reserveCarEndpoint, {
      method: 'POST',
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        car_id: input.carId,
        start_at: input.startAt,
        end_at: input.endAt,
        pickup_location_id: input.pickupLocationId ?? null,
        dropoff_location_id: input.dropoffLocationId ?? null,
        notes: input.notes?.trim() || null,
      }),
    })
  } catch {
    throw new ReserveCarError(500, 'INTERNAL_ERROR')
  }

  const payload = await response.json().catch(() => ({})) as ReserveCarErrorPayload & Partial<ReservationJobResult>
  if (!response.ok) {
    const code = payload.error ?? payload.code ?? (response.status >= 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST')
    throw new ReserveCarError(response.status, code, payload.details)
  }

  if (!payload.job_id || !payload.status) {
    throw new ReserveCarError(500, 'INTERNAL_ERROR')
  }

  return {
    job_id: payload.job_id,
    status: payload.status,
    reservation_id: payload.reservation_id ?? null,
    result: payload.result ?? null,
    error_code: payload.error_code ?? null,
  }
}

export async function getReservationJob(jobId: string): Promise<ReservationJobResult> {
  const { data, error: sessionError } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (sessionError || !accessToken) throw new ReserveCarError(401, 'AUTH_REQUIRED')

  let response: Response
  try {
    response = await fetch(`${reserveStatusEndpoint}?job_id=${encodeURIComponent(jobId)}`, {
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    throw new ReserveCarError(500, 'INTERNAL_ERROR')
  }

  const payload = await response.json().catch(() => ({})) as ReserveCarErrorPayload & Partial<ReservationJobResult>
  if (!response.ok) {
    throw new ReserveCarError(response.status, payload.error ?? payload.code ?? 'INTERNAL_ERROR', payload.details)
  }
  if (!payload.job_id || !payload.status) throw new ReserveCarError(500, 'INTERNAL_ERROR')

  return {
    job_id: payload.job_id,
    status: payload.status,
    reservation_id: payload.reservation_id ?? null,
    result: payload.result ?? null,
    error_code: payload.error_code ?? null,
    attempts: payload.attempts,
    max_attempts: payload.max_attempts,
  }
}

export async function listMyReservationJobs(): Promise<MyReservationJob[]> {
  const { data, error } = await supabase
    .from('reservation_jobs')
    .select('id,car_id,start_at,end_at,status,reservation_id,result,error_code,attempts,max_attempts,created_at,updated_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((job) => ({
    job_id: job.id,
    car_id: job.car_id,
    start_at: job.start_at,
    end_at: job.end_at,
    status: job.status as ReservationJobStatus,
    reservation_id: job.reservation_id,
    result: job.result as ReserveCarResult | null,
    error_code: job.error_code,
    attempts: job.attempts,
    max_attempts: job.max_attempts,
    created_at: job.created_at,
    updated_at: job.updated_at,
  }))
}

export async function listLocations(): Promise<RentalLocation[]> {
  const { data, error } = await supabase
    .from('locais')
    .select('id,codigo,nome,tipo,cidade,estado')
    .eq('ativo', true)
    .order('nome')

  if (error) throw error
  return (data ?? []) as RentalLocation[]
}

export async function listProtectionPlans(): Promise<ProtectionPlan[]> {
  const { data, error } = await supabase
    .from('catalogo_protecoes')
    .select('id,slug,nome,descricao,preco_diaria,ordem,coberturas')
    .order('ordem')

  if (error) throw error

  return (data ?? []).flatMap((record) => {
    if (!['basic', 'standard', 'advanced'].includes(record.slug)) return []
    return [{
      id: record.id as string,
      tier: record.slug as ProtectionTier,
      title: record.nome as string,
      description: record.descricao as string | null,
      pricePerDay: Number(record.preco_diaria),
      features: ((record.coberturas as string[] | null) ?? []).map((label) => ({ label })),
    }]
  })
}

export function findLocationByName(locations: RentalLocation[], name: string) {
  const normalizedName = name.trim().toLocaleLowerCase('pt-BR')
  return locations.find((location) => location.nome.toLocaleLowerCase('pt-BR') === normalizedName)
}

export function toReservationIso(date: string, time: string): string | null {
  if (!date || !time) return null
  const parsed = new Date(`${date}T${time}:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export async function createReservation(
  input: CreateReservationInput,
): Promise<ReservationResult> {
  const { data, error } = await supabase.rpc('criar_reserva', {
    p_veiculo_id: input.vehicleId,
    p_local_retirada_id: input.pickupLocationId,
    p_local_devolucao_id: input.returnLocationId,
    p_retirada: input.pickupAt,
    p_devolucao: input.returnAt,
    p_protecao_id: input.protectionId,
    p_nome_completo: input.fullName,
    p_cpf: input.cpf,
    p_telefone: input.phone,
  })

  if (error) throw error
  const result = (data as ReservationResult[] | null)?.[0]
  if (!result) throw new Error('A reserva não retornou uma confirmação.')
  return { ...result, valor_total: Number(result.valor_total) }
}
