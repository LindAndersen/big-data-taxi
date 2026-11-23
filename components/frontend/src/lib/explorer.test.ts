import { describe, expect, it } from 'vitest'
import { createExplorerSelection, explorerReducer, formatExplorerDate, getCompletedDifference, getDateMode } from './explorer'
import { getDayIntervals } from './time'
import type { HourlyDemand } from '../types/demand'

const clock = { asOf: '2025-01-15T22:30:00Z', timeZone: 'America/New_York' } as const

describe('optional Explorer hour selection', () => {
  it('starts with the fixed New York date and no selected hour', () => {
    expect(createExplorerSelection(clock)).toEqual({ date: '2025-01-15', zoneId: null, intervalStart: null })
    expect(createExplorerSelection({ ...clock, asOf: '2025-01-16T02:30:00Z' }).date).toBe('2025-01-15')
  })
  it('sets/clears hours and preserves them across zone changes only', () => {
    let state = createExplorerSelection(clock)
    state = explorerReducer(state, { type: 'hour', intervalStart: getDayIntervals(state.date)[14].start })
    state = explorerReducer(state, { type: 'zone', zoneId: 43 })
    expect(state.intervalStart).toBe('2025-01-15T19:00:00Z')
    expect(explorerReducer(state, { type: 'hour', intervalStart: null }).intervalStart).toBeNull()
    expect(explorerReducer(state, { type: 'hour', intervalStart: 'not-an-interval' })).toBe(state)
    expect(explorerReducer(state, { type: 'date', date: state.date })).toBe(state)
    expect(explorerReducer(state, { type: 'date', date: '2025-01-16' })).toEqual({ date: '2025-01-16', zoneId: 43, intervalStart: null })
  })
  it('resets on DST date changes and still accepts distinct repeated-hour instants', () => {
    let state = explorerReducer(createExplorerSelection(clock), { type: 'date', date: '2025-11-02' })
    state = explorerReducer(state, { type: 'hour', intervalStart: '2025-11-02T06:00:00Z' })
    expect(state.intervalStart).toBe('2025-11-02T06:00:00Z')
    expect(explorerReducer(state, { type: 'date', date: '2025-03-09' }).intervalStart).toBeNull()
  })
  it('labels dates relative to New York and formats dates without UTC shifting', () => {
    expect(getDateMode('2025-01-14', clock.asOf)).toBe('past')
    expect(getDateMode('2025-01-15', clock.asOf)).toBe('current')
    expect(getDateMode('2025-01-16', clock.asOf)).toBe('future')
    expect(formatExplorerDate('2025-01-15')).toBe('Wed, Jan 15, 2025')
  })
})

describe('selected-hour comparison', () => {
  const hour: HourlyDemand = { zoneId: null, interval: getDayIntervals('2025-01-15')[14], predictedPickups: 100, observation: { status: 'complete', pickups: 80 } }
  it('allows a completed All Zones comparison, with actual minus predicted sign', () => {
    expect(getCompletedDifference(hour, clock.asOf)).toBe(-20)
    expect(getCompletedDifference({ ...hour, observation: { status: 'complete', pickups: 120 } }, clock.asOf)).toBe(20)
  })
  it('never compares partial, unavailable, or not-yet-ended actuals against a full forecast', () => {
    expect(getCompletedDifference({ ...hour, observation: { status: 'partial', pickups: 20, observedThrough: clock.asOf } }, clock.asOf)).toBeNull()
    expect(getCompletedDifference({ ...hour, observation: { status: 'unavailable', pickups: null } }, clock.asOf)).toBeNull()
    expect(getCompletedDifference(hour, hour.interval.start)).toBeNull()
    expect(getCompletedDifference(hour, hour.interval.end)).toBe(-20)
  })
})
