import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.3'
import { Logger } from '../_shared/logger.ts'
import { consumeRateLimit } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function json(status: number, body: Record<string, unknown>, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
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
  const serviceClient = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const logger = new Logger('reserve-status', requestId, undefined, serviceClient)

  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'GET') return json(405, { error: 'METHOD_NOT_ALLOWED' })

  const authorization = request.headers.get('authorization') ?? ''
  if (!/^Bearer\s+\S+$/i.test(authorization)) return json(401, { error: 'AUTH_REQUIRED' })

  const jobId = new URL(request.url).searchParams.get('job_id')?.trim()
  if (!jobId) return json(400, { error: 'JOB_ID_REQUIRED' })

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
  logger.setUserId(authData.user.id)

  try {
    const rateLimit = await consumeRateLimit(serviceClient, {
      scope: 'reserve-status:user',
      key: authData.user.id,
      limit: 120,
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
      }, { 'Retry-After': String(rateLimit.retry_after_seconds) })
    }
  } catch (error) {
    await logger.persist('ERROR', 'Rate limiter unavailable', {
      errorCode: 'RATE_LIMIT_UNAVAILABLE',
      errorDetails: { message: error instanceof Error ? error.message : 'Unknown error' },
    })
    return json(503, { error: 'SERVICE_TEMPORARILY_UNAVAILABLE', request_id: requestId })
  }

  const { data, error } = await supabase
    .from('reservation_jobs')
    .select('id,status,reservation_id,result,error_code,attempts,max_attempts,created_at,updated_at')
    .eq('id', jobId)
    .maybeSingle()

  if (error) {
    await logger.persist('ERROR', 'Reservation status query failed', {
      errorCode: error.code,
      errorDetails: { message: error.message },
    })
    return json(500, { error: 'INTERNAL_ERROR', request_id: requestId })
  }
  if (!data) return json(404, { error: 'JOB_NOT_FOUND' })

  logger.info('Reservation status returned', { job_id: data.id, job_status: data.status })
  return json(200, {
    job_id: data.id,
    status: data.status,
    reservation_id: data.reservation_id,
    result: data.result,
    error_code: data.error_code,
    attempts: data.attempts,
    max_attempts: data.max_attempts,
    created_at: data.created_at,
    updated_at: data.updated_at,
    request_id: requestId,
  })
})
