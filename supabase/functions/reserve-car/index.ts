import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.3'
import { ulid } from 'npm:ulid@2.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type JsonRecord = Record<string, unknown>

interface ReservationRequest {
  car_id?: unknown
  start_at?: unknown
  end_at?: unknown
  pickup_location_id?: unknown
  dropoff_location_id?: unknown
  notes?: unknown
}

interface ReservationJobResult {
  job_id: string
  status: string
  reservation_id: string | null
  error_code: string | null
}

interface SupabaseError {
  code?: string
  message: string
}

// Logger with structured output
class Logger {
  private requestId: string
  private userId?: string

  constructor(requestId: string, userId?: string) {
    this.requestId = requestId
    this.userId = userId
  }

  private formatLog(level: string, message: string, data?: JsonRecord) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      function: 'reserve-car',
      request_id: this.requestId,
      user_id: this.userId,
      message,
      ...data,
    })
  }

  debug(message: string, data?: JsonRecord) {
    console.log(this.formatLog('DEBUG', message, data))
  }

  info(message: string, data?: JsonRecord) {
    console.log(this.formatLog('INFO', message, data))
  }

  warn(message: string, data?: JsonRecord) {
    console.warn(this.formatLog('WARN', message, data))
  }

  error(message: string, data?: JsonRecord) {
    console.error(this.formatLog('ERROR', message, data))
  }
}

function json(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

function requiredEnv(...names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name)
    if (value) return value
  }
  throw new Error(`Missing configuration: ${names.join(' or ')}`)
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new Error(`${field} must be a valid UUID`)
  }
  return value
}

function isoDate(value: unknown, field: string): { iso: string; timestamp: number } {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`)
  }
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    throw new Error(`${field} must be a valid ISO timestamp`)
  }
  return { iso: new Date(timestamp).toISOString(), timestamp }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function conflictDetails(startAt: string, endAt: string) {
  return { requested_window: { start_at: startAt, end_at: endAt } }
}

// Map PostgreSQL error codes to HTTP status and user-friendly messages
function mapDatabaseError(error: SupabaseError): {
  status: number
  code: string
  message: string
  details?: JsonRecord
} {
  const code = error.code || 'UNKNOWN'
  const msg = error.message || 'Unknown error'

  // Profile-related errors
  if (msg.includes('PROFILE_INCOMPLETE')) {
    return { status: 409, code: 'PROFILE_INCOMPLETE', message: 'Seu perfil está incompleto. Completa os dados antes de fazer uma reserva.' }
  }
  if (msg.includes('PROFILE_PENDING_APPROVAL')) {
    return {
      status: 409,
      code: 'PROFILE_PENDING_APPROVAL',
      message: 'Seu perfil está em análise. Você receberá um email quando for aprovado.',
    }
  }
  if (msg.includes('PROFILE_REJECTED')) {
    return { status: 409, code: 'PROFILE_REJECTED', message: 'Seu perfil foi reprovado. Entre em contato com o suporte.' }
  }
  if (msg.includes('DRIVER_LICENSE_EXPIRED')) {
    return { status: 409, code: 'DRIVER_LICENSE_EXPIRED', message: 'Sua CNH expirou. Atualize os dados antes de fazer uma reserva.' }
  }

  // Car availability errors
  if (code === '23P01' || msg.includes('CAR_UNAVAILABLE')) {
    return { status: 409, code: 'CAR_UNAVAILABLE', message: 'Veículo não está disponível para este período.' }
  }

  // Location errors
  if (msg.includes('LOCATION_UNAVAILABLE') || code === '23503') {
    return {
      status: 400,
      code: 'LOCATION_UNAVAILABLE',
      message: 'Uma ou ambas as localidades de retirada/devolução não estão disponíveis.',
    }
  }

  // Validation errors
  if (code === '22004') return { status: 400, code: 'MISSING_FIELDS', message: 'Faltam campos obrigatórios.' }
  if (code === '22007') return { status: 400, code: 'INVALID_PERIOD', message: 'Data e horário inválidos.' }
  if (code === '22023') return { status: 400, code: 'INVALID_DATA', message: 'Dados inválidos.' }
  if (code === '23514') return { status: 400, code: 'INVALID_STATE', message: 'Estado da reserva inválido.' }

  // Authorization errors
  if (code === '42501') return { status: 403, code: 'FORBIDDEN', message: 'Acesso negado.' }

  // Default
  return { status: 500, code, message: 'Erro ao processar a reserva. Tente novamente.' }
}

// Retry logic with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 500,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxAttempts) throw error
      const delay = baseDelay * Math.pow(2, attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error('Retry exhausted')
}

Deno.serve(async (request: Request) => {
  const requestId = request.headers.get('x-request-id') || ulid()
  const logger = new Logger(requestId)

  try {
    // CORS
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (request.method !== 'POST') {
      logger.warn('Invalid method', { method: request.method })
      return json(405, { error: 'METHOD_NOT_ALLOWED' })
    }

    logger.debug('Request received', { method: 'POST' })

    // Authentication
    const authorization = request.headers.get('authorization') ?? ''
    if (!/^Bearer\s+\S+$/i.test(authorization)) {
      logger.warn('Missing or invalid authorization header')
      return json(401, { error: 'AUTH_REQUIRED' })
    }

    // Idempotency
    const idempotencyKey = request.headers.get('idempotency-key')?.trim() ?? ''
    if (!idempotencyKey || idempotencyKey.length > 200) {
      logger.warn('Invalid idempotency key', { key_length: idempotencyKey.length })
      return json(400, { error: 'INVALID_IDEMPOTENCY_KEY' })
    }

    // Parse body
    let body: ReservationRequest
    try {
      body = await request.json()
    } catch {
      logger.warn('Failed to parse JSON')
      return json(400, { error: 'INVALID_JSON' })
    }

    logger.debug('Request parsed', { idempotency_key: idempotencyKey })

    // Validate input
    const carId = optionalUuid(body.car_id, 'car_id')
    if (!carId) {
      logger.warn('Missing car_id')
      return json(400, { error: 'CAR_ID_REQUIRED' })
    }

    const start = isoDate(body.start_at, 'start_at')
    const end = isoDate(body.end_at, 'end_at')
    const pickupLocationId = optionalUuid(body.pickup_location_id, 'pickup_location_id')
    const dropoffLocationId = optionalUuid(body.dropoff_location_id, 'dropoff_location_id')

    if (start.timestamp >= end.timestamp) {
      logger.warn('Invalid reservation period', { start_at: start.iso, end_at: end.iso })
      return json(400, { error: 'INVALID_RESERVATION_PERIOD' })
    }

    if (start.timestamp < Date.now() - 5 * 60_000) {
      logger.warn('Start date in the past', { start_at: start.iso })
      return json(400, { error: 'START_AT_IN_THE_PAST' })
    }

    const durationMs = end.timestamp - start.timestamp
    if (durationMs < 60 * 60_000) {
      logger.warn('Duration too short', { duration_hours: durationMs / 3600000 })
      return json(400, { error: 'MINIMUM_DURATION_IS_ONE_HOUR' })
    }

    if (durationMs > 90 * 24 * 60 * 60_000) {
      logger.warn('Duration too long', { duration_days: durationMs / 86400000 })
      return json(400, { error: 'MAXIMUM_DURATION_IS_90_DAYS' })
    }

    const notes = body.notes === undefined || body.notes === null ? null : String(body.notes).trim()
    if (notes && notes.length > 2000) {
      logger.warn('Notes too long', { length: notes.length })
      return json(400, { error: 'NOTES_TOO_LONG' })
    }

    logger.debug('Input validation passed', { car_id: carId })

    // Build canonical payload
    const canonicalPayload = JSON.stringify({
      car_id: carId,
      start_at: start.iso,
      end_at: end.iso,
      pickup_location_id: pickupLocationId,
      dropoff_location_id: dropoffLocationId,
      notes: notes || null,
    })
    const payloadHash = await sha256(canonicalPayload)

    // Create Supabase client
    const supabase = createClient(
      requiredEnv('SUPABASE_URL'),
      requiredEnv('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'),
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    )

    // Verify auth
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      logger.warn('Auth verification failed')
      return json(401, { error: 'INVALID_OR_EXPIRED_TOKEN' })
    }

    const userId = authData.user.id
    logger.userId = userId
    logger.info('User authenticated', { user_id: userId })

    // Call RPC with retry logic
    let data: ReservationJobResult[] | null = null
    let rpcError: SupabaseError | null = null

    try {
      await retryWithBackoff(async () => {
        const result = await supabase.rpc('enqueue_reservation_job', {
          p_car_id: carId,
          p_start_at: start.iso,
          p_end_at: end.iso,
          p_pickup_location_id: pickupLocationId,
          p_dropoff_location_id: dropoffLocationId,
          p_notes: notes || null,
          p_idempotency_key: idempotencyKey,
          p_payload_hash: payloadHash,
        })
        data = result.data
        rpcError = result.error
        if (result.error) throw result.error
      }, 3, 500)

      logger.info('RPC call succeeded', { job_id: data?.[0]?.job_id })
    } catch (error) {
      if (rpcError) {
        logger.warn('RPC call failed', {
          error_code: rpcError.code,
          error_message: rpcError.message,
        })
        const mapped = mapDatabaseError(rpcError)
        return json(mapped.status, {
          error: mapped.code,
          message: mapped.message,
          details: mapped.details,
          request_id: requestId,
        })
      }

      logger.error('Retry exhausted', { error: error instanceof Error ? error.message : 'Unknown' })
      return json(503, { error: 'SERVICE_TEMPORARILY_UNAVAILABLE', request_id: requestId })
    }

    const result = data?.[0]
    if (!result) {
      logger.error('Empty response from RPC')
      return json(500, { error: 'INTERNAL_ERROR', request_id: requestId })
    }

    const statusCode = result.status === 'succeeded' ? 200 : 202
    logger.info('Request completed successfully', {
      status_code: statusCode,
      job_status: result.status,
    })

    return json(statusCode, { ...result, request_id: requestId })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'

    if (/must be|required|valid UUID/.test(errorMsg)) {
      logger.warn('Validation error', { message: errorMsg })
      return json(400, { error: errorMsg, request_id: requestId })
    }

    logger.error('Unhandled exception', { error: errorMsg })
    return json(500, { error: 'INTERNAL_ERROR', request_id: requestId })
  }
})
