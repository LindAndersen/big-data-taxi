import { Temporal } from '@js-temporal/polyfill'
import type { DateRange, HourlyInterval } from '../types/time'

export const TAXI_TIME_ZONE = 'America/New_York'

/** Require a calendar date, rather than silently accepting timestamps or rolling invalid dates. */
export function parseDate(date: string): Temporal.PlainDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('Use a date in YYYY-MM-DD format.')
  return Temporal.PlainDate.from(date, { overflow: 'reject' })
}

/** Enumerate real elapsed hours between consecutive New York midnights (23/24/25). */
export function getDayIntervals(date: string): HourlyInterval[] {
  const day = parseDate(date)
  const endOfDay = day.add({ days: 1 }).toZonedDateTime(TAXI_TIME_ZONE)
  const intervals: HourlyInterval[] = []
  for (let start = day.toZonedDateTime(TAXI_TIME_ZONE); start.epochMilliseconds < endOfDay.epochMilliseconds; start = start.add({ hours: 1 })) {
    const end = start.add({ hours: 1 })
    const startLabel = start.toPlainTime().toString({ smallestUnit: 'minute' })
    const endLabel = end.toPlainTime().toString({ smallestUnit: 'minute' })
    const offsetLabel = start.offset === end.offset
      ? `UTC${start.offset}`
      : `UTC${start.offset} → UTC${end.offset}`
    intervals.push({
      start: start.toInstant().toString(),
      end: end.toInstant().toString(),
      date,
      hour: start.hour,
      utcOffset: start.offset,
      label: `${startLabel}–${endLabel} (${offsetLabel})`,
    })
  }
  return intervals
}

/** Expand an inclusive range using local calendar arithmetic, never UTC date arithmetic. */
export function getDatesInRange(range: DateRange): string[] {
  const start = parseDate(range.startDate)
  const end = parseDate(range.endDate)
  if (Temporal.PlainDate.compare(start, end) > 0) throw new RangeError('The start date must not be after the end date.')
  const dates: string[] = []
  for (let day = start; Temporal.PlainDate.compare(day, end) <= 0; day = day.add({ days: 1 })) {
    dates.push(day.toString())
  }
  return dates
}

/** Last 7/30 completed New York calendar days, excluding the current demo day. */
export function getCompletedDateRange(days: 7 | 30, asOf: string): DateRange {
  const today = Temporal.Instant.from(asOf).toZonedDateTimeISO(TAXI_TIME_ZONE).toPlainDate()
  return {
    startDate: today.subtract({ days }).toString(),
    endDate: today.subtract({ days: 1 }).toString(),
  }
}
