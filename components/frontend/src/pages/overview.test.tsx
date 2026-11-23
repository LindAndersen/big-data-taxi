// @vitest-environment jsdom
import geometryJson from '../../public/data/manhattan-zones.geojson?raw'
import { cloneElement, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ZoneMapMetric } from '../components/taxi-zone-map'
import { summarizeDemand } from '../lib/demand-calculations'
import { demandService } from '../services'
import { Overview } from './overview'

vi.mock('recharts', async (original) => {
  const actual = await original<typeof import('recharts')>()
  return { ...actual, ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) => cloneElement(children, { width: 700, height: 256 }) }
})

vi.mock('../components/taxi-zone-map', () => ({
  TaxiZoneMap: ({ metric, selectedZoneId, onSelectZone }: { metric?: ZoneMapMetric; selectedZoneId: number | null; onSelectZone: (id: number | null) => void }) => <div>
    <output aria-label="Map selected zone">{selectedZoneId ?? 'all'}</output>
    <output aria-label="Map observed zone count">{metric?.values.size}</output>
    <button onClick={() => onSelectZone(null)}>Back to All Zones</button>
  </div>,
}))

const geometry = JSON.parse(geometryJson)
let client: QueryClient
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } })
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(geometry)))
})
afterEach(() => { cleanup(); client.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function showOverview() {
  return render(<QueryClientProvider client={client}><Overview /></QueryClientProvider>)
}

async function applyRange(startDate: string, endDate: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Custom range' }))
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: startDate } })
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: endDate } })
  await userEvent.click(screen.getByRole('button', { name: 'Apply range' }))
}

describe('Overview ranges and analytical views', () => {
  it('starts with seven completed New York days and displays service totals and zone-hour metrics', async () => {
    showOverview()
    await screen.findByRole('region', { name: 'Predicted pickups' })
    const summary = await demandService.getSummary({ startDate: '2025-01-08', endDate: '2025-01-14' })
    expect(screen.getByRole('region', { name: 'Overview timeframe' }).textContent).toContain('Wed, Jan 8, 2025 – Tue, Jan 14, 2025')
    expect(screen.getByRole('region', { name: 'Predicted pickups' }).textContent).toContain(summary.totals.predictedPickups.toLocaleString('en-US'))
    expect(screen.getByRole('region', { name: 'Observed pickups' }).textContent).toContain(summary.totals.observedPickups!.toLocaleString('en-US'))
    expect(screen.getByRole('region', { name: 'MAE' }).textContent).toContain(summary.evaluation.mae!.toLocaleString('en-US', { maximumFractionDigits: 1 }))
    expect(screen.getByRole('region', { name: 'WAPE' }).textContent).toContain(`${summary.evaluation.wape!.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`)
    expect(screen.getByLabelText('Observation coverage').textContent).toContain('11,592 completed zone-hours evaluated')
    expect(screen.getByRole('region', { name: 'Daily demand trend' })).toBeTruthy()
    const axisTicks = within(screen.getByRole('region', { name: 'Daily demand trend' })).getAllByText(/^\d{1,3}(,\d{3})*$/)
      .map((tick) => Number(tick.textContent!.replaceAll(',', '')))
    const visibleValues = summary.daily.flatMap((day) => [day.predictedPickups, day.observedPickups!])
    expect(Math.min(...axisTicks)).toBeGreaterThan(Math.min(...visibleValues) * 0.9)
    expect(Math.min(...axisTicks)).toBeLessThanOrEqual(Math.min(...visibleValues))
    expect(Math.max(...axisTicks)).toBeGreaterThanOrEqual(Math.max(...visibleValues))
    expect(screen.getByRole('region', { name: 'Daily model error' })).toBeTruthy()
    expect(await screen.findByLabelText('Map observed zone count')).toBeTruthy()
  })

  it('switches to thirty days and rejects reversed custom ranges without changing applied data', async () => {
    showOverview()
    await screen.findByRole('region', { name: 'Predicted pickups' })
    await userEvent.click(screen.getByRole('button', { name: 'Last 30 days' }))
    await waitFor(() => expect(screen.getByLabelText('Observation coverage').textContent).toContain('49,680 completed zone-hours evaluated'))
    expect(screen.getByRole('region', { name: 'Overview timeframe' }).textContent).toContain('Mon, Dec 16, 2024')
    const before = screen.getByRole('region', { name: 'Predicted pickups' }).textContent
    await applyRange('2025-01-16', '2025-01-14')
    expect(screen.getByRole('alert').textContent).toContain('end date must be on or after')
    expect(screen.getByRole('region', { name: 'Predicted pickups' }).textContent).toBe(before)
  })

  it('uses completed pairs for evaluation in a mixed past/current/future custom range', async () => {
    showOverview()
    await screen.findByRole('region', { name: 'Predicted pickups' })
    await applyRange('2025-01-14', '2025-01-16')
    await waitFor(() => expect(screen.getByLabelText('Observation coverage').textContent).toContain('2,829 completed zone-hours evaluated'))
    expect(screen.getByRole('region', { name: 'Observed pickups' }).textContent).toContain('Includes current observations so far')
    const summary = await demandService.getSummary({ startDate: '2025-01-14', endDate: '2025-01-16' })
    expect(screen.getByRole('region', { name: 'MAE' }).textContent).toContain(summary.evaluation.mae!.toLocaleString('en-US', { maximumFractionDigits: 1 }))
    expect(screen.getByLabelText('Observation coverage').textContent).toContain('69 partial')
  })

  it('shows unavailable actuals, metrics, and rankings for a future-only range, while retaining forecasts', async () => {
    showOverview()
    await screen.findByRole('region', { name: 'Predicted pickups' })
    await applyRange('2025-01-16', '2025-01-17')
    await waitFor(() => expect(screen.getByRole('region', { name: 'Observed pickups' }).textContent).toContain('N/A'))
    for (const name of ['MAE', 'WAPE', 'Busiest day']) expect(screen.getByRole('region', { name }).textContent).toContain('N/A')
    expect(screen.getByText('No completed zone-hour observations to evaluate.')).toBeTruthy()
    expect(screen.getByText('No completed observations to rank for this range.')).toBeTruthy()
    expect(screen.getByLabelText('Map observed zone count').textContent).toBe('0')
  })

  it('links ranked zones to the map without changing aggregate cards', async () => {
    showOverview()
    await screen.findByRole('region', { name: 'Predicted pickups' })
    const first = await screen.findByRole('button', { name: 'Select Midtown Center on map' })
    const before = screen.getByRole('region', { name: 'Predicted pickups' }).textContent
    await userEvent.click(first)
    expect(screen.getByLabelText('Map selected zone').textContent).toBe('161')
    expect(first.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('region', { name: 'Predicted pickups' }).textContent).toBe(before)
    await userEvent.click(screen.getByRole('button', { name: 'Back to All Zones' }))
    expect(screen.getByLabelText('Map selected zone').textContent).toBe('all')
  })

  it('supports retrying a failed summary while keeping timeframe controls available', async () => {
    const failure = vi.spyOn(demandService, 'getSummary').mockRejectedValue(new Error('Summary unavailable'))
    showOverview()
    const message = await screen.findByText('The overview could not be loaded for this range.')
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toBeTruthy()
    failure.mockRestore()
    await userEvent.click(within(message.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('region', { name: 'Predicted pickups' })).toBeTruthy()
  })

  it('distinguishes a truly empty dataset from future forecasts with no actuals', async () => {
    vi.spyOn(demandService, 'getSummary').mockResolvedValue(summarizeDemand([], { startDate: '2025-01-08', endDate: '2025-01-14' }, '2025-01-15T22:30:00Z'))
    showOverview()
    expect(await screen.findByText('No demand data is available for this range.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Predicted pickups' })).toBeNull()
  })
})
