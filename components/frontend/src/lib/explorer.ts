import { Temporal } from '@js-temporal/polyfill'
import type { DemandTotals, HourlyDemand } from '../types/demand'
import type { ClockSnapshot } from '../types/time'
import { getDayIntervals, parseDate, TAXI_TIME_ZONE } from './time'

export interface ExplorerSelection {
  date: string
  zoneId: number | null
  intervalStart: string | null
}

export type ExplorerAction =
  | { type: 'date'; date: string }
  | { type: 'zone'; zoneId: number | null }
  | { type: 'hour'; intervalStart: string | null }

/** Start at the fixed New York date, with the general daily view selected. */
export function createExplorerSelection(clock: ClockSnapshot): ExplorerSelection {
  const date = Temporal.Instant.from(clock.asOf).toZonedDateTimeISO(TAXI_TIME_ZONE).toPlainDate().toString()
  return { date, zoneId: null, intervalStart: null }
}

/** Date/zone are shared; an optional interval controls only graph and information detail. */
export function explorerReducer(state: ExplorerSelection, action: ExplorerAction): ExplorerSelection {
  if (action.type === 'zone') return { ...state, zoneId: action.zoneId }
  if (action.type === 'hour') {
    return action.intervalStart === null || getDayIntervals(state.date).some((hour) => hour.start === action.intervalStart)
      ? { ...state, intervalStart: action.intervalStart }
      : state
  }
  parseDate(action.date)
  return action.date === state.date ? state : { ...state, date: action.date, intervalStart: null }
}

export function getDateMode(date: string, asOf: string): 'past' | 'current' | 'future' {
  const today = Temporal.Instant.from(asOf).toZonedDateTimeISO(TAXI_TIME_ZONE).toPlainDate()
  const comparison = Temporal.PlainDate.compare(parseDate(date), today)
  return comparison < 0 ? 'past' : comparison > 0 ? 'future' : 'current'
}

export function formatExplorerDate(date: string): string {
  return parseDate(date).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/** Unlike evaluation metrics, the selected-hour comparison can include an All Zones aggregate. */
export function getCompletedDifference(hour: HourlyDemand, asOf: string): number | null {
  return hour.observation.status === 'complete' && Date.parse(hour.interval.end) <= Date.parse(asOf)
    ? hour.observation.pickups - hour.predictedPickups
    : null
}

/** Full-day forecasts may only be compared against complete coverage of that entire day. */
export function getDailyDifference(totals: DemandTotals, expectedZoneHours: number): number | null {
  return expectedZoneHours > 0 && totals.completedZoneHours === expectedZoneHours
    && totals.partialZoneHours === 0 && totals.unavailableZoneHours === 0 && totals.observedPickups !== null
    ? totals.observedPickups - totals.predictedPickups
    : null
}
