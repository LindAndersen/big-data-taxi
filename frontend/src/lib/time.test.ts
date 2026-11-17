import { describe, expect, it } from 'vitest'
import { getCompletedDateRange, getDatesInRange, getDayIntervals, parseDate } from './time'

describe('New York hourly intervals', () => {
  it('covers a normal calendar day with 24 contiguous elapsed hours', () => {
    const intervals = getDayIntervals('2025-01-15')
    expect(intervals).toHaveLength(24)
    expect(intervals[0].start).toBe('2025-01-15T05:00:00Z')
    expect(intervals[23].end).toBe('2025-01-16T05:00:00Z')
    expect(intervals[14].label).toBe('14:00–15:00 (UTC-05:00)')
    expect(intervals.every((interval, index) => Date.parse(interval.end) - Date.parse(interval.start) === 3_600_000
      && (index === 0 || intervals[index - 1].end === interval.start))).toBe(true)
  })

  it('has 23 hours on the spring transition without inventing a 02:00 interval', () => {
    const intervals = getDayIntervals('2025-03-09')
    expect(intervals).toHaveLength(23)
    expect(intervals.some((interval) => interval.hour === 2)).toBe(false)
    expect(intervals[0].utcOffset).toBe('-05:00')
    expect(intervals.at(-1)?.utcOffset).toBe('-04:00')
    expect(intervals[1].label).toBe('01:00–03:00 (UTC-05:00 → UTC-04:00)')
  })

  it('has 25 hours in autumn with distinct instants and labels for repeated 01:00', () => {
    const intervals = getDayIntervals('2025-11-02')
    expect(intervals).toHaveLength(25)
    const repeated = intervals.filter((interval) => interval.hour === 1)
    expect(repeated.map((interval) => interval.start)).toEqual(['2025-11-02T05:00:00Z', '2025-11-02T06:00:00Z'])
    expect(repeated.map((interval) => interval.utcOffset)).toEqual(['-04:00', '-05:00'])
    expect(new Set(intervals.map((interval) => interval.label)).size).toBe(25)
    expect(intervals.every((interval) => Date.parse(interval.end) - Date.parse(interval.start) === 3_600_000)).toBe(true)
  })
})

describe('calendar dates and inclusive ranges', () => {
  it.each(['2025-2-01', '2025-02-29', '2025-02-30', '2025-13-01', '2025-01-15T00:00:00Z', 'not-a-date'])(
    'rejects invalid calendar date %s', (value) => expect(() => parseDate(value)).toThrow(RangeError),
  )

  it('accepts leap days and includes both endpoints across DST', () => {
    expect(parseDate('2024-02-29').toString()).toBe('2024-02-29')
    expect(getDatesInRange({ startDate: '2025-03-08', endDate: '2025-03-10' }))
      .toEqual(['2025-03-08', '2025-03-09', '2025-03-10'])
    expect(getDatesInRange({ startDate: '2025-01-15', endDate: '2025-01-15' })).toEqual(['2025-01-15'])
  })

  it('rejects reversed ranges', () => {
    expect(() => getDatesInRange({ startDate: '2025-01-16', endDate: '2025-01-15' })).toThrow('start date')
  })

  it('anchors 7/30-day presets to New York, including when the UTC date is already tomorrow', () => {
    const now = '2025-01-16T02:00:00Z'
    expect(getCompletedDateRange(7, now)).toEqual({ startDate: '2025-01-08', endDate: '2025-01-14' })
    expect(getCompletedDateRange(30, now)).toEqual({ startDate: '2024-12-16', endDate: '2025-01-14' })
  })
})
