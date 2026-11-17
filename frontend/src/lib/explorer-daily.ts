import type { DemandSummary } from '../types/demand'
import type { DailyWeatherSummary, HourlyWeather } from '../types/weather'
import { getDateMode } from './explorer'
import { getDayIntervals, TAXI_TIME_ZONE } from './time'
import { DAILY_DEMAND_SCALE_MAXIMUM } from './map-demand'

export type MapDemandMetric = 'observed' | 'predicted'

/** Aggregate daily map values independently of zone/hour selection; unavailable is not zero. */
export function getDailyMapMetric(summary: DemandSummary, metric: MapDemandMetric) {
  const mode = getDateMode(summary.range.startDate, summary.asOf)
  const values = new Map<number, number>()
  for (const zone of summary.zones) {
    const value = metric === 'predicted' ? zone.predictedPickups
      : mode === 'future' ? null : mode === 'past' ? zone.completedObservedPickups : zone.observedPickups
    if (value !== null) values.set(zone.zoneId, value)
  }
  const cutoff = new Intl.DateTimeFormat('en-US', { timeZone: TAXI_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).format(new Date(summary.asOf))
  return {
    values,
    maximum: DAILY_DEMAND_SCALE_MAXIMUM,
    label: metric === 'predicted' ? 'Predicted daily pickups' : 'Observed daily pickups',
    period: metric === 'predicted' ? 'Full day · 00:00–24:00 New York'
      : mode === 'future' ? 'No observations available for this future date'
        : mode === 'current' ? `Observed so far · 00:00–${cutoff}`
          : 'Completed observations · 00:00–24:00 New York',
  }
}

/** Summarize all real elapsed weather hours, retaining 23/25-hour and missing-hour coverage. */
export function summarizeDailyWeather(hours: readonly HourlyWeather[], date: string): DailyWeatherSummary | undefined {
  const selected = hours.filter((hour) => hour.interval.date === date)
  if (!selected.length) return undefined
  return {
    temperatureMinC: Math.min(...selected.map((hour) => hour.temperatureC)),
    temperatureMaxC: Math.max(...selected.map((hour) => hour.temperatureC)),
    precipitationMm: selected.reduce((sum, hour) => sum + hour.precipitationMm, 0),
    meanWindSpeedKmh: selected.reduce((sum, hour) => sum + hour.windSpeedKmh, 0) / selected.length,
    conditions: [...new Set(selected.map((hour) => hour.condition))],
    hourCount: selected.length,
    expectedHourCount: getDayIntervals(date).length,
  }
}
