export const DEMAND_COLORS = ['#e0f0e7', '#b3dac7', '#7abca3', '#3b9479', '#14644f'] as const
// Fixed visual scale for daily pickups: same colors mean the same counts across dates/metrics.
export const DAILY_DEMAND_SCALE_MAXIMUM = 10_000
export const NO_DEMAND_COLOR = '#dfe5e3'

/** Five equal demand bands; zero is a valid value, missing data has a neutral color. */
export function getDemandColor(value: number | undefined, maximum: number): string {
  if (value === undefined || !Number.isFinite(value)) return NO_DEMAND_COLOR
  const index = maximum > 0 ? Math.min(DEMAND_COLORS.length - 1, Math.max(0, Math.floor(value / maximum * DEMAND_COLORS.length))) : 0
  return DEMAND_COLORS[index]
}
