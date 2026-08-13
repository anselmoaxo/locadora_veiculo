import { useCallback, useEffect, useRef, useState } from 'react'
import {
  reserveCarAtomic,
  getReservationJob,
  ReserveCarError,
  type ReserveCarInput,
  type ReserveCarResult,
} from '../services/reservations'

export type ReservationMutationStatus =
  | 'idle'
  | 'validating'
  | 'submitting'
  | 'queued'
  | 'processing'
  | 'success'
  | 'error'

interface PendingAttempt {
  fingerprint: string
  idempotencyKey: string
}

interface ReservationMutationState {
  status: ReservationMutationStatus
  result: ReserveCarResult | null
  error: ReserveCarError | null
}

const storageKey = 'reserve-car:pending-attempt'
const pollIntervalMs = 2_000
const maximumPolls = 50

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function readAttempt(): PendingAttempt | null {
  try {
    const value = sessionStorage.getItem(storageKey)
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<PendingAttempt>
    return parsed.fingerprint && parsed.idempotencyKey
      ? { fingerprint: parsed.fingerprint, idempotencyKey: parsed.idempotencyKey }
      : null
  } catch {
    return null
  }
}

function saveAttempt(attempt: PendingAttempt) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(attempt))
  } catch {
    // A tentativa continua protegida em memória quando o storage está indisponível.
  }
}

function clearAttempt() {
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    // Sem ação: o navegador pode bloquear sessionStorage em modos restritos.
  }
}

export function reservationFingerprint(input: ReserveCarInput): string {
  return JSON.stringify({
    carId: input.carId,
    startAt: input.startAt,
    endAt: input.endAt,
    pickupLocationId: input.pickupLocationId ?? null,
    dropoffLocationId: input.dropoffLocationId ?? null,
    notes: input.notes?.trim() || null,
  })
}

const initialState: ReservationMutationState = {
  status: 'idle',
  result: null,
  error: null,
}

export function useReserveCar(currentFingerprint: string) {
  const [state, setState] = useState<ReservationMutationState>(initialState)
  const inFlight = useRef(false)

  useEffect(() => {
    const pending = readAttempt()
    if (pending && pending.fingerprint !== currentFingerprint) clearAttempt()
    setState((current) => current.status === 'submitting' ? current : initialState)
  }, [currentFingerprint])

  const reserve = useCallback(async (input: ReserveCarInput) => {
    if (inFlight.current) return null
    inFlight.current = true
    const fingerprint = reservationFingerprint(input)
    const pending = readAttempt()
    const idempotencyKey = pending?.fingerprint === fingerprint
      ? pending.idempotencyKey
      : crypto.randomUUID()
    saveAttempt({ fingerprint, idempotencyKey })

    setState({ status: 'validating', result: null, error: null })
    await Promise.resolve()
    setState({ status: 'submitting', result: null, error: null })

    try {
      const queuedJob = await reserveCarAtomic(input, idempotencyKey)
      setState({ status: queuedJob.status === 'processing' ? 'processing' : 'queued', result: null, error: null })

      let job = queuedJob
      if (job.status === 'succeeded' || job.status === 'failed') {
        job = await getReservationJob(job.job_id)
      }
      for (let poll = 0; poll < maximumPolls && !['succeeded', 'failed'].includes(job.status); poll += 1) {
        await wait(pollIntervalMs)
        job = await getReservationJob(job.job_id)
        setState({ status: job.status === 'processing' ? 'processing' : 'queued', result: null, error: null })
      }

      if (job.status === 'failed') {
        throw new ReserveCarError(409, job.error_code ?? 'INTERNAL_ERROR')
      }
      if (job.status !== 'succeeded' || !job.result) {
        throw new ReserveCarError(504, 'QUEUE_TIMEOUT')
      }

      const result = job.result
      clearAttempt()
      setState({ status: 'success', result, error: null })
      return result
    } catch (error) {
      const reservationError = error as ReserveCarError
      if (!reservationError.retryable) clearAttempt()
      setState({ status: 'error', result: null, error: reservationError })
      throw reservationError
    } finally {
      inFlight.current = false
    }
  }, [])

  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  return { ...state, reserve, reset }
}
