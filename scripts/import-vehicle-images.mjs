import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const vehicles = [
  ['Chevrolet', 'Onix'],
  ['Chevrolet', 'Spin'],
  ['Fiat', 'Cronos'],
  ['Fiat', 'Mobi'],
  ['Fiat', 'Pulse'],
  ['Ford', 'Territory'],
  ['Honda', 'City'],
  ['Honda', 'Civic'],
  ['Hyundai', 'HB20'],
  ['Jeep', 'Compass'],
  ['Jeep', 'Renegade'],
  ['Nissan', 'Kicks'],
  ['Renault', 'Kwid'],
  ['Toyota', 'Corolla Cross'],
  ['Toyota', 'Yaris'],
  ['Volkswagen', 'Polo'],
  ['Volkswagen', 'T-Cross'],
]

const mode = process.argv.includes('--upload') ? 'upload' : 'discover'
const bucket = 'vehicle-images'
const prefix = 'catalogo/commons-20260811'

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, '')]
      }),
  )
}

function plainText(value = '') {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function slug(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function licenseIsReusable(metadata) {
  const license = plainText(metadata.LicenseShortName?.value || metadata.License?.value || '')
  return /^(cc\s|cc-|public domain|pd|pdm)/i.test(license)
}

async function fetchWithRetry(url, options = {}, attempts = 6) {
  let response
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    response = await fetch(url, options)
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === attempts) return response
    const retryAfter = Number(response.headers.get('retry-after') || attempt * 4)
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
  }
  return response
}

function scoreCandidate(page, brand, model) {
  const title = page.title.toLowerCase()
  const expected = `${brand} ${model}`.toLowerCase().split(/[\s-]+/)
  const penalties = [
    ['logo', 40],
    ['badge', 30],
    ['interior', 20],
    ['engine', 20],
    ['dashboard', 20],
    ['police', 100],
    ['patrol', 100],
    ['taxi', 100],
    ['race', 100],
    ['racing', 100],
    ['competición', 100],
    ['carrera', 100],
    ['rear', 5],
  ]
  let score = expected.reduce((total, word) => total + (title.includes(word) ? 20 : -10), 0)
  for (const [word, penalty] of penalties) {
    if (title.includes(word)) score -= penalty
  }
  const info = page.imageinfo?.[0]
  if (info?.width >= 1200) score += 10
  if ((info?.mime || '').toLowerCase() === 'image/jpeg') score += 5
  return score
}

async function findImage(brand, model) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `"${brand} ${model}" automobile`,
    gsrnamespace: '6',
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '1600',
    format: 'json',
    formatversion: '2',
    origin: '*',
  })
  const response = await fetchWithRetry(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': 'AxoLocadorasVehicleImporter/1.0 (vehicle catalog test)' },
  })
  if (!response.ok) throw new Error(`Commons respondeu ${response.status} para ${brand} ${model}`)
  const payload = await response.json()
  const pages = (payload.query?.pages || [])
    .filter((page) => {
      const info = page.imageinfo?.[0]
      return info && ['image/jpeg', 'image/png', 'image/webp'].includes(info.mime) && info.width >= 600
        && licenseIsReusable(info.extmetadata || {})
    })
    .sort((a, b) => scoreCandidate(b, brand, model) - scoreCandidate(a, brand, model))
  const page = pages[0]
  if (!page) throw new Error(`Nenhuma imagem reutilizável encontrada para ${brand} ${model}`)

  const info = page.imageinfo[0]
  const metadata = info.extmetadata || {}
  const sourceUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
  return {
    brand,
    model,
    title: page.title.replace(/^File:/, ''),
    downloadUrl: info.thumburl || info.url,
    sourceUrl,
    author: plainText(metadata.Artist?.value || metadata.Credit?.value || 'Autor informado na página de origem'),
    license: plainText(metadata.LicenseShortName?.value || metadata.License?.value || 'Licença informada na página de origem'),
    licenseUrl: plainText(metadata.LicenseUrl?.value || ''),
    mime: info.mime,
    width: info.thumbwidth || info.width,
    height: info.thumbheight || info.height,
  }
}

const results = []
let supabase
if (mode === 'upload') {
  const env = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8'))
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('VITE_SUPABASE_URL e a chave publicável são obrigatórias no .env')
  supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

for (const [brand, model] of vehicles) {
  if (results.length > 0) await new Promise((resolve) => setTimeout(resolve, 1200))
  const image = await findImage(brand, model)
  if (mode === 'upload') {
    const path = `${prefix}/${slug(`${brand}-${model}`)}.jpg`
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path)
    const existing = await fetch(publicData.publicUrl, { method: 'HEAD' })
    if (existing.ok) {
      Object.assign(image, { path, publicUrl: publicData.publicUrl, bytes: Number(existing.headers.get('content-length') || 0) })
      results.push(image)
      process.stderr.write(`Mantido: ${brand} ${model} -> ${image.title}\n`)
      continue
    }

    const response = await fetchWithRetry(image.downloadUrl)
    if (!response.ok) throw new Error(`Falha ao baixar ${brand} ${model}: HTTP ${response.status}`)
    const contentType = (response.headers.get('content-type') || image.mime).split(';')[0]
    const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
    const uploadPath = `${prefix}/${slug(`${brand}-${model}`)}.${extension}`
    const bytes = new Uint8Array(await response.arrayBuffer())
    const { error } = await supabase.storage.from(bucket).upload(uploadPath, bytes, {
      cacheControl: '31536000',
      contentType,
      upsert: false,
    })
    if (error) throw new Error(`Falha no upload de ${brand} ${model}: ${error.message}`)
    const { data } = supabase.storage.from(bucket).getPublicUrl(uploadPath)
    Object.assign(image, { path: uploadPath, publicUrl: data.publicUrl, bytes: bytes.byteLength })
  }
  results.push(image)
  process.stderr.write(`${mode === 'upload' ? 'Enviado' : 'Selecionado'}: ${brand} ${model} -> ${image.title}\n`)
}

process.stdout.write(`${JSON.stringify(results)}\n`)
