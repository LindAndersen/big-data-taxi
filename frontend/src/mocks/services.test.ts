import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCompletedDateRange } from '../lib/time'
import { parseZones } from '../lib/geography'
import type { ZoneService } from '../services/zones'
import { createMockClockService, DEFAULT_DEMO_NOW } from './clock'
import { createMockDemandService, mockWeatherService } from './services'

const geometry = parseZones(JSON.parse(readFileSync(new URL('../../public/data/manhattan-zones.geojson', import.meta.url), 'utf8')))
const zones: ZoneService = { getZones: async () => geometry }
const clock = createMockClockService()
const service = createMockDemandService(zones, clock)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('fixed mock clock', () => {
  it('normalizes the configured instant and stays fixed across requests', async () => {
    const custom = createMockClockService('2025-11-02T01:30:00-04:00')
    expect(await custom.getCurrentTime()).toEqual({ asOf: '2025-11-02T05:30:00Z', timeZone: 'America/New_York' })
    expect(await custom.getCurrentTime()).toEqual(await custom.getCurrentTime())
    expect(await clock.getCurrentTime()).toEqual({ asOf: '2025-01-15T22:30:00Z', timeZone: 'America/New_York' })
    expect(() => createMockClockService('2025-01-15T17:30:00')).toThrow()
  })
})

describe('demand service consistency', () => {
  it('returns exactly the same Central Park rows in All Zones and single-zone responses', async () => {
    const all = await service.getHourlyDemand({ date: '2025-01-14', zoneId: null })
    const park = await service.getHourlyDemand({ date: '2025-01-14', zoneId: 43 })
    expect(all.zoneHours).toHaveLength(69 * 24)
    expect(all.hours).toHaveLength(24)
    expect(park.zoneHours).toEqual(all.zoneHours.filter((row) => row.zoneId === 43))
    expect(park.hours).toEqual(park.zoneHours)
    expect(all.asOf).toBe(park.asOf)
  })

  it('makes day-chart totals, summary totals, and individual evaluation agree', async () => {
    const date = '2025-01-14'
    const range = { startDate: date, endDate: date }
    const day = await service.getHourlyDemand({ date, zoneId: null })
    const summary = await service.getSummary(range)
    const metrics = await service.getEvaluation(range)
    expect(summary.totals.predictedPickups).toBe(day.hours.reduce((sum, row) => sum + row.predictedPickups, 0))
    expect(summary.totals.observedPickups).toBe(day.hours.reduce((sum, row) => sum + (row.observation.pickups ?? 0), 0))
    expect(summary.evaluation).toEqual(metrics.evaluation)
    expect(metrics.evaluation.sampleCount).toBe(69 * 24)
    const error = day.zoneHours.reduce((sum, row) => sum + Math.abs(row.predictedPickups - row.observation.pickups!), 0)
    expect(metrics.evaluation.mae).toBe(error / (69 * 24))
  })

  it('excludes partial live hours from metrics but retains their observed-so-far counts', async () => {
    const range = { startDate: '2025-01-15', endDate: '2025-01-15' }
    const result = await service.getSummary(range)
    expect(result.zoneCount).toBe(69)
    expect(result.totals).toMatchObject({ completedZoneHours: 69 * 17, partialZoneHours: 69, unavailableZoneHours: 69 * 6 })
    expect(result.evaluation.sampleCount).toBe(69 * 17)
    expect(result.totals.observedPickups!).toBeGreaterThan(result.totals.completedObservedPickups!)
  })

  it('returns future forecasts without fabricated actual totals or error metrics', async () => {
    const range = { startDate: '2025-01-16', endDate: '2025-01-16' }
    const result = await service.getSummary(range)
    expect(result.totals.predictedPickups).toBeGreaterThan(0)
    expect(result.totals).toMatchObject({ observedPickups: null, completedObservedPickups: null, completedZoneHours: 0, partialZoneHours: 0, unavailableZoneHours: 69 * 24 })
    expect(result.evaluation).toMatchObject({ sampleCount: 0, mae: null, wape: null })
    expect(result.busiestDay).toBeNull()
    expect(result.zones.every((zone) => zone.completedObservedPickups === null)).toBe(true)
  })

  it('supports completed seven-day presets and the full 25-hour autumn date', async () => {
    const week = await service.getSummary(getCompletedDateRange(7, DEFAULT_DEMO_NOW))
    expect(week.daily).toHaveLength(7)
    expect(week.evaluation.sampleCount).toBe(7 * 24 * 69)
    const autumnService = createMockDemandService(zones, createMockClockService('2025-11-03T12:00:00Z'))
    const range = { startDate: '2025-11-02', endDate: '2025-11-02' }
    const autumn = await autumnService.getSummary(range)
    expect(autumn.evaluation.sampleCount).toBe(25 * 69)
    expect(autumn.evaluation).toEqual((await autumnService.getEvaluation(range)).evaluation)
    const weather = await mockWeatherService.getHourlyWeather('2025-11-02')
    const demand = await autumnService.getHourlyDemand({ date: '2025-11-02', zoneId: 43 })
    expect(demand.hours.map((hour) => hour.interval)).toEqual(weather.hours.map((hour) => hour.interval))
  })

  it('rejects unknown zones, invalid dates, and reversed ranges', async () => {
    await expect(service.getHourlyDemand({ date: '2025-01-14', zoneId: 999 })).rejects.toThrow('Unknown Manhattan taxi zone')
    await expect(service.getHourlyDemand({ date: '2025-02-30', zoneId: null })).rejects.toThrow(RangeError)
    await expect(service.getSummary({ startDate: '2025-01-16', endDate: '2025-01-14' })).rejects.toThrow('start date')
    await expect(service.getEvaluation({ startDate: '2025-01-16', endDate: '2025-01-14' })).rejects.toThrow('start date')
  })

  it('propagates source errors rather than returning misleading empty data', async () => {
    const failing = createMockDemandService({ getZones: async () => { throw new Error('Geometry unavailable') } }, clock)
    await expect(failing.getSummary({ startDate: '2025-01-14', endDate: '2025-01-14' })).rejects.toThrow('Geometry unavailable')
  })
})

describe('cancellation and composition', () => {
  it('rejects pre-cancelled requests without loading geometry', async () => {
    const getZones = vi.fn(zones.getZones)
    const cancellable = createMockDemandService({ getZones }, clock)
    const signal = AbortSignal.abort()
    await expect(cancellable.getHourlyDemand({ date: '2025-01-14', zoneId: 43 }, signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(getZones).not.toHaveBeenCalled()
    await expect(mockWeatherService.getHourlyWeather('2025-01-14', signal)).rejects.toMatchObject({ name: 'AbortError' })
    await expect(clock.getCurrentTime(signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('forwards cancellation and checks it again after asynchronous loading', async () => {
    let release!: (value: typeof geometry) => void
    const pending = new Promise<typeof geometry>((resolve) => { release = resolve })
    const getZones = vi.fn(() => pending)
    const cancellable = createMockDemandService({ getZones }, clock)
    const controller = new AbortController()
    const request = cancellable.getSummary({ startDate: '2025-01-14', endDate: '2025-01-14' }, controller.signal)
    controller.abort()
    release(geometry)
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(getZones).toHaveBeenCalledWith(controller.signal)
  })

  it('exposes configured adapters through one composition point', async () => {
    vi.stubEnv('VITE_DEMO_NOW', '2025-01-14T12:00:00-05:00')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(geometry)))
    const configured = await import('../services/index')
    expect(await configured.clockService.getCurrentTime()).toEqual({ asOf: '2025-01-14T17:00:00Z', timeZone: 'America/New_York' })
    const demand = await configured.demandService.getHourlyDemand({ date: '2025-01-14', zoneId: 43 })
    expect(demand.hours.filter((hour) => hour.observation.status === 'complete')).toHaveLength(12)
    expect((await configured.weatherService.getHourlyWeather('2025-01-14')).hours).toHaveLength(24)
  })
})
