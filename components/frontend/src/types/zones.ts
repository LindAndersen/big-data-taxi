import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'

export interface TaxiZone {
  id: number
  name: string
  borough: 'Manhattan'
}

export type ZoneFeature = Feature<Polygon | MultiPolygon, TaxiZone>
export type ZoneCollection = FeatureCollection<Polygon | MultiPolygon, TaxiZone>
export type MapBounds = [[number, number], [number, number]]
