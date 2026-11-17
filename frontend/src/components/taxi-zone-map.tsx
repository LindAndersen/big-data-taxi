import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, LocateFixed, MapPin } from 'lucide-react'
import * as maplibregl from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ZoneCollection } from '../types/zones'
import { getZoneBounds } from '../lib/geography'
import { DEMAND_COLORS, getDemandColor, NO_DEMAND_COLOR } from '../lib/map-demand'
import { Button } from './ui/button'

maplibregl.setWorkerUrl(mapWorkerUrl)

export interface ZoneMapMetric {
  values: ReadonlyMap<number, number>
  maximum: number
  label: string
  period: string
}

interface TaxiZoneMapProps {
  zones: ZoneCollection
  selectedZoneId: number | null
  onSelectZone: (id: number | null) => void
  metric?: ZoneMapMetric
}

/** Owns MapLibre's lifecycle; geographical selection stays in the parent page. */
export function TaxiZoneMap({ zones, selectedZoneId, onSelectZone, metric }: TaxiZoneMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const selectionHandler = useRef(onSelectZone)
  const [loadedMap, setLoadedMap] = useState<maplibregl.Map | null>(null)
  const metricRef = useRef(metric)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const selectedZone = zones.features.find((zone) => zone.id === selectedZoneId)

  useEffect(() => { selectionHandler.current = onSelectZone }, [onSelectZone])
  useEffect(() => { metricRef.current = metric; popupRef.current?.remove() }, [metric])

  useEffect(() => {
    if (!container.current) return
    let map: maplibregl.Map
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: { zones: { type: 'geojson', data: zones } },
          layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#eaf0f1' } },
            { id: 'zone-fill', source: 'zones', type: 'fill', paint: { 'fill-color': '#a4d6bf', 'fill-opacity': 0.9 } },
            { id: 'zone-boundaries', source: 'zones', type: 'line', paint: { 'line-color': '#668c7b', 'line-width': 0.8 } },
            { id: 'zone-hover', source: 'zones', type: 'line', filter: ['==', ['id'], -1], paint: { 'line-color': '#235d4d', 'line-width': 2 } },
            { id: 'zone-selected', source: 'zones', type: 'line', filter: ['==', ['id'], -1], paint: { 'line-color': '#0f5047', 'line-width': 3 } },
          ],
        },
        bounds: getZoneBounds(zones.features),
        fitBoundsOptions: { padding: 36 },
        attributionControl: false,
        maxZoom: 17,
        minZoom: 9,
      })
    } catch (error) {
      const timer = window.setTimeout(() => setMapError(error instanceof Error ? error.message : 'Map initialization failed.'), 0)
      return () => window.clearTimeout(timer)
    }
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'NYC Taxi & Limousine Commission / NYC Open Data' }), 'bottom-right')
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
    popupRef.current = popup
    map.on('load', () => setLoadedMap(map))
    map.on('error', (event) => setMapError(event.error.message))
    map.on('mousemove', 'zone-fill', (event) => {
      const feature = event.features?.[0]
      if (!feature) return
      map.getCanvas().style.cursor = 'pointer'
      map.setFilter('zone-hover', ['==', ['id'], feature.id ?? -1])
      const label = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = String(feature.properties.name)
      const description = document.createElement('div')
      description.textContent = `Zone ${feature.id} · Manhattan`
      label.append(title, description)
      const activeMetric = metricRef.current
      if (activeMetric) {
        const value = activeMetric.values.get(Number(feature.id))
        const demandLabel = document.createElement('div')
        demandLabel.textContent = `${activeMetric.label}: ${value === undefined ? 'Unavailable' : value.toLocaleString('en-US')}`
        const periodLabel = document.createElement('div')
        periodLabel.textContent = activeMetric.period
        label.append(demandLabel, periodLabel)
      }
      popup.setLngLat(event.lngLat).setDOMContent(label).addTo(map)
    })
    map.on('mouseleave', 'zone-fill', () => {
      map.getCanvas().style.cursor = ''
      map.setFilter('zone-hover', ['==', ['id'], -1])
      popup.remove()
    })
    map.on('click', 'zone-fill', (event) => {
      const id = event.features?.[0]?.id
      if (typeof id === 'number') selectionHandler.current(id)
    })
    const resize = new ResizeObserver(() => map.resize())
    resize.observe(container.current)
    return () => {
      resize.disconnect()
      popup.remove()
      popupRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [zones])

  useEffect(() => {
    const map = mapRef.current
    if (!map || loadedMap !== map) return
    map.setFilter('zone-selected', ['==', ['id'], selectedZoneId ?? -1])
    const features = selectedZone ? [selectedZone] : zones.features
    map.fitBounds(getZoneBounds(features), {
      padding: selectedZone ? 80 : 36,
      maxZoom: selectedZone ? 15 : 12,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650,
    })
  }, [selectedZoneId, selectedZone, zones, loadedMap])

  useEffect(() => {
    const map = mapRef.current
    if (!map || loadedMap !== map) return
    const colors = metric ? Object.fromEntries(zones.features.map((zone) => [
      zone.properties.id, getDemandColor(metric.values.get(zone.properties.id), metric.maximum),
    ])) : {}
    map.setPaintProperty('zone-fill', 'fill-color', metric
      ? ['coalesce', ['get', ['to-string', ['id']], ['literal', colors]], NO_DEMAND_COLOR]
      : '#a4d6bf')
  }, [metric, zones, loadedMap])

  return (
    <div className="relative overflow-hidden rounded-b-xl bg-[#eaf0f1]">
      <div ref={container} className={metric ? "h-[350px] w-full sm:h-[380px]" : "h-[460px] w-full sm:h-[520px]"} role="region" aria-label="Interactive map of Manhattan taxi zones. Use the zone selector for keyboard selection." />
      <div className="absolute top-4 left-4 max-w-[calc(100%-80px)] rounded-lg border border-white/80 bg-white/95 p-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-teal-700" />{selectedZone?.properties.name ?? 'All Manhattan zones'}</div>
        <p className="mt-1 text-xs text-muted-foreground">{metric ? metric.period : 'Click a zone to explore its boundaries'}</p>
        {selectedZoneId !== null && <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={() => onSelectZone(null)}><ArrowLeft />Back to All Zones</Button>}
      </div>
      <Button variant="outline" size="sm" className="absolute bottom-7 left-4 shadow-sm" onClick={() => {
        if (selectedZoneId !== null) onSelectZone(null)
        else mapRef.current?.fitBounds(getZoneBounds(zones.features), { padding: 36, duration: 0 })
      }}><LocateFixed />Reset view</Button>
      {metric && <div aria-label="Map demand legend" className="absolute right-3 bottom-8 w-40 rounded-lg border border-white/80 bg-white/95 p-3 shadow-sm">
        <p className="text-[10px] font-semibold">{metric.label}</p>
        {metric.values.size > 0 ? <>
        <div className="mt-2 flex h-2 overflow-hidden rounded-sm">{DEMAND_COLORS.map((color) => <span key={color} className="flex-1" style={{ backgroundColor: color }} />)}</div>
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground"><span>0</span><span>{metric.maximum.toLocaleString('en-US')}+</span></div>
        <p className="mt-1 text-[9px] text-muted-foreground">Same scale across dates and metrics</p>
        </> : <p className="mt-2 text-[10px] text-muted-foreground">No observations available</p>}
      </div>}
      {mapError && <div role="alert" className="absolute inset-x-4 bottom-18 rounded-lg border border-red-200 bg-white p-4 text-sm text-red-800">The interactive map could not be displayed. {mapError} You can still select a zone using the selector above.</div>}
    </div>
  )
}
