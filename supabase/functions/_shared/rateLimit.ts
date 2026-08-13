interface RpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{
    data: Array<{ allowed: boolean; remaining: number; retry_after_seconds: number }> | null
    error: { message: string } | null
  }>
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function consumeRateLimit(
  client: RpcClient,
  options: { scope: string; key: string; limit: number; windowSeconds: number },
) {
  const { data, error } = await client.rpc('consume_edge_rate_limit', {
    p_scope: options.scope,
    p_key_hash: await sha256(options.key),
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  })

  if (error) throw new Error(`RATE_LIMIT_UNAVAILABLE: ${error.message}`)
  const result = data?.[0]
  if (!result) throw new Error('RATE_LIMIT_UNAVAILABLE: empty response')
  return result
}
