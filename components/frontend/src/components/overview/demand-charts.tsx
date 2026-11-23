import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DemandSummary } from '../../types/demand'
import { formatOverviewDay } from '../../lib/overview'
import { Card } from '../ui/card'
import { DataNotice } from '../data-notice'

/** Daily lines show full forecasts, completed actual days, and separate incomplete-day observations. */
export function DemandTrend({ summary }: { summary: DemandSummary }) {
  const data = summary.daily.map((day) => ({
    date: day.date,
    predicted: day.predictedPickups,
    actual: day.partialZoneHours === 0 && day.unavailableZoneHours === 0 ? day.observedPickups : null,
    partial: day.partialZoneHours > 0 || day.unavailableZoneHours > 0 ? day.observedPickups : null,
  }))
  return <Card className="min-w-0 p-5" aria-label="Daily demand trend">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Daily demand</h2><p className="mt-1 text-xs text-muted-foreground">Predicted and observed pickups across Manhattan</p></div><div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-teal-700" />Predicted</span>{data.some((day) => day.actual !== null) && <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-orange-500" />Observed</span>}{data.some((day) => day.partial !== null) && <span>○ Incomplete day</span>}</div></div>
    <div className="mt-5 h-64 min-w-0"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 256 }}><LineChart data={data} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
      <CartesianGrid stroke="#e6ece8" vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="date" tickFormatter={formatOverviewDay} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={22} />
      <YAxis width={64} allowDecimals={false} domain={([minimum, maximum]: readonly [number, number]) => {
        const padding = Math.max((maximum - minimum) * 0.1, maximum * 0.005, 1)
        return [Math.max(0, Math.floor(minimum - padding)), Math.ceil(maximum + padding)]
      }} tickFormatter={(value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 })} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
      <Tooltip labelFormatter={(date) => String(date)} formatter={(value, name) => [Number(value).toLocaleString('en-US'), name]} />
      <Line name="Full-day predicted" dataKey="predicted" stroke="#1b7b69" strokeWidth={2.5} dot={data.length === 1} isAnimationActive={false} />
      <Line name="Completed-day observed" dataKey="actual" stroke="#f28b38" strokeWidth={2.5} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
      <Line name="Observed so far (incomplete day)" dataKey="partial" stroke="#f28b38" dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} connectNulls={false} isAnimationActive={false} />
    </LineChart></ResponsiveContainer></div>
    <p className="mt-3 text-[10px] text-muted-foreground">Y-axis auto-scales to visible values. Incomplete observed days are separate hollow points, not full-day actuals.</p>
  </Card>
}

/** Plot genuine per-zone-hour MAE; daily aggregate over/under-predictions never cancel it out. */
export function EvaluationTrend({ summary }: { summary: DemandSummary }) {
  return <Card className="min-w-0 p-5" aria-label="Daily model error">
    <h2 className="text-sm font-semibold">Forecast error by day</h2><p className="mt-1 text-xs text-muted-foreground">MAE · pickups per completed zone-hour</p>
    {summary.evaluation.sampleCount === 0 ? <DataNotice message="No completed zone-hour observations to evaluate." /> : <div className="mt-5 h-64 min-w-0"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 256 }}><BarChart data={summary.daily.map((day) => ({ date: day.date, mae: day.evaluation.mae }))} margin={{ top: 12, right: 8, left: -20, bottom: 8 }}>
      <CartesianGrid stroke="#e6ece8" vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="date" tickFormatter={formatOverviewDay} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={26} />
      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
      <Tooltip labelFormatter={(date) => String(date)} formatter={(value) => [`${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })} pickups/zone-hour`, 'MAE']} />
      <Bar dataKey="mae" fill="#86b7a4" radius={[3, 3, 0, 0]} isAnimationActive={false} />
    </BarChart></ResponsiveContainer></div>}
    <p className="mt-3 text-[10px] text-muted-foreground">Only completed individual zone-hours are evaluated. Missing days have no error bar.</p>
  </Card>
}
