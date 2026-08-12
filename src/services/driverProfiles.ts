import { supabase } from '../lib/supabase'

export type DriverProfileStatus = 'incompleto' | 'em_analise' | 'aprovado' | 'reprovado'

export interface DriverProfileInput {
  fullName: string
  cpf: string
  phone: string
  cnhNumber: string
  cnhCategory: string
  cnhExpiration: string
  cnhState: string
}

export interface AdminDriverProfile {
  user_id: string
  email: string
  full_name: string | null
  cpf: string | null
  phone: string | null
  cnh_number: string | null
  cnh_category: string | null
  cnh_expiration: string | null
  cnh_state: string | null
  registration_status: DriverProfileStatus | null
  review_note: string | null
  is_admin: boolean
  updated_at: string | null
}

export interface AdminReservation {
  reservation_id: string
  code: string
  reservation_status: string
  created_at: string
  pickup_at: string
  return_at: string
  total: number
  user_id: string
  customer_name: string
  customer_status: DriverProfileStatus
  car_id: string
  vehicle_name: string
}

function errorMessage(error: { message?: string; code?: string } | null) {
  const value = `${error?.message ?? ''} ${error?.code ?? ''}`
  if (value.includes('CPF_OR_DRIVER_LICENSE_ALREADY_REGISTERED') || value.includes('23505')) {
    return 'O CPF ou o número da CNH já está vinculado a outro cadastro.'
  }
  if (value.includes('PROFILE_INCOMPLETE_OR_LICENSE_EXPIRED')) {
    return 'O cadastro está incompleto ou a CNH está vencida.'
  }
  if (value.includes('DRIVER_NOT_APPROVED')) return 'A reserva só pode ser confirmada após a aprovação do cliente.'
  return error?.message || 'Não foi possível concluir a operação.'
}

export async function submitDriverProfile(input: DriverProfileInput) {
  const { data, error } = await supabase.rpc('submit_driver_profile', {
    p_full_name: input.fullName,
    p_cpf: input.cpf,
    p_phone: input.phone,
    p_cnh_number: input.cnhNumber,
    p_cnh_category: input.cnhCategory,
    p_cnh_expiration: input.cnhExpiration,
    p_cnh_state: input.cnhState,
  })
  if (error) throw new Error(errorMessage(error))
  return data as DriverProfileStatus
}

export async function listAdminDriverProfiles() {
  const { data, error } = await supabase.rpc('admin_list_driver_profiles')
  if (error) throw new Error(errorMessage(error))
  return (data ?? []) as AdminDriverProfile[]
}

export async function reviewDriverProfile(userId: string, status: 'aprovado' | 'reprovado', note: string) {
  const { data, error } = await supabase.rpc('admin_review_driver_profile', {
    p_user_id: userId,
    p_status: status,
    p_note: note.trim() || null,
  })
  if (error) throw new Error(errorMessage(error))
  return data as string
}

export async function listAdminReservations() {
  const { data, error } = await supabase.rpc('admin_list_reservations')
  if (error) throw new Error(errorMessage(error))
  return ((data ?? []) as AdminReservation[]).map((reservation) => ({
    ...reservation,
    total: Number(reservation.total),
  }))
}

export async function reviewReservation(reservationId: string, status: 'confirmada' | 'cancelada') {
  const { data, error } = await supabase.rpc('admin_review_reservation', {
    p_reservation_id: reservationId,
    p_status: status,
  })
  if (error) throw new Error(errorMessage(error))
  return data as string
}
