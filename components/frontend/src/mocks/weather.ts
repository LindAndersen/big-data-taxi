import { getDayIntervals, parseDate, TAXI_TIME_ZONE } from '../lib/time'
import type { HourlyWeather, WeatherResponse } from '../types/weather'
import { deterministicFraction } from './deterministic'

/** Perfectly shared mock weather for both observed conditions and future forecasts. */
export function generateWeather(date: string): WeatherResponse {
  const day = parseDate(date)
  const season = Math.cos(2 * Math.PI * (day.dayOfYear - 15) / day.daysInYear)
  const dayVariation = deterministicFraction(`weather-day:${date}`)
  const wetDay = dayVariation < 0.35
  const wetStart = Math.floor(deterministicFraction(`rain-start:${date}`) * 18)
  const hours = getDayIntervals(date).map((interval): HourlyWeather => {
    const variation = deterministicFraction(`weather-hour:${interval.start}`)
    const temperatureC = Math.round((12 - 12 * season + 3 * Math.cos(2 * Math.PI * (interval.hour - 15) / 24) + (dayVariation - 0.5) * 6) * 10) / 10
    const wetHour = wetDay && interval.hour >= wetStart && interval.hour < wetStart + 6
    const precipitationMm = wetHour ? Math.round((0.2 + variation * 3) * 10) / 10 : 0
    const condition = precipitationMm > 0
      ? temperatureC <= 0 ? 'snow' : precipitationMm >= 1.5 ? 'rain' : 'light-rain'
      : dayVariation < 0.6 ? 'cloudy' : 'clear'
    return {
      interval,
      temperatureC,
      precipitationMm,
      windSpeedKmh: Math.round((5 + variation * 20 + (wetHour ? 4 : 0)) * 10) / 10,
      condition,
    }
  })
  return { date, timeZone: TAXI_TIME_ZONE, hours }
}
