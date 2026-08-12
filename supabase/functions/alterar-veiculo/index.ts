import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.112.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, OPTIONS',
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
const bucket = 'vehicle-images'
const maximumFileSize = 5 * 1024 * 1024
const maximumTotalSize = 20 * 1024 * 1024
const maximumFiles = 5
const validStatuses = ['disponivel', 'reservado', 'alugado', 'manutencao', 'inativo']

type SupabaseClient = ReturnType<typeof createClient>
type JsonRecord = Record<string, unknown>
type UploadedImage = { path: string; url: string }

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
  throw new HttpError(400, 'Uma das imagens não corresponde ao formato JPEG, PNG ou WebP informado.')
}

async function authorize(request: Request, client: SupabaseClient) {
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) throw new HttpError(401, 'Sessão de usuário ausente.')

  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Sessão inválida ou expirada.')

  const { data: administrator, error: adminError } = await client
    .from('administradores')
    .select('usuario_id')
    .eq('usuario_id', data.user.id)
    .maybeSingle()

  if (adminError) throw adminError
  if (!administrator) throw new HttpError(403, 'Seu usuário não possui permissão para alterar veículos.')
  return data.user
}

async function loadOptions(client: SupabaseClient) {
  const [categories, groups, locations] = await Promise.all([
    client.from('categorias_veiculo').select('id,slug,nome').eq('ativo', true).order('nome'),
    client.from('grupos_veiculo').select('id,codigo,nome').eq('ativo', true).order('nome'),
    client.from('locais').select('id,codigo,nome,cidade,estado').eq('ativo', true).order('nome'),
  ])
  const error = categories.error || groups.error || locations.error
  if (error) throw error
  return { categorias: categories.data ?? [], grupos: groups.data ?? [], locais: locations.data ?? [] }
}

async function loadVehicle(client: SupabaseClient, vehicleId: string) {
  const { data: vehicle, error: vehicleError } = await client
    .from('veiculos')
    .select('id,versao_id,placa,cor,chassi,renavam,ano_fabricacao,quilometragem,status_operacional,local_atual_id')
    .eq('id', vehicleId)
    .maybeSingle()
  if (vehicleError) throw vehicleError
  if (!vehicle) throw new HttpError(404, 'Veículo não encontrado.')

  const { data: version, error: versionError } = await client
    .from('versoes_veiculo')
    .select('id,modelo_id,categoria_id,grupo_id,nome,ano_modelo,cambio,combustivel,preco_base_diaria,ar_condicionado,trava_eletrica,eletrico,freio_abs,direcao_assistida,capacidade_pessoas,capacidade_malas')
    .eq('id', vehicle.versao_id)
    .single()
  if (versionError) throw versionError

  const [modelResult, categoryResult, groupResult, locationResult, imagesResult, countResult, options] = await Promise.all([
    client.from('modelos_veiculo').select('id,nome,marca_id').eq('id', version.modelo_id).single(),
    client.from('categorias_veiculo').select('id,slug,nome').eq('id', version.categoria_id).single(),
    version.grupo_id
      ? client.from('grupos_veiculo').select('id,codigo,nome').eq('id', version.grupo_id).single()
      : Promise.resolve({ data: null, error: null }),
    client.from('locais').select('id,codigo,nome,cidade,estado').eq('id', vehicle.local_atual_id).single(),
    client.from('versao_imagens').select('id,caminho,texto_alternativo,ordem,principal').eq('versao_id', version.id).order('ordem'),
    client.from('veiculos').select('id', { count: 'exact', head: true }).eq('versao_id', version.id),
    loadOptions(client),
  ])

  const relationError = modelResult.error || categoryResult.error || groupResult.error || locationResult.error || imagesResult.error || countResult.error
  if (relationError) throw relationError
  const model = modelResult.data
  const { data: brand, error: brandError } = await client.from('marcas').select('id,nome').eq('id', model.marca_id).single()
  if (brandError) throw brandError

  return {
    veiculo: {
      ...vehicle,
      marca: brand.nome,
      modelo: model.nome,
      versao: version.nome ?? '',
      categoria: categoryResult.data.slug,
      grupo: groupResult.data?.codigo ?? '',
      ano_modelo: version.ano_modelo,
      cambio: version.cambio ?? '',
      combustivel: version.combustivel ?? '',
      preco_diaria: version.preco_base_diaria,
      ar_condicionado: version.ar_condicionado,
      trava_eletrica: version.trava_eletrica,
      eletrico: version.eletrico,
      freio_abs: version.freio_abs,
      direcao_assistida: version.direcao_assistida,
      capacidade_pessoas: version.capacidade_pessoas,
      capacidade_malas: version.capacidade_malas,
      imagens: imagesResult.data ?? [],
      versao_compartilhada: Number(countResult.count ?? 0),
    },
    ...options,
  }
}

function parseVehicleForm(form: FormData) {
  const input = {
    brand: cleanText(form.get('marca'), 60),
    model: cleanText(form.get('modelo'), 80),
    version: optionalText(form.get('versao'), 100),
    category: cleanText(form.get('categoria'), 40).toLowerCase(),
    group: optionalText(form.get('grupo'), 20)?.toUpperCase() ?? null,
    locationId: cleanText(form.get('local_id'), 50),
    color: cleanText(form.get('cor'), 40),
    plate: normalizedPlate(cleanText(form.get('placa'), 12)),
    chassis: normalizedChassis(optionalText(form.get('chassi'), 30)),
    renavam: normalizedDigits(optionalText(form.get('renavam'), 20)),
    year: numberValue(form.get('ano_modelo')),
    mileage: numberValue(form.get('quilometragem')),
    dailyPrice: numberValue(form.get('preco_diaria')),
    people: numberValue(form.get('capacidade_pessoas'), 0) || null,
    luggage: numberValue(form.get('capacidade_malas'), -1),
    transmission: cleanText(form.get('cambio'), 20).toLowerCase(),
    fuel: cleanText(form.get('combustivel'), 20).toLowerCase(),
    status: cleanText(form.get('status_operacional'), 20).toLowerCase(),
    airConditioning: booleanValue(form.get('ar_condicionado')),
    electricLock: booleanValue(form.get('trava_eletrica')),
    electric: booleanValue(form.get('eletrico')),
    abs: booleanValue(form.get('freio_abs')),
    assistedSteering: booleanValue(form.get('direcao_assistida')),
    imageRights: booleanValue(form.get('direitos_imagem')),
  }

  const currentYear = new Date().getUTCFullYear()
  if (!/^[\p{L}\p{N} .'-]{2,60}$/u.test(input.brand) || !/^[\p{L}\p{N} .'-]{1,80}$/u.test(input.model)) {
    throw new HttpError(400, 'Informe marca e modelo válidos.')
  }
  if (input.version && !/^[\p{L}\p{N} .+\-\/]{1,100}$/u.test(input.version)) {
    throw new HttpError(400, 'A versão contém caracteres inválidos.')
  }
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(input.plate)) throw new HttpError(400, 'Informe uma placa brasileira válida.')
  if (!input.color) throw new HttpError(400, 'Informe a cor do veículo.')
  if (input.chassis && !/^[A-HJ-NPR-Z0-9]{17}$/.test(input.chassis)) throw new HttpError(400, 'Informe um chassi válido com 17 caracteres.')
  if (input.renavam && !/^\d{11}$/.test(input.renavam)) throw new HttpError(400, 'Informe um Renavam válido com 11 dígitos.')
  if (!Number.isInteger(input.year) || input.year < 1900 || input.year > currentYear + 1) throw new HttpError(400, 'Informe um ano válido.')
  if (!Number.isInteger(input.mileage) || input.mileage < 0) throw new HttpError(400, 'Informe uma quilometragem válida.')
  if (input.dailyPrice <= 0 || input.dailyPrice > 100000) throw new HttpError(400, 'Informe um preço de diária válido.')
  if (!['manual', 'automático', 'automatico', 'cvt'].includes(input.transmission)) throw new HttpError(400, 'Informe um câmbio válido.')
  if (!['gasolina', 'etanol', 'flex', 'diesel', 'elétrico', 'eletrico', 'híbrido', 'hibrido'].includes(input.fuel)) throw new HttpError(400, 'Informe um combustível válido.')
  if (!validStatuses.includes(input.status)) throw new HttpError(400, 'Informe um status operacional válido.')
  if (input.people !== null && (!Number.isInteger(input.people) || input.people < 1 || input.people > 20)) throw new HttpError(400, 'Informe uma capacidade de pessoas válida.')
  if (input.luggage !== -1 && (!Number.isInteger(input.luggage) || input.luggage < 0 || input.luggage > 20)) throw new HttpError(400, 'Informe uma capacidade de malas válida.')
  return input
}

function versionChanged(version: JsonRecord, model: JsonRecord, brand: JsonRecord, input: ReturnType<typeof parseVehicleForm>, categoryId: string, groupId: string | null) {
  return String(brand.nome).trim().toLowerCase() !== input.brand.toLowerCase()
    || String(model.nome).trim().toLowerCase() !== input.model.toLowerCase()
    || String(version.nome ?? '').trim().toLowerCase() !== String(input.version ?? '').toLowerCase()
    || Number(version.ano_modelo) !== input.year
    || version.categoria_id !== categoryId
    || version.grupo_id !== groupId
    || String(version.cambio ?? '').toLowerCase() !== input.transmission
    || String(version.combustivel ?? '').toLowerCase() !== input.fuel
    || Number(version.preco_base_diaria) !== input.dailyPrice
    || version.ar_condicionado !== input.airConditioning
    || version.trava_eletrica !== input.electricLock
    || version.eletrico !== input.electric
    || version.freio_abs !== input.abs
    || version.direcao_assistida !== input.assistedSteering
    || Number(version.capacidade_pessoas ?? 0) !== Number(input.people ?? 0)
    || Number(version.capacidade_malas ?? -1) !== Number(input.luggage)
}

async function ensureBrandAndModel(client: SupabaseClient, brandName: string, modelName: string) {
  let brandCreated = false
  let modelCreated = false
  const brandSlug = slug(brandName)
  let { data: brand } = await client.from('marcas').select('id').eq('slug', brandSlug).maybeSingle()
  if (!brand) {
    const inserted = await client.from('marcas').insert({ nome: brandName, slug: brandSlug }).select('id').single()
    if (inserted.error?.code === '23505') {
      const existing = await client.from('marcas').select('id').eq('slug', brandSlug).single()
      if (existing.error) throw existing.error
      brand = existing.data
    } else if (inserted.error) throw inserted.error
    else { brand = inserted.data; brandCreated = true }
  }

  let { data: model } = await client.from('modelos_veiculo').select('id').eq('marca_id', brand.id).ilike('nome', modelName).maybeSingle()
  if (!model) {
    const inserted = await client.from('modelos_veiculo').insert({ marca_id: brand.id, nome: modelName }).select('id').single()
    if (inserted.error?.code === '23505') {
      const existing = await client.from('modelos_veiculo').select('id').eq('marca_id', brand.id).ilike('nome', modelName).single()
      if (existing.error) throw existing.error
      model = existing.data
    } else if (inserted.error) throw inserted.error
    else { model = inserted.data; modelCreated = true }
  }
  return { brandId: brand.id as string, modelId: model.id as string, brandCreated, modelCreated }
}

async function updateVehicle(request: Request, client: SupabaseClient, user: JsonRecord, vehicleId: string) {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > maximumTotalSize + 1024 * 1024) throw new HttpError(413, 'A alteração ultrapassa o limite total de 20 MB em imagens.')

  const form = await request.formData()
  const input = parseVehicleForm(form)
  const files = form.getAll('imagens').filter((entry): entry is File => entry instanceof File && entry.size > 0)
  if (files.length > maximumFiles) throw new HttpError(400, 'Envie no máximo cinco imagens.')
  if (files.length && !input.imageRights) throw new HttpError(400, 'Confirme que possui direito de uso das novas imagens.')
  if (files.some((file) => file.size > maximumFileSize) || files.reduce((total, file) => total + file.size, 0) > maximumTotalSize) {
    throw new HttpError(413, 'Cada imagem pode ter até 5 MB, com limite total de 20 MB.')
  }

  const { data: vehicle, error: vehicleError } = await client.from('veiculos').select('*').eq('id', vehicleId).maybeSingle()
  if (vehicleError) throw vehicleError
  if (!vehicle) throw new HttpError(404, 'Veículo não encontrado.')
  const { data: version, error: versionError } = await client.from('versoes_veiculo').select('*').eq('id', vehicle.versao_id).single()
  if (versionError) throw versionError
  const { data: model, error: modelError } = await client.from('modelos_veiculo').select('*').eq('id', version.modelo_id).single()
  if (modelError) throw modelError
  const { data: brand, error: brandError } = await client.from('marcas').select('*').eq('id', model.marca_id).single()
  if (brandError) throw brandError

  const [{ data: category }, groupResult, { data: location }, countResult] = await Promise.all([
    client.from('categorias_veiculo').select('id').eq('slug', input.category).eq('ativo', true).maybeSingle(),
    input.group ? client.from('grupos_veiculo').select('id').eq('codigo', input.group).eq('ativo', true).maybeSingle() : Promise.resolve({ data: null, error: null }),
    client.from('locais').select('id').eq('id', input.locationId).eq('ativo', true).maybeSingle(),
    client.from('veiculos').select('id', { count: 'exact', head: true }).eq('versao_id', version.id),
  ])
  if (!category || input.group && !groupResult.data || !location) throw new HttpError(400, 'Categoria, grupo ou local inválido.')
  if (groupResult.error || countResult.error) throw groupResult.error || countResult.error

  const changesVersion = versionChanged(version, model, brand, input, category.id, groupResult.data?.id ?? null)
  if (Number(countResult.count ?? 0) > 1 && (changesVersion || files.length > 0)) {
    throw new HttpError(409, 'Esta versão é compartilhada por mais de um carro. Altere somente placa, cor, chassi, Renavam, quilometragem, status ou local.')
  }

  const uploaded: UploadedImage[] = []
  let normalized: Awaited<ReturnType<typeof ensureBrandAndModel>> | null = null
  let versionUpdated = false
  let vehicleUpdated = false
  try {
    const requestId = crypto.randomUUID()
    for (const [index, file] of files.entries()) {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const format = validateImage(bytes, file.type)
      const path = `alteracoes/${vehicleId}/${requestId}/${String(index + 1).padStart(2, '0')}.${format.extension}`
      const upload = await client.storage.from(bucket).upload(path, bytes, { contentType: format.contentType, cacheControl: '31536000', upsert: false })
      if (upload.error) throw upload.error
      uploaded.push({ path, url: client.storage.from(bucket).getPublicUrl(path).data.publicUrl })
    }

    if (changesVersion) {
      normalized = await ensureBrandAndModel(client, input.brand, input.model)
      const versionUpdate = await client.from('versoes_veiculo').update({
        modelo_id: normalized.modelId,
        categoria_id: category.id,
        grupo_id: groupResult.data?.id ?? null,
        nome: input.version,
        ano_modelo: input.year,
        cambio: input.transmission,
        combustivel: input.fuel,
        preco_base_diaria: input.dailyPrice,
        ar_condicionado: input.airConditioning,
        trava_eletrica: input.electricLock,
        eletrico: input.electric,
        freio_abs: input.abs,
        direcao_assistida: input.assistedSteering,
        capacidade_pessoas: input.people,
        capacidade_malas: input.luggage === -1 ? null : input.luggage,
      }).eq('id', version.id)
      if (versionUpdate.error) throw versionUpdate.error
      versionUpdated = true
    }

    const vehicleUpdate = await client.from('veiculos').update({
      placa: input.plate,
      cor: input.color,
      chassi: input.chassis,
      renavam: input.renavam,
      ano_fabricacao: input.year,
      quilometragem: input.mileage,
      status_operacional: input.status,
      local_atual_id: input.locationId,
    }).eq('id', vehicle.id)
    if (vehicleUpdate.error) throw vehicleUpdate.error
    vehicleUpdated = true

    if (uploaded.length) {
      const { data: lastImage, error: orderError } = await client.from('versao_imagens').select('ordem').eq('versao_id', version.id).order('ordem', { ascending: false }).limit(1).maybeSingle()
      if (orderError) throw orderError
      const firstOrder = Number(lastImage?.ordem ?? -1) + 1
      const insertion = await client.from('versao_imagens').insert(uploaded.map((image, index) => ({
        versao_id: version.id,
        caminho: image.url,
        texto_alternativo: `Foto de ${input.brand} ${input.model}`,
        ordem: firstOrder + index,
        principal: firstOrder === 0 && index === 0,
        autor: String(user.email ?? user.id ?? 'Administrador'),
        licenca: 'Direitos de uso declarados pelo administrador',
      })))
      if (insertion.error) throw insertion.error
    }

    return { message: 'Veículo alterado com sucesso.', veiculo_id: vehicle.id, imagens_adicionadas: uploaded.length }
  } catch (cause) {
    if (uploaded.length) {
      await client.from('versao_imagens').delete().in('caminho', uploaded.map((image) => image.url))
      await client.storage.from(bucket).remove(uploaded.map((image) => image.path))
    }
    if (vehicleUpdated) {
      await client.from('veiculos').update({
        placa: vehicle.placa, cor: vehicle.cor, chassi: vehicle.chassi, renavam: vehicle.renavam,
        ano_fabricacao: vehicle.ano_fabricacao, quilometragem: vehicle.quilometragem,
        status_operacional: vehicle.status_operacional, local_atual_id: vehicle.local_atual_id,
      }).eq('id', vehicle.id)
    }
    if (versionUpdated) {
      await client.from('versoes_veiculo').update({
        modelo_id: version.modelo_id, categoria_id: version.categoria_id, grupo_id: version.grupo_id,
        nome: version.nome, ano_modelo: version.ano_modelo, cambio: version.cambio,
        combustivel: version.combustivel, preco_base_diaria: version.preco_base_diaria,
        ar_condicionado: version.ar_condicionado, trava_eletrica: version.trava_eletrica,
        eletrico: version.eletrico, freio_abs: version.freio_abs,
        direcao_assistida: version.direcao_assistida, capacidade_pessoas: version.capacidade_pessoas,
        capacidade_malas: version.capacidade_malas,
      }).eq('id', version.id)
    }
    if (normalized?.modelCreated) await client.from('modelos_veiculo').delete().eq('id', normalized.modelId)
    if (normalized?.brandCreated) await client.from('marcas').delete().eq('id', normalized.brandId)
    throw cause
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const client = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const user = await authorize(request, client)
    const vehicleId = new URL(request.url).searchParams.get('id') ?? ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(vehicleId)) {
      throw new HttpError(400, 'Identificador de veículo inválido.')
    }
    if (request.method === 'GET') return json(200, await loadVehicle(client, vehicleId))
    if (request.method === 'PUT' || request.method === 'PATCH') return json(200, await updateVehicle(request, client, user, vehicleId))
    return json(405, { error: 'Método não permitido.' })
  } catch (cause) {
    if (cause instanceof HttpError) return json(cause.status, { error: cause.message })
    const databaseError = cause as { code?: string }
    if (databaseError?.code === '23505') return json(409, { error: 'Placa, chassi, Renavam ou versão já cadastrada.' })
    console.error(cause)
    return json(500, { error: 'Não foi possível alterar o veículo.' })
  }
})
