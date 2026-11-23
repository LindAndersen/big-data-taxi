import { useState } from 'react'
import { Clock3 } from 'lucide-react'
import type { ClockSnapshot } from '../types/time'
import { getCompletedDateRange, TAXI_TIME_ZONE } from '../lib/time'
import { useDemoClock } from '../hooks/use-explorer-data'
import { useOverviewData } from '../hooks/use-overview-data'
import { Card } from '../components/ui/card'
import { DataNotice } from '../components/data-notice'
import { RangeControls } from '../components/overview/range-controls'
import { SummaryCards } from '../components/overview/summary-cards'
import { DemandTrend, EvaluationTrend } from '../components/overview/demand-charts'
import { GeographicOverview } from '../components/overview/geographic-overview'

export function Overview() {
  const clock = useDemoClock()
  if (clock.isPending) return <Card><DataNotice pending message="Loading the demo clock…" /></Card>
  if (clock.isError) return <Card><DataNotice message="The demo clock could not be loaded." onRetry={() => void clock.refetch()} /></Card>
  return <OverviewContent key={clock.data.asOf} clock={clock.data} />
}

/** One applied range drives every analytical view; draft date edits live in RangeControls. */
function OverviewContent({ clock }: { clock: ClockSnapshot }) {
  const [range, setRange] = useState(() => getCompletedDateRange(7, clock.asOf))
  const query = useOverviewData(range, clock.asOf)
  const snapshot = new Intl.DateTimeFormat('en-US', { timeZone: TAXI_TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).format(new Date(clock.asOf))
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">The bigger picture</p><h1 className="page-title">Overview</h1><p className="page-description">Demand trends and forecast performance across Manhattan.</p></div><div className="rounded-lg border border-border bg-white px-3 py-2 text-[10px] leading-relaxed text-muted-foreground"><span className="flex items-center gap-1.5 font-medium text-foreground"><Clock3 className="size-3" />Fixed demo snapshot</span>{snapshot}</div></div>
    <RangeControls range={range} asOf={clock.asOf} onChange={setRange} />
    {query.isPending ? <Card><DataNotice pending message="Loading demand and model performance…" /></Card>
      : query.isError ? <Card><DataNotice message="The overview could not be loaded for this range." onRetry={() => void query.refetch()} /></Card>
        : query.data.zoneCount === 0 ? <Card><DataNotice message="No demand data is available for this range." /></Card>
          : <>
            <SummaryCards summary={query.data} />
            <div className="rounded-lg border border-border bg-white px-4 py-3 text-[11px] leading-relaxed text-muted-foreground" aria-label="Observation coverage">
              <p><span className="font-medium text-foreground">{query.data.evaluation.sampleCount.toLocaleString('en-US')} completed zone-hours evaluated.</span> MAE and WAPE exclude partial and unavailable intervals and never count All Zones aggregates.</p>
              <p className="mt-1">{query.data.totals.partialZoneHours.toLocaleString('en-US')} partial and {query.data.totals.unavailableZoneHours.toLocaleString('en-US')} unavailable zone-hours in the selected range. Forecast totals cover the entire range; observed totals include only available counts through {snapshot}.</p>
            </div>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]"><DemandTrend summary={query.data} /><EvaluationTrend summary={query.data} /></div>
            <GeographicOverview summary={query.data} />
            <details className="rounded-xl border border-border bg-white p-5 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">How forecast performance is measured</summary><div className="mt-3 space-y-2 leading-relaxed"><p>MAE = sum of absolute zone-hour errors ÷ eligible zone-hour count. Its unit is pickups per zone-hour.</p><p>WAPE = sum of absolute zone-hour errors ÷ sum of actual pickups × 100. N/A means there are no eligible observations or, for WAPE, summed actuals are zero.</p><p>For example, over-prediction in one zone does not cancel under-prediction in another. Busiest day and zone rankings use completed actuals only; current dates may have partial-day coverage.</p></div></details>
            <p className="text-[10px] text-muted-foreground">Deterministic mock data · {query.data.zoneCount} Manhattan taxi zones · New York calendar dates</p>
          </>}
  </div>
}
