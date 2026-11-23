import { useState, type FormEvent } from 'react'
import { Temporal } from '@js-temporal/polyfill'
import { CalendarDays } from 'lucide-react'
import type { DateRange } from '../../types/time'
import { getCompletedDateRange, parseDate } from '../../lib/time'
import { formatExplorerDate } from '../../lib/explorer'
import { Button } from '../ui/button'
import { Card } from '../ui/card'

interface RangeControlsProps {
  range: DateRange
  asOf: string
  onChange: (range: DateRange) => void
}

/** Draft custom dates are applied together, so invalid/incomplete edits never trigger queries. */
export function RangeControls({ range, asOf, onChange }: RangeControlsProps) {
  const [mode, setMode] = useState<'7' | '30' | 'custom'>('7')
  const [draft, setDraft] = useState(range)
  const [error, setError] = useState<string | null>(null)

  function applyCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      if (Temporal.PlainDate.compare(parseDate(draft.startDate), parseDate(draft.endDate)) > 0) {
        setError('The end date must be on or after the start date.')
        return
      }
      setError(null)
      onChange({ ...draft })
    } catch {
      setError('Choose a valid start and end date.')
    }
  }

  return <Card className="p-4 sm:p-5" aria-label="Overview timeframe">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2"><CalendarDays className="size-4 text-teal-700" /><div><h2 className="text-sm font-semibold">Timeframe</h2><p className="mt-1 text-xs text-muted-foreground">{formatExplorerDate(range.startDate)} – {formatExplorerDate(range.endDate)}</p></div></div>
      <div role="group" aria-label="Select timeframe" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {(['7', '30', 'custom'] as const).map((value) => <Button key={value} size="sm" variant={mode === value ? 'default' : 'ghost'} aria-pressed={mode === value} onClick={() => {
          setMode(value)
          setError(null)
          if (value === 'custom') setDraft(range)
          else onChange(getCompletedDateRange(value === '7' ? 7 : 30, asOf))
        }}>{value === 'custom' ? 'Custom range' : `Last ${value} days`}</Button>)}
      </div>
    </div>
    {mode === 'custom' && <form onSubmit={applyCustom} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
      <label className="min-w-0 flex-1 basis-40 text-xs text-muted-foreground">Start date<input type="date" required aria-label="Start date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} className="mt-1 block h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:outline-teal-600" /></label>
      <label className="min-w-0 flex-1 basis-40 text-xs text-muted-foreground">End date<input type="date" required aria-label="End date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} className="mt-1 block h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:outline-teal-600" /></label>
      <Button type="submit">Apply range</Button>
      {error && <p role="alert" className="w-full text-xs text-red-700">{error}</p>}
    </form>}
    <p className="mt-3 text-[10px] text-muted-foreground">Presets cover completed New York calendar days. Custom ranges include both endpoints.</p>
  </Card>
}
