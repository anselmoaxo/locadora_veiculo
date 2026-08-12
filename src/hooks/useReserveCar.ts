import { useCallback, useEffect, useRef, useState } from 'react'
import {
  reserveCarAtomic,
  type ReserveCarError,
  type ReserveCarInput,
  type ReserveCarResult,
} from '../services/reservations'

export type ReservationMutationStatus =
  | 'idle'
  | 'validating'
  | 'submitting'
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
      const result = await reserveCarAtomic(input, idempotencyKey)
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
