import { useMemo, useState } from 'react'
import type { DemandSummary } from '../../types/demand'
import { getOverviewMapMetric } from '../../lib/overview'
import { useZones } from '../../hooks/use-zones'
import { Card } from '../ui/card'
import { TaxiZoneMap } from '../taxi-zone-map'
import { ZoneSelector } from '../zone-selector'
import { DataNotice } from '../data-notice'
import { cn } from '../../lib/utils'

/** Ranking/map share completed actual totals; highlighting a zone does not filter Overview metrics. */
export function GeographicOverview({ summary }: { summary: DemandSummary }) {
  const zones = useZones()
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null)
  const metric = useMemo(() => getOverviewMapMetric(summary), [summary])
  const busiest = summary.zones.filter((zone) => zone.completedZoneHours > 0).slice(0, 10)
  const names = new Map(zones.data?.features.map((zone) => [zone.properties.id, zone.properties.name]))
  return <Card className="overflow-hidden" aria-label="Geographic overview">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4"><div><h2 className="text-sm font-semibold">Where demand is highest</h2><p className="mt-1 text-xs text-muted-foreground">Busiest zones by completed observed pickups · selecting a zone highlights the map only</p></div>{zones.data && <ZoneSelector zones={zones.data} selectedZoneId={selectedZoneId} onSelectZone={setSelectedZoneId} />}</div>
    {zones.isPending ? <DataNotice pending message="Loading geographic coverage…" />
      : zones.isError ? <DataNotice message="Taxi zones could not be loaded." onRetry={() => void zones.refetch()} />
        : <div className="grid lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.3fr)]">
          <div className="min-w-0 p-5"><h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top 10 taxi zones</h3>
            {!busiest.length ? <DataNotice message="No completed observations to rank for this range." /> : <ol className="space-y-1">
              {busiest.map((zone, index) => <li key={zone.zoneId}><button type="button" aria-label={`Select ${names.get(zone.zoneId) ?? `Zone ${zone.zoneId}`} on map`} aria-pressed={selectedZoneId === zone.zoneId} onClick={() => setSelectedZoneId(zone.zoneId)} className={cn('w-full rounded-lg p-2 text-left transition-colors hover:bg-muted focus-visible:outline-teal-700', selectedZoneId === zone.zoneId && 'bg-teal-50')}>
                <div className="flex items-center gap-2 text-xs"><span className="w-4 shrink-0 text-muted-foreground">{index + 1}</span><span className="min-w-0 flex-1 truncate font-medium">{names.get(zone.zoneId) ?? `Zone ${zone.zoneId}`}</span><span className="shrink-0 tabular-nums text-muted-foreground">{zone.completedObservedPickups!.toLocaleString('en-US')}</span></div>
                <div className="mt-1.5 ml-6 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-teal-600/50" style={{ width: `${zone.completedObservedPickups! / Math.max(1, busiest[0].completedObservedPickups!) * 100}%` }} /></div>
              </button></li>)}
            </ol>}
          </div>
          <div className="min-w-0 border-t border-border lg:border-t-0 lg:border-l"><TaxiZoneMap zones={zones.data} selectedZoneId={selectedZoneId} onSelectZone={setSelectedZoneId} metric={metric} /></div>
        </div>}
  </Card>
}
