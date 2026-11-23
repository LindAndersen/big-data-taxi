import { describe, expect, it } from 'vitest'
import type { DemandObservation, HourlyDemand } from '../types/demand'
import { aggregateHourlyDemand, calculateEvaluation, summarizeDemand } from './demand-calculations'
import { getDayIntervals } from './time'

const NOW = '2025-01-15T22:30:00Z'
const RANGE = { startDate: '2025-01-14', endDate: '2025-01-16' }

function sample(zoneId: number | null, predictedPickups: number, observation: DemandObservation, hour = 0, date = '2025-01-14'): HourlyDemand {
  return { zoneId, predictedPickups, observation, interval: getDayIntervals(date)[hour] }
}

const completed = (pickups: number): DemandObservation => ({ status: 'complete', pickups })
const unavailable: DemandObservation = { status: 'unavailable', pickups: null }

describe('hourly aggregation', () => {
  it('sums individual zones and excludes an already-aggregated All Zones row', () => {
    const records = [sample(43, 100, completed(80)), sample(161, 50, completed(70))]
    const all = aggregateHourlyDemand(records)
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ zoneId: null, predictedPickups: 150, observation: completed(150) })
    expect(aggregateHourlyDemand([...records, ...all])).toEqual(all)
    expect(aggregateHourlyDemand(records, 43)[0]).toMatchObject({ zoneId: 43, predictedPickups: 100, observation: completed(80) })
    expect(aggregateHourlyDemand(records, 999)).toEqual([])
  })

  it('sums partial counts, retains their cutoff, and never labels mixed coverage complete', () => {
    const partial: DemandObservation = { status: 'partial', pickups: 12, observedThrough: NOW }
    const rows = [sample(43, 100, partial, 17, '2025-01-15'), sample(161, 200, { ...partial, pickups: 25 }, 17, '2025-01-15')]
    expect(aggregateHourlyDemand(rows)[0].observation).toEqual({ ...partial, pickups: 37 })
    expect(aggregateHourlyDemand([sample(43, 100, completed(80)), sample(161, 50, unavailable)])[0].observation)
      .toEqual({ status: 'partial', pickups: 80, observedThrough: getDayIntervals('2025-01-14')[0].end })
  })

  it('keeps unavailable actuals distinct from observed zeros', () => {
    expect(aggregateHourlyDemand([sample(43, 100, unavailable)])[0].observation).toEqual(unavailable)
    expect(aggregateHourlyDemand([sample(43, 100, completed(0))])[0].observation).toEqual(completed(0))
    expect(aggregateHourlyDemand([])).toEqual([])
  })

  it('keeps repeated local hours separate and sorts by actual instant', () => {
    const repeated = getDayIntervals('2025-11-02').filter((interval) => interval.hour === 1)
    const rows: HourlyDemand[] = repeated.map((interval, index) => ({ zoneId: 43, predictedPickups: index + 1, observation: completed(index + 1), interval }))
    const result = aggregateHourlyDemand(rows.reverse())
    expect(result).toHaveLength(2)
    expect(result.map((row) => row.predictedPickups)).toEqual([1, 2])
    expect(result.map((row) => row.interval.start)).toEqual(repeated.map((interval) => interval.start))
  })
})

describe('zone-hour evaluation', () => {
  it('uses absolute individual errors even when over- and under-prediction cancel in totals', () => {
    const rows = [sample(43, 100, completed(80)), sample(161, 50, completed(70))]
    const result = calculateEvaluation([...rows, ...aggregateHourlyDemand(rows)], NOW)
    expect(result).toMatchObject({ sampleCount: 2, totalAbsoluteError: 40, totalActualPickups: 150, totalPredictedPickups: 150, mae: 20 })
    expect(result.wape).toBeCloseTo(40 / 150 * 100)
  })

  it('excludes partial, unavailable, and not-yet-ended intervals even if tagged complete', () => {
    const rows = [
      sample(43, 100, completed(80)),
      sample(43, 1000, { status: 'partial', pickups: 10, observedThrough: NOW }, 17, '2025-01-15'),
      sample(43, 1000, unavailable, 18, '2025-01-15'),
      sample(43, 1000, completed(1000), 0, '2025-01-16'),
    ]
    expect(calculateEvaluation(rows, NOW)).toEqual({ sampleCount: 1, totalAbsoluteError: 20, totalActualPickups: 80, totalPredictedPickups: 100, mae: 20, wape: 25 })
  })

  it('allows an interval ending exactly at the cutoff, and excludes it a millisecond earlier', () => {
    const row = sample(43, 100, completed(80))
    expect(calculateEvaluation([row], row.interval.end).sampleCount).toBe(1)
    expect(calculateEvaluation([row], new Date(Date.parse(row.interval.end) - 1).toISOString()).sampleCount).toBe(0)
  })

  it('returns an unavailable WAPE for a zero denominator while retaining valid MAE', () => {
    expect(calculateEvaluation([sample(43, 5, completed(0))], NOW))
      .toEqual({ sampleCount: 1, totalAbsoluteError: 5, totalActualPickups: 0, totalPredictedPickups: 5, mae: 5, wape: null })
    expect(calculateEvaluation([sample(43, 10, completed(10))], NOW)).toMatchObject({ mae: 0, wape: 0 })
  })

  it('returns null metrics when there are no eligible observations', () => {
    expect(calculateEvaluation([], NOW)).toEqual({ sampleCount: 0, totalAbsoluteError: 0, totalActualPickups: 0, totalPredictedPickups: 0, mae: null, wape: null })
    expect(calculateEvaluation([sample(43, 100, unavailable)], NOW).mae).toBeNull()
  })

  it('counts both repeated autumn hours as separate observations', () => {
    const rows = getDayIntervals('2025-11-02').map((interval) => ({ zoneId: 43, interval, predictedPickups: 10, observation: completed(8) }))
    expect(calculateEvaluation(rows, '2025-11-03T12:00:00Z')).toMatchObject({ sampleCount: 25, totalAbsoluteError: 50, mae: 2, wape: 25 })
  })
})

describe('range summaries and rankings', () => {
  const records = [
    sample(43, 100, completed(80)),
    sample(161, 50, completed(70)),
    sample(43, 20, completed(15), 16, '2025-01-15'),
    sample(161, 100, { status: 'partial', pickups: 90, observedThrough: NOW }, 17, '2025-01-15'),
    sample(43, 200, unavailable, 0, '2025-01-16'),
  ]

  it('separates full-range predictions, observed-so-far counts, and completed evaluation totals', () => {
    const result = summarizeDemand([...records, ...aggregateHourlyDemand(records)], RANGE, NOW)
    expect(result.zoneCount).toBe(2)
    expect(result.totals).toEqual({ predictedPickups: 470, observedPickups: 255, completedObservedPickups: 165, completedZoneHours: 3, partialZoneHours: 1, unavailableZoneHours: 1 })
    expect(result.evaluation).toMatchObject({ sampleCount: 3, totalAbsoluteError: 45, totalPredictedPickups: 170, totalActualPickups: 165, mae: 15 })
    expect(result.evaluation.wape).toBeCloseTo(45 / 165 * 100)
    expect(result.daily.map((day) => day.date)).toEqual(['2025-01-14', '2025-01-15', '2025-01-16'])
    expect(result.daily[2].observedPickups).toBeNull()
    expect(result.daily.map((day) => day.evaluation.mae)).toEqual([20, 5, null])
    expect(result.daily.reduce((sum, day) => sum + day.evaluation.totalAbsoluteError, 0)).toBe(result.evaluation.totalAbsoluteError)
  })

  it('uses completed actuals for busiest day and zone rankings, excluding partial counts', () => {
    const result = summarizeDemand(records, RANGE, NOW)
    expect(result.busiestDay).toEqual({ date: '2025-01-14', pickups: 150 })
    expect(result.zones.map((zone) => zone.zoneId)).toEqual([43, 161])
    expect(result.zones[0].completedObservedPickups).toBe(95)
    expect(result.zones[1].observedPickups).toBe(160)
    expect(result.zones[1].completedObservedPickups).toBe(70)
  })

  it('has additive daily and zone totals with the same completed sample count', () => {
    const result = summarizeDemand(records, RANGE, NOW)
    for (const groups of [result.daily, result.zones]) {
      expect(groups.reduce((sum, item) => sum + item.predictedPickups, 0)).toBe(result.totals.predictedPickups)
      expect(groups.reduce((sum, item) => sum + (item.observedPickups ?? 0), 0)).toBe(result.totals.observedPickups)
      expect(groups.reduce((sum, item) => sum + item.completedZoneHours, 0)).toBe(result.evaluation.sampleCount)
    }
  })

  it('excludes out-of-range observations and keeps unknown actuals null', () => {
    const range = { startDate: '2025-01-16', endDate: '2025-01-16' }
    const result = summarizeDemand(records, range, NOW)
    expect(result.totals).toMatchObject({ predictedPickups: 200, observedPickups: null, completedObservedPickups: null, unavailableZoneHours: 1 })
    expect(result.busiestDay).toBeNull()
    expect(result.evaluation.sampleCount).toBe(0)
    expect(result.zones[0].completedObservedPickups).toBeNull()
  })

  it('breaks ties deterministically, and treats observed zero as available data', () => {
    const rows = [sample(161, 0, completed(0)), sample(43, 0, completed(0)), sample(43, 0, completed(0), 0, '2025-01-15')]
    const result = summarizeDemand(rows, RANGE, NOW)
    expect(result.busiestDay).toEqual({ date: '2025-01-14', pickups: 0 })
    expect(result.zones.map((zone) => zone.zoneId)).toEqual([43, 161])
    expect(result.totals.observedPickups).toBe(0)
    expect(result.evaluation).toMatchObject({ sampleCount: 3, mae: 0, wape: null })
  })

  it('handles an empty dataset without fabricating observations or rankings', () => {
    const result = summarizeDemand([], RANGE, NOW)
    expect(result.zoneCount).toBe(0)
    expect(result.zones).toEqual([])
    expect(result.daily).toHaveLength(3)
    expect(result.totals).toMatchObject({ predictedPickups: 0, observedPickups: null })
    expect(result.busiestDay).toBeNull()
    expect(result.evaluation.mae).toBeNull()
  })
})
