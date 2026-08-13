import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.3'
import { Logger } from '../_shared/logger.ts'
import { consumeRateLimit as consumeAtomicRateLimit } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
const bucket = 'vehicle-images'
const maximumFileSize = 5 * 1024 * 1024
const maximumTotalSize = 20 * 1024 * 1024
const maximumFiles = 5

type JsonRecord = Record<string, unknown>

type UploadedImage = {
  path: string
  url: string
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function json(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Configuração interna ausente: ${name}`)
  return value
}

async function requireAdministrator(
  client: ReturnType<typeof createClient>,
  request: Request,
) {
  const authorization = request.headers.get('Authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) throw new HttpError(401, 'Autenticação obrigatória.')

  const { data: userData, error: userError } = await client.auth.getUser(token)
  if (userError || !userData.user) throw new HttpError(401, 'Sessão inválida ou expirada.')

  const { data: administrator, error: administratorError } = await client
    .from('administradores')
    .select('usuario_id')
    .eq('usuario_id', userData.user.id)
    .maybeSingle()

  if (administratorError) throw administratorError
  if (!administrator) throw new HttpError(403, 'Apenas administradores podem gerenciar veículos.')
  return userData.user
}

function cleanText(value: FormDataEntryValue | null, maximumLength: number) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maximumLength)
}

function optionalText(value: FormDataEntryValue | null, maximumLength: number) {
  return cleanText(value, maximumLength) || null
}

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function numberValue(value: FormDataEntryValue | null, fallback = Number.NaN) {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function booleanValue(value: FormDataEntryValue | null) {
  return value === 'true'
}

function normalizedPlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function normalizedDigits(value: string | null) {
  return value?.replace(/\D/g, '') || null
}

function normalizedChassis(value: string | null) {
  return value?.toUpperCase().replace(/[^A-Z0-9]/g, '') || null
}

function sameNullableNumber(value: unknown, expected: number | null) {
  return value === null && expected === null || Number(value) === expected
}

function sameVersion(version: JsonRecord, input: JsonRecord) {
  return version.categoria_id === input.categoria_id
    && version.grupo_id === input.grupo_id
    && String(version.cambio ?? '').toLowerCase() === input.cambio
    && String(version.combustivel ?? '').toLowerCase() === input.combustivel
    && Number(version.preco_base_diaria) === input.preco_base_diaria
    && version.ar_condicionado === input.ar_condicionado
    && version.trava_eletrica === input.trava_eletrica
    && version.eletrico === input.eletrico
    && version.freio_abs === input.freio_abs
    && version.direcao_assistida === input.direcao_assistida
    && sameNullableNumber(version.capacidade_pessoas, input.capacidade_pessoas as number | null)
    && sameNullableNumber(version.capacidade_malas, input.capacidade_malas as number | null)
}

function validateImage(bytes: Uint8Array, declaredType: string) {
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng = bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  const isWebp = bytes.length >= 12
    && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
    && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'

  if (isJpeg && declaredType === 'image/jpeg') return { extension: 'jpg', contentType: 'image/jpeg' }
  if (isPng && declaredType === 'image/png') return { extension: 'png', contentType: 'image/png' }
  if (isWebp && declaredType === 'image/webp') return { extension: 'webp', contentType: 'image/webp' }
  throw new Error('Uma das imagens não corresponde ao formato JPEG, PNG ou WebP informado.')
}

async function hashRequestOrigin(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const address = request.headers.get('cf-connecting-ip') || forwarded || 'origem-desconhecida'
  const input = new TextEncoder().encode(address)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function consumeRateLimit(client: ReturnType<typeof createClient>, request: Request) {
  const now = new Date()
  const windowStart = new Date(now)
  windowStart.setUTCMinutes(0, 0, 0)
  const key = await hashRequestOrigin(request)
  const windowIso = windowStart.toISOString()

  await client
    .from('cadastro_veiculo_limites')
    .delete()
    .lt('janela_inicio', new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString())

  const { data: current, error: readError } = await client
    .from('cadastro_veiculo_limites')
    .select('quantidade')
    .eq('chave', key)
    .eq('janela_inicio', windowIso)
    .maybeSingle()

  if (readError) throw readError
  const quantity = Number(current?.quantidade ?? 0)
  if (quantity >= 5) return false

  const { error } = await client
    .from('cadastro_veiculo_limites')
    .upsert({
      chave: key,
      janela_inicio: windowIso,
      quantidade: quantity + 1,
      ultima_tentativa: now.toISOString(),
    }, { onConflict: 'chave,janela_inicio' })

  if (error) {
    if (error.code === '23514') return false
    throw error
  }
  return true
}

async function getOptions(client: ReturnType<typeof createClient>) {
  const [categories, groups, locations] = await Promise.all([
    client.from('categorias_veiculo').select('slug,nome').eq('ativo', true).order('nome'),
    client.from('grupos_veiculo').select('codigo,nome').eq('ativo', true).order('nome'),
    client.from('locais').select('id,codigo,nome,cidade,estado').eq('ativo', true).order('nome'),
  ])

  const error = categories.error || groups.error || locations.error
  if (error) throw error
  return {
    categorias: categories.data ?? [],
    grupos: groups.data ?? [],
    locais: locations.data ?? [],
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()

  const client = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const logger = new Logger('cadastrar-veiculo', requestId, undefined, client)
  let user: { id: string }

  try {
    user = await requireAdministrator(client, request)
    logger.setUserId(user.id)
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message })
    await logger.persist('ERROR', 'Falha ao validar administrador', {
      errorCode: 'AUTHORIZATION_FAILED',
      errorDetails: { message: error instanceof Error ? error.message : 'Unknown error' },
    })
    return json(500, { error: 'Não foi possível validar sua autorização.' })
  }

  if (request.method === 'GET') {
    try {
      return json(200, await getOptions(client))
    } catch {
      return json(500, { error: 'Não foi possível carregar as opções do cadastro.' })
    }
  }

  if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' })

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > maximumTotalSize + 1024 * 1024) {
    return json(413, { error: 'O cadastro ultrapassa o limite total de 20 MB em imagens.' })
  }

  try {
    const rateLimit = await consumeAtomicRateLimit(client, {
      scope: 'cadastrar-veiculo:user', key: user.id, limit: 5, windowSeconds: 3600,
    })
    if (!rateLimit.allowed) {
      await logger.persist('WARN', 'Rate limit exceeded', { errorCode: 'RATE_LIMIT_EXCEEDED' })
      return json(429, { error: 'Limite de cinco cadastros por hora atingido. Tente novamente mais tarde.' })
    }
  } catch {
    return json(503, { error: 'Não foi possível validar o limite de uso.' })
  }

  const uploaded: UploadedImage[] = []
  let vehicleId: string | null = null
  let brandId: string | null = null
  let modelId: string | null = null
  let versionId: string | null = null
  let brandCreated = false
  let modelCreated = false
  let versionCreated = false

  try {
    const form = await request.formData()
    const brand = cleanText(form.get('marca'), 60)
    const model = cleanText(form.get('modelo'), 80)
    const version = optionalText(form.get('versao'), 100)
    const category = cleanText(form.get('categoria'), 40).toLowerCase()
    const group = optionalText(form.get('grupo'), 20)?.toUpperCase() ?? null
    const locationId = cleanText(form.get('local_id'), 50)
    const color = cleanText(form.get('cor'), 40)
    const plate = normalizedPlate(cleanText(form.get('placa'), 12))
    const chassis = normalizedChassis(optionalText(form.get('chassi'), 30))
    const renavam = normalizedDigits(optionalText(form.get('renavam'), 20))
    const year = numberValue(form.get('ano_modelo'))
    const mileage = numberValue(form.get('quilometragem'), 0)
    const dailyPrice = numberValue(form.get('preco_diaria'))
    const people = numberValue(form.get('capacidade_pessoas'), 0) || null
    const luggage = numberValue(form.get('capacidade_malas'), -1)
    const transmission = cleanText(form.get('cambio'), 20).toLowerCase()
    const fuel = cleanText(form.get('combustivel'), 20).toLowerCase()
    const imageRights = booleanValue(form.get('direitos_imagem'))
    const testMode = booleanValue(form.get('modo_teste'))
    const currentYear = new Date().getUTCFullYear()

    if (!/^[\p{L}\p{N} .'-]{2,60}$/u.test(brand) || !/^[\p{L}\p{N} .'-]{1,80}$/u.test(model)) {
      return json(400, { error: 'Informe marca e modelo válidos.' })
    }
    if (version && !/^[\p{L}\p{N} .+\-\/]{1,100}$/u.test(version)) {
      return json(400, { error: 'A versão contém caracteres inválidos.' })
    }
    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) {
      return json(400, { error: 'Informe uma placa brasileira válida.' })
    }
    if (!Number.isInteger(year) || year < 1900 || year > currentYear + 1) {
      return json(400, { error: 'Informe um ano válido.' })
    }
    if (!Number.isInteger(mileage) || mileage < 0 || dailyPrice <= 0 || dailyPrice > 100000) {
      return json(400, { error: 'Informe quilometragem e preço válidos.' })
    }
    if (!color || chassis && !/^[A-HJ-NPR-Z0-9]{17}$/.test(chassis) || renavam && !/^\d{11}$/.test(renavam)) {
      return json(400, { error: 'Cor, chassi ou Renavam inválidos.' })
    }
    if (!['manual', 'automático', 'automatico', 'cvt'].includes(transmission)
      || !['gasolina', 'etanol', 'flex', 'diesel', 'elétrico', 'eletrico', 'híbrido', 'hibrido'].includes(fuel)) {
      return json(400, { error: 'Câmbio ou combustível inválido.' })
    }
    if (people !== null && (!Number.isInteger(people) || people < 1 || people > 20)
      || luggage !== -1 && (!Number.isInteger(luggage) || luggage < 0 || luggage > 20)) {
      return json(400, { error: 'Capacidades de pessoas ou malas inválidas.' })
    }
    if (!imageRights) return json(400, { error: 'Confirme que possui direito de uso das imagens.' })

    const files = form.getAll('imagens').filter((entry): entry is File => entry instanceof File)
    if (files.length < 1 || files.length > maximumFiles) {
      return json(400, { error: 'Envie entre uma e cinco imagens.' })
    }
    if (files.some((file) => file.size <= 0 || file.size > maximumFileSize)
      || files.reduce((total, file) => total + file.size, 0) > maximumTotalSize) {
      return json(413, { error: 'Cada imagem pode ter até 5 MB, com limite total de 20 MB.' })
    }

    const { data: categoryRow } = await client
      .from('categorias_veiculo').select('id').eq('slug', category).eq('ativo', true).maybeSingle()
    const { data: groupRow } = group
      ? await client.from('grupos_veiculo').select('id').eq('codigo', group).eq('ativo', true).maybeSingle()
      : { data: null }
    const { data: locationRow } = await client
      .from('locais').select('id').eq('id', locationId).eq('ativo', true).maybeSingle()

    if (!categoryRow || group && !groupRow || !locationRow) {
      return json(400, { error: 'Categoria, grupo ou local inválido.' })
    }

    const requestId = crypto.randomUUID()
    for (const [index, file] of files.entries()) {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const format = validateImage(bytes, file.type)
      const path = `cadastros/${requestId}/${String(index + 1).padStart(2, '0')}.${format.extension}`
      const { error } = await client.storage.from(bucket).upload(path, bytes, {
        contentType: format.contentType,
        cacheControl: '31536000',
        upsert: false,
      })
      if (error) throw error
      const { data } = client.storage.from(bucket).getPublicUrl(path)
      uploaded.push({ path, url: data.publicUrl })
    }

    const brandSlug = slug(brand)
    let { data: brandRow, error: brandReadError } = await client
      .from('marcas').select('id').eq('slug', brandSlug).maybeSingle()
    if (brandReadError) throw brandReadError
    if (!brandRow) {
      const insertion = await client.from('marcas').insert({ nome: brand, slug: brandSlug }).select('id').single()
      if (insertion.error?.code === '23505') {
        const existing = await client.from('marcas').select('id').eq('slug', brandSlug).single()
        if (existing.error) throw existing.error
        brandRow = existing.data
      } else if (insertion.error) throw insertion.error
      else {
        brandRow = insertion.data
        brandCreated = true
      }
    }
    brandId = brandRow.id

    let { data: modelRow, error: modelReadError } = await client
      .from('modelos_veiculo').select('id').eq('marca_id', brandId).ilike('nome', model).maybeSingle()
    if (modelReadError) throw modelReadError
    if (!modelRow) {
      const insertion = await client.from('modelos_veiculo').insert({ marca_id: brandId, nome: model }).select('id').single()
      if (insertion.error?.code === '23505') {
        const existing = await client.from('modelos_veiculo').select('id').eq('marca_id', brandId).ilike('nome', model).single()
        if (existing.error) throw existing.error
        modelRow = existing.data
      } else if (insertion.error) throw insertion.error
      else {
        modelRow = insertion.data
        modelCreated = true
      }
    }
    modelId = modelRow.id

    let versionQuery = client.from('versoes_veiculo').select('*').eq('modelo_id', modelId).eq('ano_modelo', year)
    versionQuery = version ? versionQuery.ilike('nome', version) : versionQuery.is('nome', null)
    let { data: versionRow, error: versionReadError } = await versionQuery.maybeSingle()
    if (versionReadError) throw versionReadError

    const versionInput: JsonRecord = {
      modelo_id: modelId,
      categoria_id: categoryRow.id,
      grupo_id: groupRow?.id ?? null,
      nome: version,
      ano_modelo: year,
      cambio: transmission,
      combustivel: fuel,
      preco_base_diaria: dailyPrice,
      ar_condicionado: booleanValue(form.get('ar_condicionado')),
      trava_eletrica: booleanValue(form.get('trava_eletrica')),
      eletrico: booleanValue(form.get('eletrico')),
      freio_abs: booleanValue(form.get('freio_abs')),
      direcao_assistida: booleanValue(form.get('direcao_assistida')),
      capacidade_pessoas: people,
      capacidade_malas: luggage === -1 ? null : luggage,
    }

    if (versionRow && !sameVersion(versionRow, versionInput)) {
      throw new Error('VERSION_CONFLICT')
    }
    if (!versionRow) {
      const insertion = await client.from('versoes_veiculo').insert(versionInput).select('*').single()
      if (insertion.error?.code === '23505') {
        let existingQuery = client.from('versoes_veiculo').select('*').eq('modelo_id', modelId).eq('ano_modelo', year)
        existingQuery = version ? existingQuery.ilike('nome', version) : existingQuery.is('nome', null)
        const existing = await existingQuery.single()
        if (existing.error) throw existing.error
        versionRow = existing.data
        if (!sameVersion(versionRow, versionInput)) throw new Error('VERSION_CONFLICT')
      } else if (insertion.error) throw insertion.error
      else {
        versionRow = insertion.data
        versionCreated = true
      }
    }
    versionId = versionRow.id

    const vehicleInsertion = await client.from('veiculos').insert({
      versao_id: versionId,
      codigo_interno: `CAD-${requestId.slice(0, 8).toUpperCase()}`,
      placa: plate,
      cor: color,
      chassi: chassis,
      renavam,
      ano_fabricacao: year,
      quilometragem: mileage,
      status_operacional: 'disponivel',
      local_atual_id: locationId,
    }).select('id').single()
    if (vehicleInsertion.error) throw vehicleInsertion.error
    vehicleId = vehicleInsertion.data.id

    const { data: lastImage, error: orderError } = await client
      .from('versao_imagens').select('ordem').eq('versao_id', versionId).order('ordem', { ascending: false }).limit(1).maybeSingle()
    if (orderError) throw orderError
    const firstOrder = Number(lastImage?.ordem ?? -1) + 1
    const imageRows = uploaded.map((image, index) => ({
      versao_id: versionId,
      caminho: image.url,
      texto_alternativo: `Foto de ${brand} ${model}`,
      ordem: firstOrder + index,
      principal: firstOrder === 0 && index === 0,
      fonte_url: null,
      autor: 'Cadastro público',
      licenca: 'Direitos de uso declarados pelo remetente',
      licenca_url: null,
    }))
    const imageInsertion = await client.from('versao_imagens').insert(imageRows)
    if (imageInsertion.error) throw imageInsertion.error

    if (testMode) {
      await client.from('versao_imagens').delete().in('caminho', uploaded.map((image) => image.url))
      await client.from('veiculos').delete().eq('id', vehicleId)
      if (versionCreated) await client.from('versoes_veiculo').delete().eq('id', versionId)
      if (modelCreated) await client.from('modelos_veiculo').delete().eq('id', modelId)
      if (brandCreated) await client.from('marcas').delete().eq('id', brandId)
      await client.storage.from(bucket).remove(uploaded.map((image) => image.path))
      vehicleId = null
      versionId = null
      modelId = null
      brandId = null
      versionCreated = false
      modelCreated = false
      brandCreated = false
      uploaded.splice(0)
      return json(200, { message: 'Fluxo completo validado e dados de teste removidos.', teste: true })
    }

    return json(201, {
      message: 'Veículo cadastrado com sucesso.',
      veiculo_id: vehicleId,
      imagens: uploaded.length,
    })
  } catch (error) {
    if (vehicleId) await client.from('veiculos').delete().eq('id', vehicleId)
    if (versionCreated && versionId) await client.from('versoes_veiculo').delete().eq('id', versionId)
    if (modelCreated && modelId) await client.from('modelos_veiculo').delete().eq('id', modelId)
    if (brandCreated && brandId) await client.from('marcas').delete().eq('id', brandId)
    if (uploaded.length) await client.storage.from(bucket).remove(uploaded.map((image) => image.path))

    if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
      return json(409, { error: 'Esta versão já existe com especificações diferentes.' })
    }
    const databaseError = error as { code?: string }
    if (databaseError?.code === '23505') {
      return json(409, { error: 'A placa, o chassi ou o Renavam já está cadastrado.' })
    }
    await logger.persist('ERROR', 'Falha no cadastro de veículo', {
      errorCode: databaseError?.code ?? 'VEHICLE_CREATE_FAILED',
      errorDetails: { message: error instanceof Error ? error.message : 'Unknown error' },
    })
    return json(500, { error: 'Não foi possível cadastrar o veículo.' })
  }
})
