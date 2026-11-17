import { describe, expect, it } from 'vitest'
import type { TaxiZone } from '../types/zones'
import { generateDemand, generateDemandRange } from './demand'
import { DEFAULT_DEMO_NOW } from './clock'

const zones: TaxiZone[] = [
  { id: 43, name: 'Central Park', borough: 'Manhattan' },
  { id: 161, name: 'Midtown Center', borough: 'Manhattan' },
  { id: 79, name: 'East Village', borough: 'Manhattan' },
]

describe('deterministic demand fixtures', () => {
  it('does not depend on call order, zone selection, or mutation of previous results', () => {
    const first = generateDemand(zones, '2025-01-14', DEFAULT_DEMO_NOW)
    generateDemand(zones, '2025-07-04', DEFAULT_DEMO_NOW)
    expect(generateDemand(zones, '2025-01-14', DEFAULT_DEMO_NOW)).toEqual(first)
    const single = generateDemand([zones[0]], '2025-01-14', DEFAULT_DEMO_NOW)
    expect(single).toEqual(first.filter((record) => record.zoneId === 43))
    expect(generateDemand([...zones].reverse(), '2025-01-14', DEFAULT_DEMO_NOW).filter((record) => record.zoneId === 43)).toEqual(single)
    first[0].predictedPickups = -100
    expect(generateDemand(zones, '2025-01-14', DEFAULT_DEMO_NOW)[0].predictedPickups).toBeGreaterThanOrEqual(0)
  })

  it('contains plausible zone-specific integer counts, with stronger commuting demand in Midtown', () => {
    const rows = generateDemand(zones, '2025-01-14', DEFAULT_DEMO_NOW)
    expect(rows).toHaveLength(72)
    expect(rows.every((row) => Number.isInteger(row.predictedPickups) && row.predictedPickups >= 0
      && row.observation.pickups !== null && Number.isInteger(row.observation.pickups) && row.observation.pickups >= 0)).toBe(true)
    const midtown = rows.filter((row) => row.zoneId === 161)
    expect(midtown.find((row) => row.interval.hour === 18)!.predictedPickups)
      .toBeGreaterThan(midtown.find((row) => row.interval.hour === 3)!.predictedPickups)
    expect(midtown.find((row) => row.interval.hour === 12)!.predictedPickups)
      .toBeGreaterThan(rows.find((row) => row.zoneId === 43 && row.interval.hour === 12)!.predictedPickups)
  })

  it('reveals completed, partial, and unavailable hours against one fixed instant', () => {
    const rows = generateDemand([zones[0]], '2025-01-15', DEFAULT_DEMO_NOW)
    expect(rows.filter((row) => row.observation.status === 'complete')).toHaveLength(17)
    expect(rows.filter((row) => row.observation.status === 'partial')).toHaveLength(1)
    expect(rows.filter((row) => row.observation.status === 'unavailable')).toHaveLength(6)
    expect(rows[17].observation.status).toBe('partial')
    expect(rows[18].observation).toEqual({ status: 'unavailable', pickups: null })
    expect(generateDemand(zones, '2025-01-16', DEFAULT_DEMO_NOW).every((row) => row.observation.pickups === null)).toBe(true)
  })

  it('increases partial counts monotonically without altering the full-hour forecast', () => {
    const times = ['17:00', '17:15', '17:30', '17:45', '18:00']
    const hour = times.map((time) => generateDemand([zones[1]], '2025-01-15', `2025-01-15T${time}:00-05:00`)[17])
    expect(hour[0].observation).toMatchObject({ status: 'partial', pickups: 0 })
    expect(hour[4].observation.status).toBe('complete')
    expect(new Set(hour.map((row) => row.predictedPickups)).size).toBe(1)
    const counts = hour.map((row) => row.observation.pickups!)
    expect(counts).toEqual([...counts].sort((a, b) => a - b))
    expect(counts[2]).toBe(Math.floor(counts[4] / 2))
  })

  it('distinguishes both repeated hours when the clock is between them', () => {
    const repeated = generateDemand([zones[0]], '2025-11-02', '2025-11-02T06:30:00Z')
      .filter((row) => row.interval.hour === 1)
    expect(repeated.map((row) => row.observation.status)).toEqual(['complete', 'partial'])
    expect(repeated[0].interval.start).not.toBe(repeated[1].interval.start)
  })

  it('yields the same rows in range and day requests, including a 23-hour date', () => {
    const range = { startDate: '2025-03-08', endDate: '2025-03-09' }
    const now = '2025-03-10T12:00:00Z'
    const rows = [...generateDemandRange(zones, range, now)]
    expect(rows).toHaveLength(3 * (24 + 23))
    expect(rows.filter((row) => row.interval.date === '2025-03-09')).toEqual(generateDemand(zones, '2025-03-09', now))
  })

  it('rejects duplicate zone IDs and invalid timestamps instead of producing ambiguous data', () => {
    expect(() => generateDemand([zones[0], zones[0]], '2025-01-15', DEFAULT_DEMO_NOW)).toThrow('unique zone IDs')
    expect(() => generateDemand(zones, '2025-01-15', '2025-01-15T17:30:00')).toThrow()
  })
})
