// @vitest-environment jsdom
import geometryJson from '../../public/data/manhattan-zones.geojson?raw'
import { cloneElement, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ZoneMapMetric } from '../components/taxi-zone-map'
import { demandService, clockService, weatherService } from '../services'
import { DemandExplorer } from './demand-explorer'

// Keep the real chart and interaction bands; replace only container measurement,
// which jsdom cannot supply. Actual responsive sizing is checked in the browser.
vi.mock('recharts', async (original) => {
  const actual = await original<typeof import('recharts')>()
  return { ...actual, ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) => cloneElement(children, { width: 700, height: 260 }) }
})

// WebGL is checked in the browser. This boundary exposes the actual props sent
// to the map so tests can verify synchronization without mocking data/services.
vi.mock('../components/taxi-zone-map', () => ({
  TaxiZoneMap: ({ metric, selectedZoneId, onSelectZone }: { metric?: ZoneMapMetric; selectedZoneId: number | null; onSelectZone: (id: number | null) => void }) => <div>
    <output aria-label="Map selected zone">{selectedZoneId ?? 'all'}</output>
    <output aria-label="Map Central Park demand">{metric?.values.get(43) ?? 'Unavailable'}</output>
    <output aria-label="Map metric">{metric?.label}</output>
    <output aria-label="Map observation period">{metric?.period}</output>
    <output aria-label="Map daily maximum">{metric?.maximum}</output>
    <button onClick={() => onSelectZone(43)}>Select Central Park on map</button>
    <button onClick={() => onSelectZone(null)}>Back to All Zones</button>
  </div>,
}))

const geometry = JSON.parse(geometryJson)
let client: QueryClient

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } })
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(geometry)))
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function showExplorer() {
  return render(<QueryClientProvider client={client}><DemandExplorer /></QueryClientProvider>)
}

function panel() {
  return screen.getByRole('region', { name: /^(Daily demand|Selected hour) details$/ })
}

describe('daily map and optional hourly details', () => {
  it('starts in daily mode with observed demand and a full-day weather summary', async () => {
    showExplorer()
    await screen.findByRole('region', { name: 'Daily demand details' })
    expect(screen.getByLabelText('Selected date').getAttribute('value')).toBe('2025-01-15')
    expect(panel().textContent).toContain('Full-day predicted pickups')
    expect(panel().textContent).toContain('Observed so far')
    expect(panel().textContent).toContain('Actual − predictedN/A')
    expect(panel().textContent).toContain('Full-day weather summary')
    expect(panel().textContent).toContain('Temperature range')
    expect(screen.getByRole('button', { name: 'Observed' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText('Map observation period').textContent).toContain('17:30')
    expect(screen.queryByRole('button', { name: 'Clear hour selection' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Select \d/ }).every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true)
  })

  it('sums daily observed values and leaves them unchanged by hour selection, deselection, or zones', async () => {
    const user = userEvent.setup()
    showExplorer()
    await screen.findByRole('region', { name: 'Daily demand details' })
    const park = await demandService.getHourlyDemand({ date: '2025-01-15', zoneId: 43 })
    const observed = park.hours.reduce((sum, hour) => sum + (hour.observation.pickups ?? 0), 0)
    expect(screen.getByLabelText('Map Central Park demand').textContent).toBe(String(observed))
    const hour = screen.getByRole('button', { name: 'Select 14:00–15:00 (UTC-05:00)' })
    await user.click(hour)
    expect(panel().textContent).toContain('14:00–15:00')
    await user.selectOptions(screen.getByLabelText('Selected zone'), '43')
    expect(panel().textContent).toContain('Central Park')
    expect(panel().textContent).toContain('14:00–15:00')
    expect(screen.getByLabelText('Map Central Park demand').textContent).toBe(String(observed))
    await user.click(hour)
    expect(screen.getByRole('region', { name: 'Daily demand details' })).toBeTruthy()
    expect(screen.getByLabelText('Map Central Park demand').textContent).toBe(String(observed))
    expect(within(panel()).getByText(park.hours.reduce((sum, row) => sum + row.predictedPickups, 0).toLocaleString('en-US'))).toBeTruthy()
  })

  it('changes only the map metric when toggled, with the same scale across dates and metrics', async () => {
    const user = userEvent.setup()
    showExplorer()
    await screen.findByRole('region', { name: 'Daily demand details' })
    const maximum = screen.getByLabelText('Map daily maximum').textContent
    const details = panel().textContent
    await user.click(screen.getByRole('button', { name: 'Predicted' }))
    const park = await demandService.getHourlyDemand({ date: '2025-01-15', zoneId: 43 })
    expect(screen.getByLabelText('Map Central Park demand').textContent).toBe(String(park.hours.reduce((sum, row) => sum + row.predictedPickups, 0)))
    expect(screen.getByLabelText('Map daily maximum').textContent).toBe(maximum)
    expect(panel().textContent).toBe(details)
    expect(screen.getByLabelText('Map observation period').textContent).toContain('Full day')
    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    await waitFor(() => expect(panel().textContent).toContain('Tue, Jan 14, 2025'))
    expect(screen.getByLabelText('Map daily maximum').textContent).toBe(maximum)
  })

  it('shows an unavailable observed map for future dates while keeping zone selection and forecasts usable', async () => {
    const user = userEvent.setup()
    showExplorer()
    await screen.findByRole('region', { name: 'Daily demand details' })
    await user.click(screen.getByRole('button', { name: 'Next day' }))
    await waitFor(() => expect(panel().textContent).toContain('Thu, Jan 16, 2025'))
    expect(screen.getByLabelText('Map Central Park demand').textContent).toBe('Unavailable')
    expect(screen.getByLabelText('Map observation period').textContent).toContain('No observations')
    await user.click(screen.getByRole('button', { name: 'Select Central Park on map' }))
    await user.click(screen.getByRole('button', { name: 'Select 14:00–15:00 (UTC-05:00)' }))
    expect(panel().textContent).toContain('Central Park')
    expect(panel().textContent).toContain('Not yet available')
    await user.click(screen.getByRole('button', { name: 'Predicted' }))
    const park = await demandService.getHourlyDemand({ date: '2025-01-16', zoneId: 43 })
    expect(screen.getByLabelText('Map Central Park demand').textContent).toBe(String(park.hours.reduce((sum, row) => sum + row.predictedPickups, 0)))
    expect(within(panel()).getByText(park.hours[14].predictedPickups.toLocaleString('en-US'))).toBeTruthy()
  })

  it('supports clear selection, first/last bands, and repeated keyboard navigation without toggling off', async () => {
    const user = userEvent.setup()
    showExplorer()
    await screen.findByRole('region', { name: 'Daily demand details' })
    const first = screen.getByRole('button', { name: 'Select 00:00–01:00 (UTC-05:00)' })
    await user.click(first)
    await user.keyboard('{Home}')
    expect(first.getAttribute('aria-pressed')).toBe('true')
    await user.keyboard('{ArrowRight}{End}')
    expect(panel().textContent).toContain('23:00–00:00')
    await user.click(screen.getByRole('button', { name: 'Clear hour selection' }))
    expect(screen.getByRole('region', { name: 'Daily demand details' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Clear hour selection' })).toBeNull()
  })

  it('resets hourly selection on date changes, preserves the zone, and returns to daily details', async () => {
    const user = userEvent.setup()
    showExplorer()
    await screen.findByRole('region', { name: 'Daily demand details' })
    await user.selectOptions(screen.getByLabelText('Selected zone'), '43')
    await user.click(screen.getByRole('button', { name: 'Select 14:00–15:00 (UTC-05:00)' }))
    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    await waitFor(() => expect(screen.getByRole('region', { name: 'Daily demand details' }).textContent).toContain('Tue, Jan 14, 2025'))
    expect(panel().textContent).toContain('Central Park')
    expect(screen.queryByRole('button', { name: 'Clear hour selection' })).toBeNull()
    const park = await demandService.getHourlyDemand({ date: '2025-01-14', zoneId: 43 })
    const predicted = park.hours.reduce((sum, row) => sum + row.predictedPickups, 0)
    const observed = park.hours.reduce((sum, row) => sum + (row.observation.pickups ?? 0), 0)
    const diff = observed - predicted
    expect(panel().textContent).toContain(`Actual − predicted${diff > 0 ? '+' : ''}${diff.toLocaleString('en-US')}`)
    await user.click(screen.getByRole('button', { name: 'Back to All Zones' }))
    expect(panel().textContent).toContain('All Zones')
    await user.click(screen.getByRole('button', { name: 'Today' }))
    await waitFor(() => expect(panel().textContent).toContain('Wed, Jan 15, 2025'))
  })

  it('allows completed hourly comparisons today but excludes the partial hour from comparisons', async () => {
    const user = userEvent.setup()
    showExplorer()
    await screen.findByRole('region', { name: 'Daily demand details' })
    await user.click(screen.getByRole('button', { name: 'Select 14:00–15:00 (UTC-05:00)' }))
    expect(panel().textContent).toContain('Completed')
    await user.click(screen.getByRole('button', { name: 'Select 17:00–18:00 (UTC-05:00)' }))
    expect(panel().textContent).toContain('Observed so far')
    expect(panel().textContent).toContain('no forecast difference is calculated')
    expect(panel().textContent).toContain('Actual − predictedN/A')
  })

  it('keeps DST hours distinct and resets selection when navigating to another DST date', async () => {
    const user = userEvent.setup()
    showExplorer()
    await screen.findByRole('region', { name: 'Daily demand details' })
    fireEvent.change(screen.getByLabelText('Selected date'), { target: { value: '2025-11-02' } })
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Select \d/ })).toHaveLength(25))
    const first = screen.getByRole('button', { name: 'Select 01:00–01:00 (UTC-04:00 → UTC-05:00)' })
    const second = screen.getByRole('button', { name: 'Select 01:00–02:00 (UTC-05:00)' })
    await user.click(first)
    await user.click(second)
    expect(second.getAttribute('aria-pressed')).toBe('true')
    expect(first.getAttribute('aria-pressed')).toBe('false')
    fireEvent.change(screen.getByLabelText('Selected date'), { target: { value: '2025-03-09' } })
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Select \d/ })).toHaveLength(23))
    expect(screen.getByRole('region', { name: 'Daily demand details' }).textContent).toContain('23 elapsed hours')
  })
})

describe('Explorer loading, error, and empty states', () => {
  it('shows loading until demand arrives, then replaces it with the interactive chart', async () => {
    const response = await demandService.getHourlyDemand({ date: '2025-01-15', zoneId: null })
    let release!: (value: typeof response) => void
    vi.spyOn(demandService, 'getHourlyDemand').mockImplementation(() => new Promise((resolve) => { release = resolve }))
    showExplorer()
    await screen.findByText('Loading hourly demand…')
    expect(screen.queryByRole('region', { name: /^(Daily demand|Selected hour) details$/ })).toBeNull()
    await act(async () => release(response))
    expect(await screen.findByRole('region', { name: /^(Daily demand|Selected hour) details$/ })).toBeTruthy()
  })

  it('can retry failed demand without losing date controls', async () => {
    const failure = vi.spyOn(demandService, 'getHourlyDemand').mockRejectedValue(new Error('Demand unavailable'))
    showExplorer()
    const message = await screen.findByText('Demand could not be loaded for this date.')
    expect(screen.getByLabelText('Selected date')).toBeTruthy()
    failure.mockRestore()
    await userEvent.click(within(message.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('region', { name: /^(Daily demand|Selected hour) details$/ })).toBeTruthy()
  })

  it('keeps demand usable while weather fails and supports retrying weather independently', async () => {
    const failure = vi.spyOn(weatherService, 'getHourlyWeather').mockRejectedValue(new Error('Weather unavailable'))
    showExplorer()
    const retry = await screen.findByRole('button', { name: 'Retry weather' })
    expect(panel().textContent).toContain('predicted pickups')
    failure.mockRestore()
    await userEvent.click(retry)
    await waitFor(() => expect(panel().textContent).toContain('°C'))
    expect(screen.queryByRole('button', { name: 'Retry weather' })).toBeNull()
  })

  it('shows an empty response rather than stale graph or panel values', async () => {
    const response = await demandService.getHourlyDemand({ date: '2025-01-15', zoneId: null })
    vi.spyOn(demandService, 'getHourlyDemand').mockResolvedValue({ ...response, hours: [], zoneHours: [] })
    showExplorer()
    expect(await screen.findByText('No hourly observations or forecasts are available for this selection.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: /^(Daily demand|Selected hour) details$/ })).toBeNull()
  })

  it('can retry the clock and handles a missing weather interval', async () => {
    const failure = vi.spyOn(clockService, 'getCurrentTime').mockRejectedValue(new Error('Clock unavailable'))
    vi.spyOn(weatherService, 'getHourlyWeather').mockImplementation(async (date) => ({ date, timeZone: 'America/New_York', hours: [] }))
    showExplorer()
    await screen.findByText('The demo clock could not be loaded.')
    failure.mockRestore()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No weather observations for this date.')).toBeTruthy()
    expect(panel().textContent).toContain('predicted pickups')
  })
})
