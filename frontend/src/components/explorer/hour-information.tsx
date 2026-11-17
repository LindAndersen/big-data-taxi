import type { HourlyDemand } from '../../types/demand'
import type { HourlyWeather } from '../../types/weather'
import { formatExplorerDate, getCompletedDifference } from '../../lib/explorer'
import { TAXI_TIME_ZONE } from '../../lib/time'
import { cn } from '../../lib/utils'
import { WeatherInformation } from './weather-information'
import { Card } from '../ui/card'

interface HourInformationProps {
  demand: HourlyDemand
  zoneName: string
  asOf: string
  weather?: HourlyWeather
  weatherStatus: 'pending' | 'error' | 'empty' | 'ready'
  onRetryWeather: () => void
}

/** Show a full-hour comparison only when actuals are complete; weather has an independent state. */
export function HourInformation({ demand, zoneName, asOf, weather, weatherStatus, onRetryWeather }: HourInformationProps) {
  const { observation, interval } = demand
  const difference = getCompletedDifference(demand, asOf)
  return <Card aria-label="Selected hour details" aria-live="polite" className="min-w-0 p-5">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selected hour</h2>
      <span className={cn('rounded-full px-2 py-1 text-[10px] font-medium', observation.status === 'complete' ? 'bg-teal-50 text-teal-800' : observation.status === 'partial' ? 'bg-orange-50 text-orange-800' : 'bg-slate-100 text-slate-600')}>
        {observation.status === 'complete' ? 'Completed' : observation.status === 'partial' ? 'Incomplete' : 'Forecast'}
      </span>
    </div>
    <p className="mt-4 break-words text-sm font-semibold">{zoneName}</p>
    <p className="mt-1 text-xs text-muted-foreground">{formatExplorerDate(interval.date)}</p>
    <p className="mt-2 text-lg font-semibold tabular-nums tracking-tight">{interval.label.split(' (')[0]}</p>
    <p className="mt-0.5 text-[10px] text-muted-foreground">{interval.label.slice(interval.label.indexOf('('))} · New York</p>
    <div className="mt-4 rounded-lg bg-teal-50/80 p-3">
      <p className="text-xs text-teal-800">Predicted pickups</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-teal-900">{demand.predictedPickups.toLocaleString('en-US')}</p>
    </div>
    <dl className="mt-4 space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">{observation.status === 'partial' ? 'Observed so far' : 'Actual pickups'}</dt><dd className="font-semibold tabular-nums">{observation.pickups === null ? 'Not yet available' : observation.pickups.toLocaleString('en-US')}</dd></div>
      <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Actual − predicted</dt><dd className="font-semibold tabular-nums">{difference === null ? 'N/A' : `${difference > 0 ? '+' : ''}${difference.toLocaleString('en-US')}`}</dd></div>
    </dl>
    {observation.status === 'partial' && <p className="mt-3 text-[10px] leading-relaxed text-orange-800">Observed through {new Intl.DateTimeFormat('en-US', { timeZone: TAXI_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(observation.observedThrough))} New York time. This hour is incomplete; no forecast difference is calculated.</p>}
    {observation.status === 'unavailable' && <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Actual pickups and forecast differences are unavailable for this interval.</p>}
    <WeatherInformation mode="hourly" weather={weather} status={weatherStatus} onRetry={onRetryWeather} />
  </Card>
}
