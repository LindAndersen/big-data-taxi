import { describe, expect, it } from 'vitest'
import { DEMAND_COLORS, getDemandColor, NO_DEMAND_COLOR } from './map-demand'

describe('map color bands', () => {
  it('distinguishes observed zero demand, missing demand, and increasing demand bands', () => {
    expect(getDemandColor(undefined, 100)).toBe(NO_DEMAND_COLOR)
    expect(getDemandColor(0, 100)).toBe(DEMAND_COLORS[0])
    expect([0, 20, 40, 60, 80].map((value) => getDemandColor(value, 100))).toEqual([...DEMAND_COLORS])
  })
  it('handles zero-maximum dates and clamps values at or above the maximum', () => {
    expect(getDemandColor(0, 0)).toBe(DEMAND_COLORS[0])
    expect(getDemandColor(100, 100)).toBe(DEMAND_COLORS[4])
    expect(getDemandColor(120, 100)).toBe(DEMAND_COLORS[4])
  })
})
