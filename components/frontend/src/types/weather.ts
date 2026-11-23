import type { HourlyInterval } from './time'

export type WeatherCondition = 'clear' | 'cloudy' | 'light-rain' | 'rain' | 'snow'

/** Shared Manhattan conditions, independent of taxi zone selection. */
export interface HourlyWeather {
  interval: HourlyInterval
  temperatureC: number
  precipitationMm: number
  windSpeedKmh: number
  condition: WeatherCondition
}

export interface WeatherResponse {
  date: string
  timeZone: 'America/New_York'
  hours: HourlyWeather[]
}

/** Full-day weather, shared across zones. Coverage remains explicit if hours are missing. */
export interface DailyWeatherSummary {
  temperatureMinC: number
  temperatureMaxC: number
  precipitationMm: number
  meanWindSpeedKmh: number
  conditions: WeatherCondition[]
  hourCount: number
  expectedHourCount: number
}
