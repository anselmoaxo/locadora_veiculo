import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
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

interface ReservationResult {
  reservation_id: string
  car_id: string
  start_at: string
  end_at: string
  status: string
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
    throw new Error(`${field} must be a valid UUID.`)
  }
  return value
}

function isoDate(value: unknown, field: string): { iso: string; timestamp: number } {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`)
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) throw new Error(`${field} must be a valid ISO timestamp.`)
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

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })

  const authorization = request.headers.get('authorization') ?? ''
  if (!/^Bearer\s+\S+$/i.test(authorization)) return json(401, { error: 'AUTH_REQUIRED' })

  const idempotencyKey = request.headers.get('idempotency-key')?.trim() ?? ''
  if (!idempotencyKey || idempotencyKey.length > 200) {
    return json(400, { error: 'INVALID_IDEMPOTENCY_KEY' })
  }

  let body: ReservationRequest
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'INVALID_JSON' })
  }

  try {
    const carId = optionalUuid(body.car_id, 'car_id')
    if (!carId) return json(400, { error: 'CAR_ID_REQUIRED' })

    const start = isoDate(body.start_at, 'start_at')
    const end = isoDate(body.end_at, 'end_at')
    const pickupLocationId = optionalUuid(body.pickup_location_id, 'pickup_location_id')
    const dropoffLocationId = optionalUuid(body.dropoff_location_id, 'dropoff_location_id')

    if (start.timestamp >= end.timestamp) {
      return json(400, { error: 'INVALID_RESERVATION_PERIOD' })
    }
    if (start.timestamp < Date.now() - 5 * 60_000) {
      return json(400, { error: 'START_AT_IN_THE_PAST' })
    }
    if (end.timestamp - start.timestamp < 60 * 60_000) {
      return json(400, { error: 'MINIMUM_DURATION_IS_ONE_HOUR' })
    }
    if (end.timestamp - start.timestamp > 90 * 24 * 60 * 60_000) {
      return json(400, { error: 'MAXIMUM_DURATION_IS_90_DAYS' })
    }

    const notes = body.notes === undefined || body.notes === null ? null : String(body.notes).trim()
    if (notes && notes.length > 2000) return json(400, { error: 'NOTES_TOO_LONG' })

    const canonicalPayload = JSON.stringify({
      car_id: carId,
      start_at: start.iso,
      end_at: end.iso,
      pickup_location_id: pickupLocationId,
      dropoff_location_id: dropoffLocationId,
      notes: notes || null,
    })
    const payloadHash = await sha256(canonicalPayload)

    const supabase = createClient(
      requiredEnv('SUPABASE_URL'),
      requiredEnv('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'),
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    )

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return json(401, { error: 'INVALID_OR_EXPIRED_TOKEN' })

    const { data, error } = await supabase.rpc('reserve_car_atomic', {
      p_car_id: carId,
      p_start_at: start.iso,
      p_end_at: end.iso,
      p_pickup_location_id: pickupLocationId,
      p_dropoff_location_id: dropoffLocationId,
      p_notes: notes || null,
      p_idempotency_key: idempotencyKey,
      p_payload_hash: payloadHash,
    })

    if (error) {
      const profileErrors = [
        'PROFILE_INCOMPLETE',
        'PROFILE_PENDING_APPROVAL',
        'PROFILE_REJECTED',
        'DRIVER_LICENSE_EXPIRED',
      ]
      const profileError = profileErrors.find((code) => error.message.includes(code))
      if (profileError) return json(409, { error: profileError })
      if (error.code === '23P01' || error.message.includes('CAR_UNAVAILABLE')) {
        return json(409, { error: 'CAR_UNAVAILABLE', details: conflictDetails(start.iso, end.iso) })
      }
      if (error.code === '42501') return json(403, { error: 'FORBIDDEN' })
      if (['22004', '22007', '22023', '23503', '23514'].includes(error.code ?? '')) {
        return json(400, { error: error.message })
      }
      console.error('reserve_car_atomic failed', { code: error.code, message: error.message })
      return json(500, { error: 'INTERNAL_ERROR' })
    }

    const result = (data as ReservationResult[] | null)?.[0]
    if (!result) return json(500, { error: 'INTERNAL_ERROR' })
    return json(201, result)
  } catch (error) {
    if (error instanceof Error && /must be|required|valid UUID/.test(error.message)) {
      return json(400, { error: error.message })
    }
    console.error('reserve-car failed', error instanceof Error ? error.message : 'Unknown error')
    return json(500, { error: 'INTERNAL_ERROR' })
  }
})
