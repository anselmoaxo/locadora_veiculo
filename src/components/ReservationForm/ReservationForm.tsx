import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { useReserveCar, reservationFingerprint } from '../../hooks/useReserveCar'
import {
  ReserveCarError,
  type ReserveCarInput,
  type ReserveCarResult,
} from '../../services/reservations'

interface ReservationFormValues {
  startAt: string
  endAt: string
  notes: string
}

type ReservationFormErrors = Partial<Record<keyof ReservationFormValues | 'form', string>>

interface ReservationFormProps {
  carId: string
  pricePerDay: number
  pickupLocationId?: string | null
  dropoffLocationId?: string | null
  initialStartAt?: string
  initialEndAt?: string
  onSuccess?: (result: ReserveCarResult) => void
  onAuthRequired: () => void
  onProfileRequired?: () => void
  onChooseAnotherCar?: () => void
}

const minimumDurationMs = 60 * 60_000
const maximumDurationMs = 30 * 24 * 60 * 60_000
const pastToleranceMs = 5 * 60_000

function toLocalInputValue(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function toIso(value: string): string | null {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function validate(values: ReservationFormValues): ReservationFormErrors {
  const errors: ReservationFormErrors = {}
  const start = values.startAt ? new Date(values.startAt).getTime() : Number.NaN
  const end = values.endAt ? new Date(values.endAt).getTime() : Number.NaN

  if (!values.startAt || Number.isNaN(start)) {
    errors.startAt = 'Informe a data e o horário de retirada.'
  } else if (start < Date.now() - pastToleranceMs) {
    errors.startAt = 'A retirada precisa estar no futuro.'
  }

  if (!values.endAt || Number.isNaN(end)) {
    errors.endAt = 'Informe a data e o horário de devolução.'
  } else if (!Number.isNaN(start) && end <= start) {
    errors.endAt = 'A devolução deve acontecer depois da retirada.'
  } else if (!Number.isNaN(start) && end - start < minimumDurationMs) {
    errors.endAt = 'A reserva deve durar pelo menos 1 hora.'
  } else if (!Number.isNaN(start) && end - start > maximumDurationMs) {
    errors.endAt = 'A reserva pode durar no máximo 30 dias.'
  }

  if (values.notes.length > 2000) errors.notes = 'Use no máximo 2.000 caracteres.'
  return errors
}

function estimatedPrice(values: ReservationFormValues, pricePerDay: number): number | null {
  const start = new Date(values.startAt).getTime()
  const end = new Date(values.endAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null
  return Math.max(1, Math.ceil((end - start) / 86_400_000)) * pricePerDay
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function serverFieldErrors(error: ReserveCarError): ReservationFormErrors {
  const byCode: Record<string, ReservationFormErrors> = {
    START_AT_IN_THE_PAST: { startAt: error.message },
    INVALID_RESERVATION_PERIOD: { endAt: error.message },
    MINIMUM_DURATION_IS_ONE_HOUR: { endAt: error.message },
    MAXIMUM_DURATION_IS_90_DAYS: { endAt: 'A reserva pode durar no máximo 30 dias.' },
    NOTES_TOO_LONG: { notes: error.message },
    LOCATION_UNAVAILABLE: { form: error.message },
  }
  return byCode[error.code] ?? { form: error.message }
}

export function ReservationForm({
  carId,
  pricePerDay,
  pickupLocationId,
  dropoffLocationId,
  initialStartAt,
  initialEndAt,
  onSuccess,
  onAuthRequired,
  onProfileRequired,
  onChooseAnotherCar,
}: ReservationFormProps) {
  const [values, setValues] = useState<ReservationFormValues>({
    startAt: toLocalInputValue(initialStartAt),
    endAt: toLocalInputValue(initialEndAt),
    notes: '',
  })
  const [touched, setTouched] = useState<Partial<Record<keyof ReservationFormValues, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [remoteErrors, setRemoteErrors] = useState<ReservationFormErrors>({})
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const input = useMemo<ReserveCarInput>(() => ({
    carId,
    startAt: toIso(values.startAt) ?? values.startAt,
    endAt: toIso(values.endAt) ?? values.endAt,
    pickupLocationId: pickupLocationId ?? null,
    dropoffLocationId: dropoffLocationId ?? pickupLocationId ?? null,
    notes: values.notes,
  }), [carId, dropoffLocationId, pickupLocationId, values])
  const fingerprint = useMemo(() => reservationFingerprint(input), [input])
  const mutation = useReserveCar(fingerprint)
  const clientErrors = useMemo(() => validate(values), [values])
  const errors = { ...clientErrors, ...remoteErrors }
  const estimate = estimatedPrice(values, pricePerDay)
  const busy = ['validating', 'submitting', 'queued', 'processing'].includes(mutation.status)
  const invalid = Boolean(clientErrors.startAt || clientErrors.endAt || clientErrors.notes)

  function change(field: keyof ReservationFormValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }))
      setTouched((current) => ({ ...current, [field]: true }))
      setRemoteErrors({})
      mutation.reset()
    }
  }

  function visibleError(field: keyof ReservationFormValues) {
    return submitted || touched[field] ? errors[field] : undefined
  }

  function focusFirstInvalid(validationErrors: ReservationFormErrors) {
    if (validationErrors.startAt) startRef.current?.focus()
    else if (validationErrors.endAt) endRef.current?.focus()
    else if (validationErrors.notes) notesRef.current?.focus()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setSubmitted(true)
    setRemoteErrors({})
    const validationErrors = validate(values)
    if (Object.keys(validationErrors).length) {
      focusFirstInvalid(validationErrors)
      return
    }

    try {
      const result = await mutation.reserve(input)
      if (result) onSuccess?.(result)
    } catch (cause) {
      const error = cause instanceof ReserveCarError
        ? cause
        : new ReserveCarError(500, 'INTERNAL_ERROR')
      if (error.status === 401 || error.status === 403) {
        onAuthRequired()
        return
      }
      const mapped = serverFieldErrors(error)
      setRemoteErrors(mapped)
      if (error.status === 400) focusFirstInvalid(mapped)
    }
  }

  const message = mutation.error?.status === 409
    && mutation.error.code === 'CAR_UNAVAILABLE'
    ? 'Esse carro não está disponível nesse período.'
    : mutation.error?.message
  const profileIssue = Boolean(mutation.error && [
    'PROFILE_INCOMPLETE',
    'PROFILE_PENDING_APPROVAL',
    'PROFILE_REJECTED',
    'DRIVER_LICENSE_EXPIRED',
  ].includes(mutation.error.code))

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-md">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
        <TextField
          ref={startRef}
          id="reservation-start-at"
          label="Retirada"
          type="datetime-local"
          value={values.startAt}
          onChange={change('startAt')}
          onBlur={() => setTouched((current) => ({ ...current, startAt: true }))}
          error={visibleError('startAt')}
          disabled={busy || mutation.status === 'success'}
          required
        />
        <TextField
          ref={endRef}
          id="reservation-end-at"
          label="Devolução"
          type="datetime-local"
          value={values.endAt}
          onChange={change('endAt')}
          onBlur={() => setTouched((current) => ({ ...current, endAt: true }))}
          error={visibleError('endAt')}
          disabled={busy || mutation.status === 'success'}
          required
        />
      </div>

      <div className="flex flex-col gap-xxs">
        <label htmlFor="reservation-notes" className="font-inter text-body-md text-neutral-text">
          Observações <span className="text-body-sm">(opcional)</span>
        </label>
        <textarea
          ref={notesRef}
          id="reservation-notes"
          value={values.notes}
          onChange={change('notes')}
          onBlur={() => setTouched((current) => ({ ...current, notes: true }))}
          disabled={busy || mutation.status === 'success'}
          maxLength={2000}
          rows={3}
          aria-invalid={Boolean(visibleError('notes'))}
          aria-describedby={visibleError('notes') ? 'reservation-notes-error' : undefined}
          className={`w-full border rounded-xs px-md py-sm font-inter text-body-md text-neutral-text outline-none transition-colors ${visibleError('notes') ? 'border-feedback-negative' : 'border-neutral-text focus:border-primary'}`}
        />
        <div className="flex justify-between gap-sm">
          <span id="reservation-notes-error" className="font-inter text-body-sm text-feedback-negative">
            {visibleError('notes')}
          </span>
          <span className="font-inter text-body-sm text-neutral-text">{values.notes.length}/2000</span>
        </div>
      </div>

      <div className="rounded-xs bg-neutral-background border border-neutral-divisor p-md flex items-center justify-between gap-md">
        <span className="font-inter text-body-md text-neutral-text">Valor estimado</span>
        <strong className="font-exo text-heading-xs text-primary">
          {estimate === null ? 'Informe o período' : formatCurrency(estimate)}
        </strong>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {mutation.status === 'queued' || mutation.status === 'processing' ? (
          <div role="status" className="rounded-xs border border-primary bg-primary-light/40 p-md text-primary-dark">
            <p className="font-exo font-bold text-heading-xs">
              {mutation.status === 'queued' ? 'Reserva recebida' : 'Processando reserva'}
            </p>
            <p className="font-inter text-body-sm text-neutral-text">
              Estamos confirmando a disponibilidade. Esta página será atualizada automaticamente.
            </p>
          </div>
        ) : null}

        {mutation.status === 'success' && mutation.result ? (
          <div role="status" className="rounded-xs border border-feedback-positive bg-white p-md text-feedback-positive">
            <p className="font-exo font-bold text-heading-xs">Reserva criada!</p>
            <p className="font-inter text-body-sm text-neutral-text">
              Protocolo {mutation.result.reservation_id.slice(0, 8).toUpperCase()} â€” status pendente.
            </p>
          </div>
        ) : null}

        {mutation.status === 'error' && message ? (
          <div role="alert" className="rounded-xs border border-feedback-negative bg-white p-md flex flex-col gap-sm">
            <p className="font-inter text-body-md text-feedback-negative">{message}</p>
            {profileIssue && onProfileRequired ? (
              <Button type="button" size="sm" onClick={onProfileRequired}>
                Abrir meu cadastro
              </Button>
            ) : mutation.error?.status === 409 ? (
              <div className="flex flex-wrap gap-xs">
                <Button type="button" size="sm" variant="ghost" onClick={() => startRef.current?.focus()}>
                  Ajustar datas
                </Button>
                {onChooseAnotherCar ? (
                  <Button type="button" size="sm" variant="ghost" onClick={onChooseAnotherCar}>
                    Escolher outro carro
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {errors.form && mutation.status !== 'error' ? (
          <p role="alert" className="font-inter text-body-sm text-feedback-negative">{errors.form}</p>
        ) : null}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={busy || invalid || mutation.status === 'success'}
        aria-busy={busy}
      >
        {busy ? (
          <><span className="material-icons animate-spin text-[20px]" aria-hidden="true">progress_activity</span>{mutation.status === 'queued' ? 'Na fila...' : mutation.status === 'processing' ? 'Processando...' : 'Enviando...'}</>
        ) : mutation.status === 'success' ? 'Reserva criada' : mutation.error?.retryable ? 'Tentar novamente' : 'Reservar agora'}
      </Button>
    </form>
  )
}
