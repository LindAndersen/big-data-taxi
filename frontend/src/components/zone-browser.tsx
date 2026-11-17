import { useState } from 'react'
import { ArrowUpRight, LoaderCircle, Map } from 'lucide-react'
import { useZones } from '../hooks/use-zones'
import { TaxiZoneMap } from './taxi-zone-map'
import { ZoneSelector } from './zone-selector'
import { Button } from './ui/button'
import { Card } from './ui/card'

/** Connects the zone service to a map and a keyboard-accessible selection control. */
export function ZoneBrowser() {
  const query = useZones()
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null)
  if (query.isPending) return <Card className="flex min-h-96 items-center justify-center gap-2 text-muted-foreground" role="status"><LoaderCircle className="size-5 animate-spin" />Loading taxi-zone boundaries…</Card>
  if (query.isError) return <Card className="p-8" role="alert"><h2 className="font-semibold">Taxi zones could not be loaded</h2><p className="mt-2 text-sm text-muted-foreground">{query.error.message}</p><Button className="mt-4" onClick={() => void query.refetch()}>Try again</Button></Card>
  const zones = query.data
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Map className="size-4" /></div><div><h2 className="text-sm font-semibold">Manhattan taxi zones</h2><p className="mt-0.5 text-xs text-muted-foreground">{zones.features.length} zones · Official TLC boundaries</p></div></div>
        <ZoneSelector zones={zones} selectedZoneId={selectedZoneId} onSelectZone={setSelectedZoneId} />
      </div>
      <TaxiZoneMap zones={zones} selectedZoneId={selectedZoneId} onSelectZone={setSelectedZoneId} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground"><span>Locally stored geometry · No external map service</span><a href="https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">Data source<ArrowUpRight className="size-3" /></a></div>
    </Card>
  )
}
