import type { ZoneCollection } from '../types/zones'

interface ZoneSelectorProps {
  zones: ZoneCollection
  selectedZoneId: number | null
  onSelectZone: (zoneId: number | null) => void
}

export function ZoneSelector({ zones, selectedZoneId, onSelectZone }: ZoneSelectorProps) {
  const sorted = [...zones.features].sort((a, b) => a.properties.name.localeCompare(b.properties.name) || a.properties.id - b.properties.id)
  return (
    <label className="flex w-full min-w-0 flex-col items-start gap-2 text-xs text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-3">
      Selected zone
      <select aria-label="Selected zone" value={selectedZoneId ?? 'all'} onChange={(event) => onSelectZone(event.target.value === 'all' ? null : Number(event.target.value))} className="h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-teal-600 sm:w-60">
        <option value="all">All Zones</option>
        {sorted.map(({ properties }) => <option key={properties.id} value={properties.id}>{properties.name} ({properties.id})</option>)}
      </select>
    </label>
  )
}
