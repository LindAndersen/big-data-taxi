import { parseZones } from '../lib/geography'
import type { ZoneCollection } from '../types/zones'

export interface ZoneService {
  getZones(signal?: AbortSignal): Promise<ZoneCollection>
}

/** Replace this adapter with an HTTP API adapter when the backend is available. */
export const zoneService: ZoneService = {
  async getZones(signal) {
    const response = await fetch(`${import.meta.env.BASE_URL}data/manhattan-zones.geojson`, { signal })
    if (!response.ok) throw new Error(`Taxi zones could not be loaded (${response.status}).`)
    return parseZones(await response.json())
  },
}
