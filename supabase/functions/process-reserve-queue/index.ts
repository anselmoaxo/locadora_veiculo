import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.3'
import { Logger } from '../_shared/logger.ts'
import { consumeRateLimit } from '../_shared/rateLimit.ts'

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function requiredEnv(...names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name)
    if (value) return value
  }
  throw new Error(`Missing configuration: ${names.join(' or ')}`)
}

Deno.serve(async (request: Request) => {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })

  const authorization = request.headers.get('authorization') ?? ''
  if (!/^Bearer\s+\S+$/i.test(authorization)) return json(401, { error: 'AUTH_REQUIRED' })

  const userClient = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  )
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json(401, { error: 'INVALID_OR_EXPIRED_TOKEN' })

  const { data: isAdmin, error: adminError } = await userClient.rpc('is_vehicle_administrator')
  if (adminError || isAdmin !== true) return json(403, { error: 'FORBIDDEN' })

  const serviceClient = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const logger = new Logger('process-reserve-queue', requestId, userData.user.id, serviceClient)

  try {
    const rateLimit = await consumeRateLimit(serviceClient, {
      scope: 'process-reserve-queue:user',
      key: userData.user.id,
      limit: 10,
      windowSeconds: 60,
    })
    if (!rateLimit.allowed) {
      await logger.persist('WARN', 'Rate limit exceeded', {
        errorCode: 'RATE_LIMIT_EXCEEDED',
        metadata: { retry_after_seconds: rateLimit.retry_after_seconds },
      })
      return json(429, {
        error: 'RATE_LIMIT_EXCEEDED',
        retry_after_seconds: rateLimit.retry_after_seconds,
        request_id: requestId,
      })
    }
  } catch (error) {
    await logger.persist('ERROR', 'Rate limiter unavailable', {
      errorCode: 'RATE_LIMIT_UNAVAILABLE',
      errorDetails: { message: error instanceof Error ? error.message : 'Unknown error' },
    })
    return json(503, { error: 'SERVICE_TEMPORARILY_UNAVAILABLE', request_id: requestId })
  }

  const { data, error } = await serviceClient.rpc('process_reservation_queue', { p_limit: 10 })
  if (error) {
    await logger.persist('ERROR', 'Reservation queue processing failed', {
      errorCode: error.code,
      errorDetails: { message: error.message },
    })
    return json(500, { error: 'INTERNAL_ERROR', request_id: requestId })
  }

  logger.info('Reservation queue processed', { processed: data ?? 0 })
  return json(200, { processed: data ?? 0, request_id: requestId })
})
