import { Cloud, CloudRain, CloudSnow, Droplets, Sun, Thermometer, Wind } from 'lucide-react'
import type { DailyWeatherSummary, HourlyWeather, WeatherCondition } from '../../types/weather'
import { Button } from '../ui/button'

const conditions = {
  clear: { label: 'Clear', Icon: Sun }, cloudy: { label: 'Cloudy', Icon: Cloud },
  'light-rain': { label: 'Light rain', Icon: CloudRain }, rain: { label: 'Rain', Icon: CloudRain }, snow: { label: 'Snow', Icon: CloudSnow },
} satisfies Record<WeatherCondition, { label: string; Icon: typeof Sun }>

type WeatherInformationProps = {
  status: 'pending' | 'error' | 'empty' | 'ready'
  onRetry: () => void
} & ({ mode: 'hourly'; weather?: HourlyWeather } | { mode: 'daily'; weather?: DailyWeatherSummary })

/** Shared weather presentation for both detail modes, with independent loading/error coverage. */
export function WeatherInformation(props: WeatherInformationProps) {
  const { status, onRetry, mode, weather } = props
  const hourly = mode === 'hourly' ? props.weather : undefined
  const daily = mode === 'daily' ? props.weather : undefined
  const ConditionIcon = hourly ? conditions[hourly.condition].Icon : Cloud
  const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 })
  return <div className="mt-5 border-t border-border pt-4">
    <h3 className="text-xs font-semibold">Manhattan weather</h3>
    {mode === 'daily' && <p className="mt-1 text-[10px] text-muted-foreground">{daily && daily.hourCount !== daily.expectedHourCount ? `Partial weather coverage · ${daily.hourCount}/${daily.expectedHourCount} hours` : 'Full-day weather summary'}</p>}
    {status === 'pending' && <p role="status" className="mt-3 text-xs text-muted-foreground">Loading {mode === 'daily' ? 'daily' : 'hourly'} weather…</p>}
    {status === 'error' && <div role="alert" className="mt-3 text-xs text-muted-foreground"><p>Weather could not be loaded.</p><Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>Retry weather</Button></div>}
    {status === 'empty' && <p role="status" className="mt-3 text-xs text-muted-foreground">{mode === 'daily' ? 'No weather observations for this date.' : 'No weather observation for this interval.'}</p>}
    {status === 'ready' && weather && <>
      <p className="mt-3 flex items-center gap-2 text-xs"><ConditionIcon className="size-4 shrink-0 text-teal-700" />{hourly ? conditions[hourly.condition].label : daily?.conditions.map((condition) => conditions[condition].label).join(', ')}</p>
      <dl className="mt-3 space-y-3 text-xs">
        <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-2 text-muted-foreground"><Thermometer className="size-3.5" />{daily ? 'Temperature range' : 'Temperature'}</dt><dd className="font-medium tabular-nums">{hourly ? format(hourly.temperatureC) : daily ? `${format(daily.temperatureMinC)}–${format(daily.temperatureMaxC)}` : ''} °C</dd></div>
        <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-2 text-muted-foreground"><Droplets className="size-3.5" />{daily ? 'Total precipitation' : 'Precipitation'}</dt><dd className="font-medium tabular-nums">{format(weather.precipitationMm)} mm</dd></div>
        <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-2 text-muted-foreground"><Wind className="size-3.5" />{daily ? 'Mean wind speed' : 'Wind speed'}</dt><dd className="font-medium tabular-nums">{hourly ? format(hourly.windSpeedKmh) : daily ? format(daily.meanWindSpeedKmh) : ''} km/h</dd></div>
      </dl>
    </>}
    <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Shared across all Manhattan zones. Observed weather is used as the simulated forecast.</p>
  </div>
}
