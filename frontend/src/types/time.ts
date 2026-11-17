/** Calendar dates are YYYY-MM-DD in America/New_York; timestamps are ISO instants. */
export interface DateRange {
  startDate: string
  endDate: string
}

export interface HourlyInterval {
  start: string
  end: string
  date: string
  hour: number
  utcOffset: string
  label: string
}

export interface ClockSnapshot {
  asOf: string
  timeZone: 'America/New_York'
}
