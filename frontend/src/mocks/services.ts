import { aggregateHourlyDemand, calculateEvaluation, summarizeDemand } from '../lib/demand-calculations'
import { parseDate } from '../lib/time'
import type { ClockService, DemandService, WeatherService } from '../services/contracts'
import type { ZoneService } from '../services/zones'
import { generateDemand, generateDemandRange } from './demand'
import { generateWeather } from './weather'

/** Dependency injection lets tests use the real geometry fixture without browser fetches. */
export function createMockDemandService(zoneService: ZoneService, clockService: ClockService): DemandService {
  async function loadContext(signal?: AbortSignal) {
    signal?.throwIfAborted()
    const [geometry, clock] = await Promise.all([
      zoneService.getZones(signal),
      clockService.getCurrentTime(signal),
    ])
    signal?.throwIfAborted()
    return { zones: geometry.features.map((feature) => feature.properties), clock }
  }

  return {
    async getHourlyDemand(request, signal) {
      parseDate(request.date)
      const { zones, clock } = await loadContext(signal)
      const selectedZones = request.zoneId === null ? zones : zones.filter((zone) => zone.id === request.zoneId)
      if (request.zoneId !== null && selectedZones.length === 0) throw new RangeError(`Unknown Manhattan taxi zone: ${request.zoneId}`)
      const zoneHours = generateDemand(selectedZones, request.date, clock.asOf)
      return {
        ...request,
        ...clock,
        zoneHours,
        hours: aggregateHourlyDemand(zoneHours, request.zoneId),
      }
    },
    async getSummary(range, signal) {
      const { zones, clock } = await loadContext(signal)
      return summarizeDemand(generateDemandRange(zones, range, clock.asOf), range, clock.asOf)
    },
    async getEvaluation(range, signal) {
      const { zones, clock } = await loadContext(signal)
      return {
        range: { ...range },
        ...clock,
        evaluation: calculateEvaluation(generateDemandRange(zones, range, clock.asOf), clock.asOf),
      }
    },
  }
}

export const mockWeatherService: WeatherService = {
  async getHourlyWeather(date, signal) {
    signal?.throwIfAborted()
    return generateWeather(date)
  },
}
