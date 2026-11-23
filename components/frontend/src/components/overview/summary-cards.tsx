import type { DemandSummary } from '../../types/demand'
import { formatOverviewDay } from '../../lib/overview'
import { Card } from '../ui/card'

/** Keep full-range demand totals distinct from the paired observations used for evaluation. */
export function SummaryCards({ summary }: { summary: DemandSummary }) {
  const { totals, evaluation, busiestDay } = summary
  const cards = [
    { label: 'Predicted pickups', value: totals.predictedPickups.toLocaleString('en-US'), note: 'Full selected date range' },
    { label: 'Observed pickups', value: totals.observedPickups?.toLocaleString('en-US') ?? 'N/A', note: totals.partialZoneHours > 0 ? 'Includes current observations so far' : totals.unavailableZoneHours > 0 ? 'Available observations only' : 'Completed selected date range' },
    { label: 'MAE', value: evaluation.mae?.toLocaleString('en-US', { maximumFractionDigits: 1 }) ?? 'N/A', note: 'Pickups per completed zone-hour' },
    { label: 'WAPE', value: evaluation.wape === null ? 'N/A' : `${evaluation.wape.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`, note: 'Absolute error ÷ actual pickups' },
    { label: 'Busiest day', value: busiestDay ? formatOverviewDay(busiestDay.date) : 'N/A', note: busiestDay ? `${busiestDay.date.slice(0, 4)} · ${busiestDay.pickups.toLocaleString('en-US')} completed pickups` : 'No completed observations' },
  ]
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
    {cards.map((card) => <Card key={card.label} aria-label={card.label} className="min-w-0 p-5"><h2 className="text-xs text-muted-foreground">{card.label}</h2><p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">{card.value}</p><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{card.note}</p></Card>)}
  </div>
}
