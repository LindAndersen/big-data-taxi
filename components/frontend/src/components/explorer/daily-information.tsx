import type { DemandTotals } from '../../types/demand'
import type { DailyWeatherSummary } from '../../types/weather'
import { formatExplorerDate, getDailyDifference, getDateMode } from '../../lib/explorer'
import { getDayIntervals, TAXI_TIME_ZONE } from '../../lib/time'
import { Card } from '../ui/card'
import { WeatherInformation } from './weather-information'

interface DailyInformationProps {
  totals: DemandTotals
  expectedZoneHours: number
  date: string
  zoneName: string
  asOf: string
  weather?: DailyWeatherSummary
  weatherStatus: 'pending' | 'error' | 'empty' | 'ready'
  onRetryWeather: () => void
}

/** Compare daily forecasts only with complete daily observations; today remains explicitly partial. */
export function DailyInformation({ totals, expectedZoneHours, date, zoneName, asOf, weather, weatherStatus, onRetryWeather }: DailyInformationProps) {
  const mode = getDateMode(date, asOf)
  const difference = getDailyDifference(totals, expectedZoneHours)
  const observed = mode === 'past' ? totals.completedObservedPickups : mode === 'future' ? null : totals.observedPickups
  const cutoff = new Intl.DateTimeFormat('en-US', { timeZone: TAXI_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).format(new Date(asOf))
  return <Card aria-label="Daily demand details" aria-live="polite" className="min-w-0 p-5">
    <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily overview</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">{difference !== null ? 'Completed' : mode === 'future' ? 'Forecast' : 'Incomplete'}</span></div>
    <p className="mt-4 break-words text-sm font-semibold">{zoneName}</p>
    <p className="mt-1 text-xs text-muted-foreground">{formatExplorerDate(date)}</p>
    <p className="mt-2 text-lg font-semibold tracking-tight">Full day</p>
    <p className="mt-0.5 text-[10px] text-muted-foreground">{getDayIntervals(date).length} elapsed hours · New York</p>
    <div className="mt-4 rounded-lg bg-teal-50/80 p-3"><p className="text-xs text-teal-800">Full-day predicted pickups</p><p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-teal-900">{totals.predictedPickups.toLocaleString('en-US')}</p></div>
    <dl className="mt-4 space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">{mode === 'current' ? 'Observed so far' : 'Actual daily pickups'}</dt><dd className="font-semibold tabular-nums">{observed === null ? 'Not yet available' : observed.toLocaleString('en-US')}</dd></div>
      <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Actual − predicted</dt><dd className="font-semibold tabular-nums">{difference === null ? 'N/A' : `${difference > 0 ? '+' : ''}${difference.toLocaleString('en-US')}`}</dd></div>
    </dl>
    {difference === null && <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">{mode === 'current' ? `Observations from 00:00 through ${cutoff}. Incomplete day: no comparison with the full-day forecast.` : mode === 'future' ? 'No observed demand is available for this future date.' : 'Daily observations are incomplete; no comparison with the full-day forecast.'}</p>}
    <WeatherInformation mode="daily" weather={weather} status={weatherStatus} onRetry={onRetryWeather} />
  </Card>
}
