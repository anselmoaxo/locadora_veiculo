import { useCallback, useEffect, useState } from 'react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { Button } from '../components/ui/Button'
import { listMyReservationJobs, type MyReservationJob } from '../services/reservations'

const statusContent = {
  pending: { label: 'Na fila', className: 'text-primary-dark bg-primary-light' },
  processing: { label: 'Processando', className: 'text-primary-dark bg-primary-light' },
  succeeded: { label: 'Confirmada', className: 'text-feedback-positive bg-feedback-positive/10' },
  failed: { label: 'Não concluída', className: 'text-feedback-negative bg-feedback-negative/10' },
} as const

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function MyReservationsPage() {
  const [jobs, setJobs] = useState<MyReservationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setError('')
      setJobs(await listMyReservationJobs())
    } catch {
      setError('Não foi possível carregar suas reservas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      if (jobs.some((job) => job.status === 'pending' || job.status === 'processing')) void load()
    }, 5_000)
    return () => window.clearInterval(timer)
  }, [jobs, load])

  return (
    <div className="min-h-screen flex flex-col bg-neutral-background">
      <Header />
      <main className="flex-1 max-w-[1080px] mx-auto w-full px-md md:px-lg py-xl flex flex-col gap-lg">
        <Breadcrumbs items={[{ label: 'Início', href: '/' }, { label: 'Minhas reservas' }]} />
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-md">
          <div>
            <p className="font-inter text-body-sm font-bold uppercase tracking-[0.14em] text-primary-dark">Sua conta</p>
            <h1 className="font-exo font-bold text-heading-md text-secondary">Minhas reservas</h1>
          </div>
          <Button type="button" variant="ghost" onClick={() => void load()} icon="refresh">Atualizar</Button>
        </div>

        {loading ? <p className="font-inter text-body-md text-neutral-text">Carregando reservas...</p> : null}
        {error ? <p role="alert" className="rounded-xs border border-feedback-negative bg-white p-md text-feedback-negative">{error}</p> : null}
        {!loading && !error && jobs.length === 0 ? (
          <section className="rounded-modal bg-white p-xl text-center shadow-elevation-1">
            <span className="material-icons text-[56px] text-neutral-details">event_available</span>
            <h2 className="mt-md font-exo text-heading-xs text-secondary">Você ainda não possui reservas</h2>
          </section>
        ) : null}

        <div className="grid grid-cols-1 gap-md">
          {jobs.map((job) => {
            const status = statusContent[job.status]
            return (
              <article key={job.job_id} className="rounded-modal bg-white p-lg shadow-elevation-1 flex flex-col gap-md">
                <div className="flex flex-wrap items-start justify-between gap-md">
                  <div>
                    <p className="font-inter text-body-sm text-neutral-text">Solicitação {job.job_id.slice(0, 8).toUpperCase()}</p>
                    <h2 className="font-exo text-heading-xs text-secondary">{job.reservation_id ? `Reserva ${job.reservation_id.slice(0, 8).toUpperCase()}` : 'Reserva em processamento'}</h2>
                  </div>
                  <span className={`rounded-full px-md py-xs font-inter text-body-sm font-bold ${status.className}`}>{status.label}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm font-inter text-body-md text-neutral-text">
                  <p><strong>Retirada:</strong> {formatDate(job.start_at)}</p>
                  <p><strong>Devolução:</strong> {formatDate(job.end_at)}</p>
                </div>
                {job.status === 'failed' ? <p className="font-inter text-body-sm text-feedback-negative">Não foi possível concluir: {job.error_code ?? 'erro interno'}.</p> : null}
              </article>
            )
          })}
        </div>
      </main>
      <Footer />
    </div>
  )
}
