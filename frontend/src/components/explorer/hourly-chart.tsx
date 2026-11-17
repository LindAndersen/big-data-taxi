import { useRef, type KeyboardEvent } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { MousePointer2, X } from 'lucide-react'
import type { HourlyDemand } from '../../types/demand'
import { cn } from '../../lib/utils'
import { Card } from '../ui/card'
import { Button } from '../ui/button'

interface HourlyChartProps {
  hours: HourlyDemand[]
  selectedStart: string | null
  zoneName: string
  onSelectHour: (start: string | null) => void
}

/** Equal-width chart bands cover the entire plot, not just line points or axis ticks. */
export function HourlyChart({ hours, selectedStart, zoneName, onSelectHour }: HourlyChartProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = hours.findIndex((hour) => hour.interval.start === selectedStart)
  const data = hours.map((hour, index) => {
    const sameHour = hours.filter((other) => other.interval.hour === hour.interval.hour)
    const occurrence = sameHour.findIndex((other) => other.interval.start === hour.interval.start)
    return {
      x: index + 0.5,
      tick: String(hour.interval.hour).padStart(2, '0') + (sameHour.length > 1 ? String.fromCharCode(97 + occurrence) : ''),
      predicted: hour.predictedPickups,
      actual: hour.observation.status === 'complete' ? hour.observation.pickups : null,
      partial: hour.observation.status === 'partial' ? hour.observation.pickups : null,
    }
  })

  function navigateHour(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === 'ArrowRight' ? Math.min(hours.length - 1, index + 1)
      : event.key === 'ArrowLeft' ? Math.max(0, index - 1)
        : event.key === 'Home' ? 0 : event.key === 'End' ? hours.length - 1 : null
    if (target === null) return
    event.preventDefault()
    onSelectHour(hours[target].interval.start)
    buttons.current[target]?.focus()
  }

  return <Card className="min-w-0 overflow-hidden" aria-label="Hourly taxi demand">
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
      <div><h2 className="text-sm font-semibold">Hourly demand</h2><p className="mt-1 text-xs text-muted-foreground">{zoneName} · Pickups per hour</p></div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-teal-700" />Predicted</span>
        {hours.some((hour) => hour.observation.status === 'complete') && <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-orange-500" />Actual</span>}
        {hours.some((hour) => hour.observation.status === 'partial') && <span className="flex items-center gap-1.5"><i className="size-2 rounded-full border-2 border-orange-500 bg-white" />Observed so far</span>}
      </div>
    </div>
    <div className="overflow-x-auto pt-4" aria-label="Hourly chart; scroll horizontally on smaller screens">
      <div className="relative h-[260px] min-w-[540px]">
        <div aria-hidden="true" className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 260 }}>
            <LineChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 8 }} accessibilityLayer={false}>
              <CartesianGrid vertical={false} stroke="#e6ece8" strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" domain={[0, hours.length]} ticks={data.map((point) => point.x)} tickFormatter={(x: number) => data[Math.floor(x)]?.tick ?? ''} interval={0} tick={{ fontSize: 9, fill: '#738078' }} tickLine={false} axisLine={false} height={28} />
              <YAxis width={44} allowDecimals={false} tick={{ fontSize: 10, fill: '#738078' }} tickFormatter={(value: number) => Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)} tickLine={false} axisLine={false} />
              <Line type="linear" dataKey="predicted" stroke="#1b7b69" strokeWidth={2.5} dot={false} activeDot={false} isAnimationActive={false} />
              <Line type="linear" dataKey="actual" stroke="#f28b38" strokeWidth={2.5} dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="partial" stroke="#f28b38" dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }} activeDot={false} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div role="group" aria-label="Select an hourly interval on the demand chart" className="absolute top-4 right-4 bottom-9 left-[52px] grid" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}>
          {hours.map((hour, index) => <button
            key={hour.interval.start}
            ref={(element) => { buttons.current[index] = element }}
            type="button"
            aria-label={`Select ${hour.interval.label}`}
            aria-pressed={hour.interval.start === selectedStart}
            tabIndex={index === Math.max(0, selectedIndex) ? 0 : -1}
            title={`${hour.interval.label}\nPredicted: ${hour.predictedPickups.toLocaleString('en-US')} pickups\n${hour.observation.status === 'unavailable' ? 'Actual: unavailable' : `${hour.observation.status === 'partial' ? 'Observed so far' : 'Actual'}: ${hour.observation.pickups.toLocaleString('en-US')} pickups`}`}
            className={cn('h-full min-w-0 cursor-crosshair border-x border-transparent outline-none hover:bg-teal-600/5 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700', hour.interval.start === selectedStart && 'border-teal-700/70 bg-teal-600/10')}
            onClick={() => onSelectHour(selectedStart === hour.interval.start ? null : hour.interval.start)}
            onKeyDown={(event) => navigateHour(event, index)}
          ><span className="sr-only">{hour.interval.label}</span></button>)}
        </div>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
      <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><MousePointer2 className="size-3 shrink-0" />Click an hour to select it; click it again for daily details. Use ← →, Home, or End when focused.{hours.length !== 24 && ' DST day: real elapsed hours.'}</p>
      {selectedStart !== null && <Button variant="ghost" size="sm" onClick={() => { onSelectHour(null); buttons.current[0]?.focus() }}><X />Clear hour selection</Button>}
    </div>
  </Card>
}
