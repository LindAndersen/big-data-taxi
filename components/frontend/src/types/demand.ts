import type { ClockSnapshot, DateRange, HourlyInterval } from './time'

export type DemandObservation =
  | { status: 'complete'; pickups: number }
  | { status: 'partial'; pickups: number; observedThrough: string }
  | { status: 'unavailable'; pickups: null }

export interface HourlyDemand {
  /** null means the derived All Zones aggregate, never an individual observation. */
  zoneId: number | null
  interval: HourlyInterval
  predictedPickups: number
  observation: DemandObservation
}

export interface ZoneHourlyDemand extends HourlyDemand {
  zoneId: number
}

export interface HourlyDemandRequest {
  date: string
  zoneId: number | null
}

export interface HourlyDemandResponse extends ClockSnapshot, HourlyDemandRequest {
  /** Individual rows for the requested zone, or all covered zones when zoneId is null. */
  zoneHours: ZoneHourlyDemand[]
  /** Chart series derived from zoneHours; never feed these aggregates into totals. */
  hours: HourlyDemand[]
}

export interface ModelEvaluation {
  sampleCount: number
  totalAbsoluteError: number
  totalActualPickups: number
  totalPredictedPickups: number
  /** Pickups per individual zone-hour; null when there are no eligible samples. */
  mae: number | null
  /** Percentage; null when there are no samples or summed actuals are zero. */
  wape: number | null
}

export interface DemandTotals {
  predictedPickups: number
  /** Includes partial counts; null means no observations, whereas zero is observed zero. */
  observedPickups: number | null
  completedObservedPickups: number | null
  completedZoneHours: number
  partialZoneHours: number
  unavailableZoneHours: number
}

export interface DailyDemandTotals extends DemandTotals {
  date: string
  /** Individual completed zone-hour evaluation for this calendar date. */
  evaluation: ModelEvaluation
}

export interface ZoneDemandTotals extends DemandTotals {
  zoneId: number
}

export interface DemandSummary extends ClockSnapshot {
  range: DateRange
  zoneCount: number
  totals: DemandTotals
  daily: DailyDemandTotals[]
  /** Ranked by completed actual pickups, with zone ID breaking ties; unknowns last. */
  zones: ZoneDemandTotals[]
  /** Uses completed actuals; null when there are no eligible observations. */
  busiestDay: { date: string; pickups: number } | null
  evaluation: ModelEvaluation
}

export interface EvaluationResponse extends ClockSnapshot {
  range: DateRange
  evaluation: ModelEvaluation
}
