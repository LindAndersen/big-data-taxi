import { Temporal } from '@js-temporal/polyfill'
import { CalendarDays, ChevronLeft, ChevronRight, CornerDownLeft } from 'lucide-react'
import { parseDate, TAXI_TIME_ZONE } from '../../lib/time'
import { getDateMode } from '../../lib/explorer'
import { Card } from '../ui/card'
import { Button } from '../ui/button'

interface DateControlsProps {
  date: string
  today: string
  asOf: string
  onSelectDate: (date: string) => void
}

export function DateControls({ date, today, asOf, onSelectDate }: DateControlsProps) {
  const mode = getDateMode(date, asOf)
  return <Card className="self-start p-4 sm:grid sm:grid-cols-[minmax(0,1fr)_100px_100px] sm:items-center sm:gap-x-4 xl:block">
    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold sm:col-span-3"><CalendarDays className="size-4 text-teal-700" />Explore date</h2>
    <label className="block text-xs text-muted-foreground">Selected date
      <input aria-label="Selected date" type="date" required value={date} onChange={(event) => {
        if (event.currentTarget.validity.valid && event.currentTarget.value) onSelectDate(event.currentTarget.value)
      }} className="mt-2 h-10 w-full min-w-0 rounded-lg border border-border bg-white px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-teal-600" />
    </label>
    <div className="mt-3 flex items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Previous day" className="flex-1" onClick={() => onSelectDate(parseDate(date).subtract({ days: 1 }).toString())}><ChevronLeft /></Button>
      <Button variant="outline" size="icon" aria-label="Next day" className="flex-1" onClick={() => onSelectDate(parseDate(date).add({ days: 1 }).toString())}><ChevronRight /></Button>
    </div>
    <Button variant="ghost" className="mt-2 w-full" onClick={() => onSelectDate(today)}><CornerDownLeft />Today</Button>
    <div className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground sm:col-span-3">
      <span className="font-medium text-foreground">{mode === 'past' ? 'Historical observations' : mode === 'future' ? 'Forecast only' : 'Observations so far'}</span>
      <p className="mt-1">{mode === 'past' ? 'Completed hours include predicted and actual pickups.' : mode === 'future' ? 'Future intervals show predictions only for the fixed demo snapshot.' : 'The current hour is incomplete and is excluded from forecast comparisons.'}</p>
      <p className="mt-3 text-[10px]">All dates and hours use New York time.</p>
      <p className="mt-1 text-[10px]">{Temporal.Instant.from(asOf).toZonedDateTimeISO(TAXI_TIME_ZONE).offset === '-05:00' ? 'Demo clock: EST (UTC−05)' : 'Demo clock: EDT (UTC−04)'}</p>
    </div>
  </Card>
}
