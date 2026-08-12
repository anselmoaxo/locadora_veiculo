import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { Button } from '../components/ui/Button'
import {
  listAdminDriverProfiles,
  listAdminReservations,
  reviewDriverProfile,
  reviewReservation,
  type AdminDriverProfile,
  type AdminReservation,
} from '../services/driverProfiles'

function formatDate(value: string | null) {
  if (!value) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(`${value}T00:00:00`))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusLabel(value: string | null) {
  const labels: Record<string, string> = {
    incompleto: 'Incompleto',
    em_analise: 'Em análise',
    aprovado: 'Aprovado',
    reprovado: 'Reprovado',
    pendente: 'Pendente',
    confirmada: 'Confirmada',
    cancelada: 'Cancelada',
    expirada: 'Expirada',
    convertida: 'Convertida',
  }
  return value ? labels[value] ?? value : 'Sem perfil'
}

export function AdminDashboardPage() {
  const [profiles, setProfiles] = useState<AdminDriverProfile[]>([])
  const [reservations, setReservations] = useState<AdminReservation[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    const [loadedProfiles, loadedReservations] = await Promise.all([
      listAdminDriverProfiles(),
      listAdminReservations(),
    ])
    setProfiles(loadedProfiles)
    setReservations(loadedReservations)
  }, [])

  useEffect(() => {
    load()
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o painel.'))
      .finally(() => setLoading(false))
  }, [load])

  async function reviewProfile(profile: AdminDriverProfile, status: 'aprovado' | 'reprovado') {
    setWorking(`profile-${profile.user_id}`)
    setError('')
    setNotice('')
    try {
      await reviewDriverProfile(profile.user_id, status, notes[profile.user_id] ?? '')
      setNotice(`Cadastro de ${profile.full_name ?? profile.email} ${status}.`)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível avaliar o cadastro.')
    } finally {
      setWorking('')
    }
  }

  async function reviewBooking(reservation: AdminReservation, status: 'confirmada' | 'cancelada') {
    setWorking(`reservation-${reservation.reservation_id}`)
    setError('')
    setNotice('')
    try {
      await reviewReservation(reservation.reservation_id, status)
      setNotice(`Reserva ${reservation.code} ${status}.`)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível avaliar a reserva.')
    } finally {
      setWorking('')
    }
  }

  const pendingProfiles = profiles.filter((profile) => profile.registration_status === 'em_analise').length
  const pendingReservations = reservations.filter((reservation) => reservation.reservation_status === 'pendente').length

  return (
    <div className="min-h-screen flex flex-col bg-neutral-background">
      <Header />
      <main className="flex-1 max-w-[1480px] mx-auto w-full px-md md:px-lg py-xl flex flex-col gap-lg">
        <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Administração' }]} />

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-md">
          <div>
            <p className="font-inter text-body-sm uppercase tracking-[0.16em] text-primary font-bold">Área restrita</p>
            <h1 className="font-exo font-bold text-heading-md text-secondary">Painel administrativo</h1>
            <p className="font-inter text-body-md text-neutral-text mt-xs">Analise condutores, aprove reservas e gerencie a frota.</p>
          </div>
          <div className="flex flex-wrap gap-sm">
            <Link to="/cadastro-veiculo" className="inline-flex items-center gap-xs rounded-xs bg-primary px-md py-sm font-inter text-body-md font-bold text-white hover:bg-primary-dark">
              <span className="material-icons text-[20px]">add_circle</span>Cadastrar veículo
            </Link>
            <Link to="/carros" className="inline-flex items-center gap-xs rounded-xs border border-primary px-md py-sm font-inter text-body-md font-bold text-primary hover:bg-primary-light/30">
              <span className="material-icons text-[20px]">directions_car</span>Gerenciar frota
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
          <SummaryCard label="Cadastros aguardando" value={pendingProfiles} icon="badge" />
          <SummaryCard label="Reservas pendentes" value={pendingReservations} icon="event_available" />
          <SummaryCard label="Clientes cadastrados" value={profiles.length} icon="groups" />
        </div>

        {error ? <p role="alert" className="rounded-xs border border-feedback-negative bg-feedback-negative/10 p-md font-inter text-body-md text-feedback-negative">{error}</p> : null}
        {notice ? <p role="status" className="rounded-xs border border-feedback-positive bg-white p-md font-inter text-body-md text-feedback-positive">{notice}</p> : null}

        {loading ? (
          <p className="font-inter text-body-lg text-neutral-text py-xl text-center">Carregando painel...</p>
        ) : (
          <>
            <section className="flex flex-col gap-md" aria-labelledby="driver-profiles-title">
              <div>
                <h2 id="driver-profiles-title" className="font-exo font-bold text-heading-sm text-secondary">Cadastros de condutores</h2>
                <p className="font-inter text-body-sm text-neutral-text">A aprovação exige CPF, telefone e CNH válida.</p>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-md">
                {profiles.map((profile) => (
                  <article key={profile.user_id} className="bg-white rounded-modal shadow-elevation-1 p-lg flex flex-col gap-md">
                    <div className="flex flex-wrap items-start justify-between gap-sm">
                      <div>
                        <h3 className="font-exo font-bold text-heading-xs text-secondary">{profile.full_name ?? 'Perfil não criado'}</h3>
                        <p className="font-inter text-body-sm text-neutral-text">{profile.email}</p>
                      </div>
                      <StatusBadge value={profile.registration_status} />
                    </div>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-xs font-inter text-body-sm text-neutral-text">
                      <Data label="CPF" value={profile.cpf} />
                      <Data label="Telefone" value={profile.phone} />
                      <Data label="CNH" value={profile.cnh_number} />
                      <Data label="Categoria" value={profile.cnh_category} />
                      <Data label="Validade" value={formatDate(profile.cnh_expiration)} />
                      <Data label="UF emissora" value={profile.cnh_state} />
                    </dl>
                    {profile.review_note ? <p className="font-inter text-body-sm text-neutral-text"><strong>Última observação:</strong> {profile.review_note}</p> : null}
                    {profile.is_admin ? <p className="font-inter text-body-sm text-primary font-bold">Conta administradora</p> : null}
                    <label className="flex flex-col gap-xxs font-inter text-body-sm text-neutral-text">
                      Observação para o cliente
                      <textarea value={notes[profile.user_id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [profile.user_id]: event.target.value }))} maxLength={1000} rows={2} className="border border-neutral-text rounded-xs px-md py-sm outline-none focus:border-primary" />
                    </label>
                    <div className="flex flex-wrap gap-sm justify-end">
                      <Button size="sm" variant="ghost" disabled={working === `profile-${profile.user_id}`} onClick={() => void reviewProfile(profile, 'reprovado')}>Reprovar</Button>
                      <Button size="sm" disabled={working === `profile-${profile.user_id}`} onClick={() => void reviewProfile(profile, 'aprovado')}>Aprovar cadastro</Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-md" aria-labelledby="reservations-title">
              <div>
                <h2 id="reservations-title" className="font-exo font-bold text-heading-sm text-secondary">Reservas</h2>
                <p className="font-inter text-body-sm text-neutral-text">Confirme somente reservas de clientes aprovados.</p>
              </div>
              {reservations.length ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-md">
                  {reservations.map((reservation) => (
                    <article key={reservation.reservation_id} className="bg-white rounded-modal shadow-elevation-1 p-lg flex flex-col gap-md">
                      <div className="flex flex-wrap items-start justify-between gap-sm">
                        <div><h3 className="font-exo font-bold text-heading-xs text-secondary">{reservation.code}</h3><p className="font-inter text-body-sm text-neutral-text">{reservation.customer_name}</p></div>
                        <StatusBadge value={reservation.reservation_status} />
                      </div>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-xs font-inter text-body-sm text-neutral-text">
                        <Data label="Veículo" value={reservation.vehicle_name} />
                        <Data label="Cadastro" value={statusLabel(reservation.customer_status)} />
                        <Data label="Retirada" value={formatDateTime(reservation.pickup_at)} />
                        <Data label="Devolução" value={formatDateTime(reservation.return_at)} />
                        <Data label="Valor" value={formatMoney(reservation.total)} />
                      </dl>
                      {reservation.reservation_status === 'pendente' ? (
                        <div className="flex flex-wrap gap-sm justify-end">
                          <Button size="sm" variant="ghost" disabled={working === `reservation-${reservation.reservation_id}`} onClick={() => void reviewBooking(reservation, 'cancelada')}>Rejeitar</Button>
                          <Button size="sm" disabled={working === `reservation-${reservation.reservation_id}`} onClick={() => void reviewBooking(reservation, 'confirmada')}>Confirmar reserva</Button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : <p className="bg-white rounded-xs p-lg font-inter text-body-md text-neutral-text">Nenhuma reserva cadastrada.</p>}
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return <div className="bg-white rounded-modal shadow-elevation-1 p-lg flex items-center gap-md"><span className="material-icons text-[36px] text-primary">{icon}</span><div><strong className="font-exo text-heading-sm text-secondary">{value}</strong><p className="font-inter text-body-sm text-neutral-text">{label}</p></div></div>
}

function StatusBadge({ value }: { value: string | null }) {
  return <span className="rounded-full bg-neutral-background border border-neutral-details px-sm py-xxs font-inter text-body-sm font-bold text-neutral-text">{statusLabel(value)}</span>
}

function Data({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="font-bold">{label}</dt><dd>{value || 'Não informado'}</dd></div>
}
