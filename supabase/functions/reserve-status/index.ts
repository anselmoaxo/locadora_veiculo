import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
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

  const { data, error } = await supabase
    .from('reservation_jobs')
    .select('id,status,reservation_id,result,error_code,attempts,max_attempts,created_at,updated_at')
    .eq('id', jobId)
    .maybeSingle()

  if (error) {
    console.error('reserve-status failed', { code: error.code, message: error.message })
    return json(500, { error: 'INTERNAL_ERROR' })
  }
  if (!data) return json(404, { error: 'JOB_NOT_FOUND' })

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
  })
})
