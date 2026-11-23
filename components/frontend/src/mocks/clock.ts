import { Temporal } from '@js-temporal/polyfill'
import { TAXI_TIME_ZONE } from '../lib/time'
import type { ClockService } from '../services/contracts'

export const DEFAULT_DEMO_NOW = '2025-01-15T17:30:00-05:00'

/** A fixed snapshot; no real-time clock, replay state, or background timer. */
export function createMockClockService(now = DEFAULT_DEMO_NOW): ClockService {
  const asOf = Temporal.Instant.from(now).toString()
  return {
    async getCurrentTime(signal) {
      signal?.throwIfAborted()
      return { asOf, timeZone: TAXI_TIME_ZONE }
    },
  }
}
