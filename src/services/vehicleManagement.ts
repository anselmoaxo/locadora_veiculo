import { supabase, supabasePublishableKey, supabaseUrl } from '../lib/supabase'
import type { RegistrationOption } from './vehicleRegistration'

export interface VehicleEditData {
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
  status_operacional: string
  ar_condicionado: boolean
  trava_eletrica: boolean
  eletrico: boolean
  freio_abs: boolean
  direcao_assistida: boolean
  direitos_imagem: boolean
}

export interface ExistingVehicleImage {
  id: number
  caminho: string
  texto_alternativo: string | null
  ordem: number
  principal: boolean
}

export interface VehicleManagementPayload {
  veiculo: {
    id: string
    placa: string | null
    cor: string | null
    chassi: string | null
    renavam: string | null
    quilometragem: number
    status_operacional: string
    local_atual_id: string
    marca: string
    modelo: string
    versao: string
    categoria: string
    grupo: string
    ano_modelo: number
    cambio: string
    combustivel: string
    preco_diaria: number
    ar_condicionado: boolean
    trava_eletrica: boolean
    eletrico: boolean
    freio_abs: boolean
    direcao_assistida: boolean
    capacidade_pessoas: number | null
    capacidade_malas: number | null
    imagens: ExistingVehicleImage[]
    versao_compartilhada: number
  }
  categorias: RegistrationOption[]
  grupos: RegistrationOption[]
  locais: RegistrationOption[]
}

interface UpdateResponse {
  message: string
  veiculo_id: string
  imagens_adicionadas: number
}

const endpoint = `${supabaseUrl}/functions/v1/alterar-veiculo`

async function authenticatedHeaders() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('Sua sessão expirou. Entre novamente para continuar.')
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

export async function loadVehicleForEditing(vehicleId: string): Promise<VehicleManagementPayload> {
  const response = await fetch(`${endpoint}?id=${encodeURIComponent(vehicleId)}`, {
    headers: await authenticatedHeaders(),
  })
  return parseResponse<VehicleManagementPayload>(response)
}

export async function updateVehicle(
  vehicleId: string,
  data: VehicleEditData,
  images: File[],
): Promise<UpdateResponse> {
  const form = new FormData()
  Object.entries(data).forEach(([key, value]) => form.append(key, String(value)))
  images.forEach((image) => form.append('imagens', image, image.name))

  const response = await fetch(`${endpoint}?id=${encodeURIComponent(vehicleId)}`, {
    method: 'PATCH',
    headers: await authenticatedHeaders(),
    body: form,
  })
  return parseResponse<UpdateResponse>(response)
}
