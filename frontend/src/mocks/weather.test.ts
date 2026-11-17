import { describe, expect, it } from 'vitest'
import { generateWeather } from './weather'

describe('shared Manhattan weather fixtures', () => {
  it('is deterministic and has no per-zone or clock dependence', () => {
    const first = generateWeather('2025-01-15')
    generateWeather('2025-07-15')
    expect(generateWeather('2025-01-15')).toEqual(first)
    expect(first.timeZone).toBe('America/New_York')
    expect(first.hours).toHaveLength(24)
    expect(first.hours.every((hour) => !('zoneId' in hour))).toBe(true)
  })

  it('produces finite weather in explicit metric units with plausible seasonal variation', () => {
    const winter = generateWeather('2025-01-15').hours
    const summer = generateWeather('2025-07-15').hours
    expect(summer[15].temperatureC).toBeGreaterThan(winter[15].temperatureC + 15)
    expect([...winter, ...summer].every((hour) => Number.isFinite(hour.temperatureC)
      && hour.temperatureC > -20 && hour.temperatureC < 40
      && hour.precipitationMm >= 0 && hour.precipitationMm <= 4
      && hour.windSpeedKmh >= 0 && hour.windSpeedKmh <= 40)).toBe(true)
  })

  it('has consistent precipitation labels across dry, rainy, and snowy fixtures', () => {
    const hours = Array.from({ length: 28 }, (_, index) => generateWeather(`2025-01-${String(index + 1).padStart(2, '0')}`).hours).flat()
    expect(hours.some((hour) => hour.precipitationMm > 0)).toBe(true)
    expect(hours.some((hour) => hour.condition === 'snow')).toBe(true)
    expect(hours.every((hour) => hour.precipitationMm === 0
      ? ['clear', 'cloudy'].includes(hour.condition)
      : ['light-rain', 'rain', 'snow'].includes(hour.condition))).toBe(true)
  })

  it('aligns weather with every actual elapsed interval on DST transition days', () => {
    expect(generateWeather('2025-03-09').hours).toHaveLength(23)
    const autumn = generateWeather('2025-11-02').hours
    expect(autumn).toHaveLength(25)
    expect(new Set(autumn.map((hour) => hour.interval.start)).size).toBe(25)
  })
})
