import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.3'

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
  const { data, error } = await serviceClient.rpc('process_reservation_queue', { p_limit: 10 })
  if (error) {
    console.error('process-reserve-queue failed', { code: error.code, message: error.message })
    return json(500, { error: 'INTERNAL_ERROR' })
  }

  return json(200, { processed: data ?? 0 })
})
