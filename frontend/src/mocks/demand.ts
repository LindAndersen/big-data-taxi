import { Temporal } from '@js-temporal/polyfill'
import { getDayIntervals, getDatesInRange, parseDate } from '../lib/time'
import type { DemandObservation, ZoneHourlyDemand } from '../types/demand'
import type { DateRange, HourlyInterval } from '../types/time'
import type { TaxiZone } from '../types/zones'
import { deterministicFraction } from './deterministic'

// Expected hourly demand shapes, scaled by each zone's profile. All fixtures live here.
const WEEKDAY_PATTERN = [0.23, 0.16, 0.11, 0.09, 0.1, 0.19, 0.38, 0.7, 0.94, 0.85, 0.72, 0.76, 0.87, 0.91, 0.95, 1.02, 1.14, 1.32, 1.4, 1.25, 1.04, 0.86, 0.67, 0.43]
const WEEKEND_PATTERN = [0.7, 0.59, 0.43, 0.28, 0.16, 0.12, 0.17, 0.27, 0.41, 0.58, 0.76, 0.91, 1.04, 1.1, 1.13, 1.14, 1.16, 1.25, 1.3, 1.23, 1.12, 1.01, 0.9, 0.79]
const ZONE_VOLUMES: Record<number, number> = {
  43: 75, 48: 260, 68: 210, 79: 170, 87: 180, 88: 140, 100: 230,
  103: 1, 104: 1, 105: 2, 120: 5, 127: 20, 128: 4, 153: 8,
  161: 420, 162: 330, 163: 350, 164: 300, 170: 240, 186: 360,
  194: 12, 202: 18, 230: 370, 236: 220, 237: 270, 238: 165, 239: 195,
}
const NIGHTLIFE_ZONES = new Set([4, 45, 79, 113, 114, 144, 148, 158, 211, 249])
const BUSINESS_ZONES = new Set([87, 88, 100, 161, 162, 163, 164, 170, 186, 230, 261])

/** Reveal latent actual counts only through asOf; a partial hour is never a full actual. */
function observeHour(interval: HourlyInterval, fullActual: number, asOfMs: number, asOf: string): DemandObservation {
  const start = Date.parse(interval.start)
  const end = Date.parse(interval.end)
  if (asOfMs < start) return { status: 'unavailable', pickups: null }
  if (asOfMs >= end) return { status: 'complete', pickups: fullActual }
  return {
    status: 'partial',
    pickups: Math.floor(fullActual * (asOfMs - start) / (end - start)),
    observedThrough: asOf,
  }
}

/** Generate each unique zone-hour once, with weekday, zone, seasonal, and forecast-error variation. */
export function generateDemand(zones: readonly TaxiZone[], date: string, asOf: string): ZoneHourlyDemand[] {
  if (new Set(zones.map((zone) => zone.id)).size !== zones.length) throw new Error('Demand generation requires unique zone IDs.')
  const day = parseDate(date)
  const instant = Temporal.Instant.from(asOf)
  const normalizedAsOf = instant.toString()
  const weekend = day.dayOfWeek >= 6
  const pattern = weekend ? WEEKEND_PATTERN : WEEKDAY_PATTERN
  const season = 1 + 0.08 * Math.cos(2 * Math.PI * day.dayOfYear / day.daysInYear)
  const daily = 0.92 + deterministicFraction(`demand-day:${date}`) * 0.16
  const intervals = getDayIntervals(date)
  return zones.flatMap((zone) => {
    const volume = ZONE_VOLUMES[zone.id] ?? 35 + deterministicFraction(`zone-volume:${zone.id}`) * 120
    return intervals.map((interval) => {
      const nightlife = NIGHTLIFE_ZONES.has(zone.id) && (interval.hour >= 21 || interval.hour <= 2) ? 1.8 : 1
      const business = BUSINESS_ZONES.has(zone.id) && weekend ? 0.65 : 1
      const park = zone.id === 43 ? interval.hour >= 8 && interval.hour <= 18 ? 1.7 : 0.25 : 1
      const localVariation = 0.9 + deterministicFraction(`forecast:${zone.id}:${interval.start}`) * 0.2
      const predictedPickups = Math.max(0, Math.round(volume * pattern[interval.hour] * season * daily * nightlife * business * park * localVariation))
      const errorFactor = 0.8 + deterministicFraction(`actual:${zone.id}:${interval.start}`) * 0.4
      const fullActual = Math.max(0, Math.round(predictedPickups * errorFactor))
      return {
        zoneId: zone.id,
        interval,
        predictedPickups,
        observation: observeHour(interval, fullActual, instant.epochMilliseconds, normalizedAsOf),
      }
    })
  })
}

/** Yield one date at a time so range calculations need not retain every raw observation. */
export function* generateDemandRange(zones: readonly TaxiZone[], range: DateRange, asOf: string): Generator<ZoneHourlyDemand> {
  for (const date of getDatesInRange(range)) yield* generateDemand(zones, date, asOf)
}
