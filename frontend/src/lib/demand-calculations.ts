import { Temporal } from '@js-temporal/polyfill'
import type {
  DemandObservation, DemandSummary, DemandTotals, HourlyDemand, ModelEvaluation, ZoneDemandTotals,
} from '../types/demand'
import type { DateRange, HourlyInterval } from '../types/time'
import { getDatesInRange, TAXI_TIME_ZONE } from './time'

interface HourGroup {
  interval: HourlyInterval
  predicted: number
  observed: number
  count: number
  available: number
  completed: number
  observedThrough: string
}

/** Aggregate only individual zone rows, grouping by instant rather than repeated wall-clock hours. */
export function aggregateHourlyDemand(records: Iterable<HourlyDemand>, zoneId: number | null = null): HourlyDemand[] {
  const groups = new Map<string, HourGroup>()
  for (const record of records) {
    if (record.zoneId === null || (zoneId !== null && record.zoneId !== zoneId)) continue
    let group = groups.get(record.interval.start)
    if (!group) {
      group = { interval: record.interval, predicted: 0, observed: 0, count: 0, available: 0, completed: 0, observedThrough: '' }
      groups.set(record.interval.start, group)
    }
    group.count += 1
    group.predicted += record.predictedPickups
    const observation = record.observation
    if (observation.status !== 'unavailable') {
      group.available += 1
      group.observed += observation.pickups
      if (observation.status === 'complete') group.completed += 1
      const through = observation.status === 'partial' ? observation.observedThrough : record.interval.end
      if (!group.observedThrough || Date.parse(through) > Date.parse(group.observedThrough)) group.observedThrough = through
    }
  }
  return [...groups.values()]
    .sort((a, b) => Date.parse(a.interval.start) - Date.parse(b.interval.start))
    .map((group) => {
      let observation: DemandObservation = { status: 'unavailable', pickups: null }
      if (group.available > 0) {
        observation = group.completed === group.count
          ? { status: 'complete', pickups: group.observed }
          : { status: 'partial', pickups: group.observed, observedThrough: group.observedThrough }
      }
      return { zoneId, interval: group.interval, predictedPickups: group.predicted, observation }
    })
}

type EvaluationSums = Omit<ModelEvaluation, 'mae' | 'wape'>

function emptyEvaluation(): EvaluationSums {
  return { sampleCount: 0, totalAbsoluteError: 0, totalActualPickups: 0, totalPredictedPickups: 0 }
}

/** Shared eligibility rule for metrics, completed totals, and busiest rankings. */
function isCompleted(record: HourlyDemand, asOfMs: number): boolean {
  return record.zoneId !== null && record.observation.status === 'complete' && Date.parse(record.interval.end) <= asOfMs
}

function addEvaluation(sums: EvaluationSums, record: HourlyDemand, asOfMs: number): void {
  if (!isCompleted(record, asOfMs) || record.observation.status !== 'complete') return
  sums.sampleCount += 1
  sums.totalAbsoluteError += Math.abs(record.observation.pickups - record.predictedPickups)
  sums.totalActualPickups += record.observation.pickups
  sums.totalPredictedPickups += record.predictedPickups
}

function finishEvaluation(sums: EvaluationSums): ModelEvaluation {
  return {
    ...sums,
    mae: sums.sampleCount > 0 ? sums.totalAbsoluteError / sums.sampleCount : null,
    wape: sums.sampleCount > 0 && sums.totalActualPickups > 0
      ? sums.totalAbsoluteError / sums.totalActualPickups * 100
      : null,
  }
}

/** Evaluate individual, completed zone-hours; All Zones rows and incomplete actuals are excluded. */
export function calculateEvaluation(records: Iterable<HourlyDemand>, asOf: string): ModelEvaluation {
  const asOfMs = Temporal.Instant.from(asOf).epochMilliseconds
  const sums = emptyEvaluation()
  for (const record of records) addEvaluation(sums, record, asOfMs)
  return finishEvaluation(sums)
}

function emptyTotals(): DemandTotals {
  return {
    predictedPickups: 0,
    observedPickups: null,
    completedObservedPickups: null,
    completedZoneHours: 0,
    partialZoneHours: 0,
    unavailableZoneHours: 0,
  }
}

/** Include partial actual counts in observed totals, while keeping comparable completed totals separate. */
function addTotals(totals: DemandTotals, record: HourlyDemand, asOfMs: number): void {
  totals.predictedPickups += record.predictedPickups
  if (isCompleted(record, asOfMs) && record.observation.status === 'complete') {
    totals.observedPickups = (totals.observedPickups ?? 0) + record.observation.pickups
    totals.completedObservedPickups = (totals.completedObservedPickups ?? 0) + record.observation.pickups
    totals.completedZoneHours += 1
  } else if (record.observation.status === 'partial'
    && Date.parse(record.interval.start) <= asOfMs
    && Date.parse(record.observation.observedThrough) <= asOfMs) {
    totals.observedPickups = (totals.observedPickups ?? 0) + record.observation.pickups
    totals.partialZoneHours += 1
  } else {
    totals.unavailableZoneHours += 1
  }
}

/** One pass over zone-hour records; forecasts cover the full range, actuals cover availability through asOf. */
export function summarizeDemand(records: Iterable<HourlyDemand>, range: DateRange, asOf: string): DemandSummary {
  const dates = getDatesInRange(range)
  const instant = Temporal.Instant.from(asOf)
  const asOfMs = instant.epochMilliseconds
  const daily = new Map(dates.map((date) => [date, { date, ...emptyTotals() }]))
  const dailyEvaluation = new Map(dates.map((date) => [date, emptyEvaluation()]))
  const zones = new Map<number, ZoneDemandTotals>()
  const totals = emptyTotals()
  const evaluation = emptyEvaluation()
  for (const record of records) {
    if (record.zoneId === null) continue
    const day = daily.get(record.interval.date)
    if (!day) continue
    let zone = zones.get(record.zoneId)
    if (!zone) {
      zone = { zoneId: record.zoneId, ...emptyTotals() }
      zones.set(record.zoneId, zone)
    }
    addTotals(totals, record, asOfMs)
    addTotals(day, record, asOfMs)
    addTotals(zone, record, asOfMs)
    addEvaluation(evaluation, record, asOfMs)
    addEvaluation(dailyEvaluation.get(record.interval.date)!, record, asOfMs)
  }
  const days = [...daily.values()].map((day) => ({ ...day, evaluation: finishEvaluation(dailyEvaluation.get(day.date)!) }))
  let busiestDay: DemandSummary['busiestDay'] = null
  for (const day of days) {
    if (day.completedObservedPickups !== null
      && (busiestDay === null || day.completedObservedPickups > busiestDay.pickups)) {
      busiestDay = { date: day.date, pickups: day.completedObservedPickups }
    }
  }
  const rankedZones = [...zones.values()].sort((a, b) => {
    if (a.completedObservedPickups === null && b.completedObservedPickups !== null) return 1
    if (b.completedObservedPickups === null && a.completedObservedPickups !== null) return -1
    return (b.completedObservedPickups ?? 0) - (a.completedObservedPickups ?? 0) || a.zoneId - b.zoneId
  })
  return {
    range: { ...range },
    asOf: instant.toString(),
    timeZone: TAXI_TIME_ZONE,
    zoneCount: zones.size,
    totals,
    daily: days,
    zones: rankedZones,
    busiestDay,
    evaluation: finishEvaluation(evaluation),
  }
}
