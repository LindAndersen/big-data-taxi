import { describe, expect, it } from 'vitest'
import { summarizeDemand } from './demand-calculations'
import { getDailyMapMetric, summarizeDailyWeather } from './explorer-daily'
import { getDailyDifference } from './explorer'
import { getDayIntervals } from './time'
import { getDemandColor } from './map-demand'
import type { DemandTotals, HourlyDemand } from '../types/demand'
import type { HourlyWeather } from '../types/weather'

describe('daily demand map', () => {
  const intervals = getDayIntervals('2025-01-15')
  const rows: HourlyDemand[] = [
    { zoneId: 43, interval: intervals[0], predictedPickups: 100, observation: { status: 'complete', pickups: 80 } },
    { zoneId: 43, interval: intervals[17], predictedPickups: 200, observation: { status: 'partial', pickups: 40, observedThrough: '2025-01-15T22:30:00Z' } },
    { zoneId: 43, interval: intervals[18], predictedPickups: 300, observation: { status: 'unavailable', pickups: null } },
    { zoneId: 161, interval: intervals[0], predictedPickups: 5, observation: { status: 'complete', pickups: 0 } },
  ]
  const summary = summarizeDemand(rows, { startDate: '2025-01-15', endDate: '2025-01-15' }, '2025-01-15T22:30:00Z')

  it('uses full daily forecasts or cumulative observations, including partial current-hour counts', () => {
    const observed = getDailyMapMetric(summary, 'observed')
    const predicted = getDailyMapMetric(summary, 'predicted')
    expect(observed.values.get(43)).toBe(120)
    expect(predicted.values.get(43)).toBe(600)
    expect(observed.values.get(161)).toBe(0)
    expect(observed.period).toContain('00:00–17:30 EST')
    expect(predicted.period).toContain('Full day')
  })

  it('preserves one numerical scale across metrics and dates', () => {
    const observed = getDailyMapMetric(summary, 'observed')
    const predicted = getDailyMapMetric(summary, 'predicted')
    const anotherDay = getDailyMapMetric({ ...summary, range: { startDate: '2025-01-14', endDate: '2025-01-14' } }, 'observed')
    expect(observed.maximum).toBe(predicted.maximum)
    expect(observed.maximum).toBe(anotherDay.maximum)
    expect(getDemandColor(2000, observed.maximum)).toBe(getDemandColor(2000, anotherDay.maximum))
  })

  it('has no future observed values while retaining forecasts and explicit unavailable labels', () => {
    const future = summarizeDemand(rows, summary.range, '2025-01-14T12:00:00Z')
    const observed = getDailyMapMetric(future, 'observed')
    expect(observed.values.size).toBe(0)
    expect(observed.period).toContain('No observations')
    expect(getDailyMapMetric(future, 'predicted').values.get(43)).toBe(600)
  })

  it('uses completed observations for historical map totals', () => {
    const historical = { ...summary, asOf: '2025-01-16T12:00:00Z' }
    expect(getDailyMapMetric(historical, 'observed').values.get(43)).toBe(80)
    expect(getDailyMapMetric(historical, 'observed').period).toContain('Completed observations')
  })
})

describe('daily comparisons', () => {
  const totals: DemandTotals = { predictedPickups: 100, observedPickups: 80, completedObservedPickups: 80, completedZoneHours: 24, partialZoneHours: 0, unavailableZoneHours: 0 }
  it('compares only a complete day, preserving valid observed zero', () => {
    expect(getDailyDifference(totals, 24)).toBe(-20)
    expect(getDailyDifference({ ...totals, observedPickups: 0, completedObservedPickups: 0 }, 24)).toBe(-100)
  })
  it('rejects partial, missing, future, and incomplete supplied coverage', () => {
    expect(getDailyDifference({ ...totals, completedZoneHours: 23, partialZoneHours: 1 }, 24)).toBeNull()
    expect(getDailyDifference({ ...totals, completedZoneHours: 23, unavailableZoneHours: 1 }, 24)).toBeNull()
    expect(getDailyDifference({ ...totals, completedZoneHours: 23 }, 24)).toBeNull()
    expect(getDailyDifference({ ...totals, observedPickups: null }, 24)).toBeNull()
    expect(getDailyDifference(totals, 0)).toBeNull()
  })
})

describe('daily weather summaries', () => {
  const intervals = getDayIntervals('2025-01-15')
  const weather: HourlyWeather[] = [
    { interval: intervals[0], temperatureC: 2, precipitationMm: 1.2, windSpeedKmh: 10, condition: 'light-rain' },
    { interval: intervals[1], temperatureC: 8, precipitationMm: 2.3, windSpeedKmh: 20, condition: 'rain' },
  ]
  it('reports temperature range, summed precipitation, mean wind, conditions, and missing coverage', () => {
    expect(summarizeDailyWeather(weather, '2025-01-15')).toEqual({ temperatureMinC: 2, temperatureMaxC: 8, precipitationMm: 3.5, meanWindSpeedKmh: 15, conditions: ['light-rain', 'rain'], hourCount: 2, expectedHourCount: 24 })
    expect(summarizeDailyWeather(weather, '2025-01-16')).toBeUndefined()
    expect(summarizeDailyWeather([], '2025-01-15')).toBeUndefined()
  })
  it.each([['2025-03-09', 23], ['2025-11-02', 25]] as const)('includes every real hour on %s', (date, count) => {
    const rows = getDayIntervals(date).map((interval) => ({ ...weather[0], interval, precipitationMm: 1 }))
    const daily = summarizeDailyWeather(rows, date)!
    expect(daily.hourCount).toBe(count)
    expect(daily.expectedHourCount).toBe(count)
    expect(daily.precipitationMm).toBe(count)
  })
})
