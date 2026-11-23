import { afterEach, describe, expect, it, vi } from 'vitest'
import { zoneService } from './zones'

afterEach(() => vi.unstubAllGlobals())

describe('local zone service', () => {
  it('forwards cancellation and reports failed requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    await expect(zoneService.getZones(controller.signal)).rejects.toThrow('(503)')
    expect(fetchMock).toHaveBeenCalledWith('/data/manhattan-zones.geojson', { signal: controller.signal })
  })

  it('rejects invalid server data before it reaches map components', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ type: 'FeatureCollection', features: [] })))
    await expect(zoneService.getZones()).rejects.toThrow('No taxi zones')
  })
})
