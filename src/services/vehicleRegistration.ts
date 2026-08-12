import { supabase, supabasePublishableKey, supabaseUrl } from '../lib/supabase'

export interface RegistrationOption {
  nome: string
  slug?: string
  codigo?: string
  id?: string
  cidade?: string
  estado?: string
}

export interface VehicleRegistrationOptions {
  categorias: RegistrationOption[]
  grupos: RegistrationOption[]
  locais: RegistrationOption[]
}

export interface VehicleRegistrationData {
  marca: string
  modelo: string
  versao: string
  categoria: string
  grupo: string
  local_id: string
  cor: string
  placa: string
  chassi: string
  renavam: string
  ano_modelo: string
  quilometragem: string
  preco_diaria: string
  capacidade_pessoas: string
  capacidade_malas: string
  cambio: string
  combustivel: string
  ar_condicionado: boolean
  trava_eletrica: boolean
  eletrico: boolean
  freio_abs: boolean
  direcao_assistida: boolean
  direitos_imagem: boolean
}

interface RegistrationResponse {
  message: string
  veiculo_id: string
  imagens: number
}

const endpoint = `${supabaseUrl}/functions/v1/cadastrar-veiculo`

async function authenticatedHeaders() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) {
    throw new Error('Faça login com uma conta administradora para gerenciar veículos.')
  }

  return {
    apikey: supabasePublishableKey,
    Authorization: `Bearer ${data.session.access_token}`,
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a solicitação.')
  return payload
}

export async function loadVehicleRegistrationOptions(): Promise<VehicleRegistrationOptions> {
  const response = await fetch(endpoint, {
    headers: await authenticatedHeaders(),
  })
  return parseResponse<VehicleRegistrationOptions>(response)
}

export async function registerVehicle(
  data: VehicleRegistrationData,
  images: File[],
): Promise<RegistrationResponse> {
  const form = new FormData()
  Object.entries(data).forEach(([key, value]) => form.append(key, String(value)))
  images.forEach((image) => form.append('imagens', image, image.name))

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: await authenticatedHeaders(),
    body: form,
  })
  return parseResponse<RegistrationResponse>(response)
}
