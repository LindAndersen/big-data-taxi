import type { DemandSummary } from '../types/demand'
import { formatExplorerDate } from './explorer'
import { parseDate } from './time'

export function formatOverviewDay(date: string): string {
  return parseDate(date).toLocaleString('en-US', { month: 'short', day: 'numeric' })
}

/** Map and ranking both use completed actuals; partial/current counts are excluded. */
export function getOverviewMapMetric(summary: DemandSummary) {
  const values = new Map(summary.zones.filter((zone) => zone.completedObservedPickups !== null)
    .map((zone) => [zone.zoneId, zone.completedObservedPickups!]))
  return {
    values,
    maximum: Math.max(0, ...values.values()),
    label: 'Completed observed pickups',
    period: `${formatExplorerDate(summary.range.startDate)} – ${formatExplorerDate(summary.range.endDate)}`,
    scaleDescription: 'Relative demand within this date range',
  }
}
