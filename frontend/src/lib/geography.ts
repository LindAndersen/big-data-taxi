import type { ZoneCollection, ZoneFeature, MapBounds } from '../types/zones'

/** Includes every vertex of every polygon, including islands and interior rings. */
export function getZoneBounds(features: ZoneFeature[]): MapBounds {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  for (const feature of features) {
    const polygons = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (const [lng, lat] of ring) {
          west = Math.min(west, lng)
          south = Math.min(south, lat)
          east = Math.max(east, lng)
          north = Math.max(north, lat)
        }
      }
    }
  }
  if (![west, south, east, north].every(Number.isFinite)) {
    throw new Error('No geographic coordinates are available.')
  }
  return [[west, south], [east, north]]
}

/** Validate the static asset at the service boundary before handing it to MapLibre. */
export function parseZones(value: unknown): ZoneCollection {
  if (!value || typeof value !== 'object' || !('type' in value)
    || value.type !== 'FeatureCollection' || !('features' in value) || !Array.isArray(value.features)) {
    throw new Error('The taxi-zone file is not a GeoJSON FeatureCollection.')
  }
  const ids = new Set<number>()
  if (value.features.length === 0) throw new Error('No taxi zones were found.')
  for (const feature of value.features) {
    const properties = feature?.properties
    if (feature?.type !== 'Feature' || !properties || !Number.isInteger(properties.id)
      || properties.id <= 0 || typeof properties.name !== 'string' || !properties.name.trim()
      || properties.borough !== 'Manhattan' || feature.id !== properties.id || ids.has(properties.id)) {
      throw new Error('The taxi-zone file contains invalid or duplicate zone identifiers.')
    }
    const geometry = feature.geometry
    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)
      || !Array.isArray(geometry.coordinates)) {
      throw new Error('A taxi zone has invalid geometry.')
    }
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
    if (!polygons.length || polygons.some((polygon: unknown) => !Array.isArray(polygon)
      || !polygon.length || polygon.some((ring: unknown) => !Array.isArray(ring) || ring.length < 4
        || ring.some((point: unknown) => !Array.isArray(point) || point.length < 2
          || !Number.isFinite(point[0]) || !Number.isFinite(point[1])
          || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90)))) {
      throw new Error('A taxi zone contains invalid coordinates.')
    }
    ids.add(properties.id)
  }
  return value as ZoneCollection
}
