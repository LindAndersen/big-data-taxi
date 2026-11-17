import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getZoneBounds, parseZones } from './geography'
import type { ZoneCollection, ZoneFeature } from '../types/zones'

const asset = JSON.parse(readFileSync(new URL('../../public/data/manhattan-zones.geojson', import.meta.url), 'utf8')) as ZoneCollection

describe('official Manhattan geometry', () => {
  it('contains exactly the 69 unique Manhattan lookup IDs', () => {
    const collection = parseZones(asset)
    const ids = collection.features.map((feature) => feature.id)
    expect(ids).toHaveLength(69)
    expect(new Set(ids).size).toBe(69)
    expect(collection.features.every((feature) => feature.properties.borough === 'Manhattan')).toBe(true)
    expect(collection.features.find((feature) => feature.id === 43)?.properties.name).toBe('Central Park')
  })

  it('retains the three distinct official island polygons without duplicating coordinates', () => {
    const islands = asset.features.filter((feature) => [103, 104, 105].includes(feature.properties.id))
    expect(islands.map((feature) => feature.id)).toEqual([103, 104, 105])
    expect(new Set(islands.map((feature) => JSON.stringify(feature.geometry))).size).toBe(3)
  })

  it('has valid WGS84 coordinates in the Manhattan area', () => {
    const [[west, south], [east, north]] = getZoneBounds(asset.features)
    expect(west).toBeGreaterThan(-74.1)
    expect(east).toBeLessThan(-73.8)
    expect(south).toBeGreaterThan(40.6)
    expect(north).toBeLessThan(40.95)
  })
})

describe('zone boundary validation', () => {
  it('rejects empty, malformed, and duplicate zone data', () => {
    expect(() => parseZones(null)).toThrow('FeatureCollection')
    expect(() => parseZones({ type: 'FeatureCollection', features: [] })).toThrow('No taxi zones')
    expect(() => parseZones({ ...asset, features: [asset.features[0], asset.features[0]] })).toThrow('duplicate')
  })

  it('rejects invalid coordinates and inconsistent feature identifiers', () => {
    const invalid = structuredClone(asset)
    invalid.features[0].geometry = { type: 'Polygon', coordinates: [[[NaN, 40], [-74, 40], [-74, 41], [NaN, 40]]] }
    expect(() => parseZones(invalid)).toThrow('invalid coordinates')
    invalid.features[0] = { ...asset.features[0], id: -1 }
    expect(() => parseZones(invalid)).toThrow('invalid or duplicate')
  })
})

describe('map bounds', () => {
  it('includes every polygon part instead of only the first island', () => {
    const feature: ZoneFeature = {
      type: 'Feature', id: 1, properties: { id: 1, name: 'Fixture', borough: 'Manhattan' },
      geometry: { type: 'MultiPolygon', coordinates: [
        [[[-74, 40], [-73.9, 40], [-73.9, 40.1], [-74, 40]]],
        [[[-73.8, 40.2], [-73.7, 40.2], [-73.7, 40.3], [-73.8, 40.2]]],
      ] },
    }
    expect(getZoneBounds([feature])).toEqual([[-74, 40], [-73.7, 40.3]])
  })

  it('rejects empty geometry instead of returning infinite bounds', () => {
    expect(() => getZoneBounds([])).toThrow('No geographic coordinates')
  })
})
