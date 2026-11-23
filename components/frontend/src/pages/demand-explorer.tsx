import { useReducer, useState } from 'react'
import { Temporal } from '@js-temporal/polyfill'
import { Map, Clock3 } from 'lucide-react'
import type { ClockSnapshot } from '../types/time'
import { useDemoClock, useExplorerData } from '../hooks/use-explorer-data'
import { createExplorerSelection, explorerReducer, formatExplorerDate } from '../lib/explorer'
import { TAXI_TIME_ZONE } from '../lib/time'
import { Card } from '../components/ui/card'
import { DataNotice } from '../components/data-notice'
import { ZoneSelector } from '../components/zone-selector'
import { TaxiZoneMap } from '../components/taxi-zone-map'
import { DateControls } from '../components/explorer/date-controls'
import { HourlyChart } from '../components/explorer/hourly-chart'
import { HourInformation } from '../components/explorer/hour-information'
import { DailyInformation } from '../components/explorer/daily-information'
import { Button } from '../components/ui/button'
import type { MapDemandMetric } from '../lib/explorer-daily'

/** Initialize filters only after the service supplies the fixed demo snapshot. */
export function DemandExplorer() {
  const clock = useDemoClock()
  if (clock.isPending) return <Card><DataNotice pending message="Loading the demo clock…" /></Card>
  if (clock.isError) return <Card><DataNotice message="The demo clock could not be loaded." onRetry={() => void clock.refetch()} /></Card>
  return <ExplorerContent key={clock.data.asOf} clock={clock.data} />
}

/** Share date/zone filters while keeping the daily map metric independent of optional hourly detail. */
function ExplorerContent({ clock }: { clock: ClockSnapshot }) {
  const [selection, dispatch] = useReducer(explorerReducer, clock, createExplorerSelection)
  const [mapMetric, setMapMetric] = useState<MapDemandMetric>('observed')
  const data = useExplorerData(selection, clock.asOf, mapMetric)
  const today = Temporal.Instant.from(clock.asOf).toZonedDateTimeISO(TAXI_TIME_ZONE).toPlainDate().toString()
  const zoneName = selection.zoneId === null ? 'All Zones'
    : data.zones.data?.features.find((zone) => zone.id === selection.zoneId)?.properties.name ?? `Zone ${selection.zoneId}`
  const snapshotLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: TAXI_TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
  }).format(new Date(clock.asOf))

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="eyebrow">Explore the city</p><h1 className="page-title">Demand Explorer</h1><p className="page-description">Explore predicted and observed taxi pickups, one hour and one neighborhood at a time.</p></div>
      <div className="rounded-lg border border-border bg-white px-3 py-2 text-[10px] leading-relaxed text-muted-foreground"><span className="flex items-center gap-1.5 font-medium text-foreground"><Clock3 className="size-3" />Fixed demo snapshot</span><span>{snapshotLabel}</span></div>
    </div>
    <div className="grid items-start gap-5 xl:grid-cols-[180px_minmax(0,1fr)]">
      <DateControls date={selection.date} today={today} asOf={clock.asOf} onSelectDate={(date) => dispatch({ type: 'date', date })} />
      <div className="min-w-0 space-y-5">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3"><span className="rounded-lg bg-teal-50 p-2.5 text-teal-700"><Map className="size-4" /></span><div><h2 className="text-sm font-semibold">Daily demand by zone</h2><p className="mt-1 text-[10px] text-muted-foreground">{formatExplorerDate(selection.date)} · {data.mapMetric?.period ?? 'Full day'}</p></div></div>
            {data.zones.data && <ZoneSelector zones={data.zones.data} selectedZoneId={selection.zoneId} onSelectZone={(zoneId) => dispatch({ type: 'zone', zoneId })} />}
          </div>
          <div role="group" aria-label="Map demand metric" className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-2">
            <span className="mr-1 text-xs text-muted-foreground">Map metric</span>
            {(['observed', 'predicted'] as const).map((metric) => <Button key={metric} variant={data.effectiveMetric === metric ? 'default' : 'ghost'} size="sm" aria-pressed={data.effectiveMetric === metric} disabled={metric === 'observed' && !data.observedAvailable} title={metric === 'observed' && !data.observedAvailable ? 'No observed demand is available for this date' : undefined} onClick={() => setMapMetric(metric)}>{metric === 'observed' ? 'Observed' : 'Predicted'}</Button>)}
          </div>
          {data.zones.isPending ? <DataNotice pending message="Loading Manhattan taxi zones…" />
            : data.zones.isError ? <DataNotice message="Taxi zones could not be loaded." onRetry={() => void data.zones.refetch()} />
              : data.demand.isPending ? <DataNotice pending message="Loading hourly demand…" />
                : data.demand.isError ? <DataNotice message="Demand could not be loaded for this date." onRetry={() => void data.demand.refetch()} />
                  : !data.demand.data.zoneHours.length ? <DataNotice message="No zone demand is available for this date." />
                    : <TaxiZoneMap zones={data.zones.data} selectedZoneId={selection.zoneId} onSelectZone={(zoneId) => dispatch({ type: 'zone', zoneId })} metric={data.mapMetric} />}
        </Card>
        {data.demand.isPending ? <Card><DataNotice pending message="Loading the day's hourly intervals…" /></Card>
          : data.demand.isError ? <Card><DataNotice message="The hourly series could not be loaded." onRetry={() => void data.demand.refetch()} /></Card>
            : !data.hours.length || !data.selectedDaily ? <Card><DataNotice message="No hourly observations or forecasts are available for this selection." /></Card>
              : <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                <HourlyChart hours={data.hours} selectedStart={selection.intervalStart} zoneName={zoneName} onSelectHour={(intervalStart) => dispatch({ type: 'hour', intervalStart })} />
                {selection.intervalStart !== null && data.selectedDemand ? <HourInformation demand={data.selectedDemand} zoneName={zoneName} asOf={data.demand.data.asOf} weather={data.selectedWeather}
                  weatherStatus={data.weather.isPending ? 'pending' : data.weather.isError ? 'error' : data.selectedWeather ? 'ready' : 'empty'}
                  onRetryWeather={() => void data.weather.refetch()} />
                  : <DailyInformation totals={data.selectedDaily} expectedZoneHours={data.expectedZoneHours} date={selection.date} zoneName={zoneName} asOf={data.demand.data.asOf} weather={data.dailyWeather}
                    weatherStatus={data.weather.isPending ? 'pending' : data.weather.isError ? 'error' : data.dailyWeather ? 'ready' : 'empty'} onRetryWeather={() => void data.weather.refetch()} /> }
              </div>}
        <p className="text-[10px] leading-relaxed text-muted-foreground">Deterministic mock data · All Zones covers {data.zones.data?.features.length ?? 'all'} Manhattan taxi zones.</p>
      </div>
    </div>
  </div>
}
