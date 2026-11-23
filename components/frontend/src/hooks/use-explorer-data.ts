import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { aggregateHourlyDemand, summarizeDemand } from '../lib/demand-calculations'
import type { ExplorerSelection } from '../lib/explorer'
import { getDailyMapMetric, summarizeDailyWeather, type MapDemandMetric } from '../lib/explorer-daily'
import { getDayIntervals } from '../lib/time'
import { clockService, demandService, weatherService } from '../services'
import { useZones } from './use-zones'

export function useDemoClock() {
  return useQuery({ queryKey: ['clock'], queryFn: ({ signal }) => clockService.getCurrentTime(signal), staleTime: Infinity, retry: 1 })
}

/** Fetch one All Zones day; derive the selected series and map values from those same records. */
export function useExplorerData(selection: ExplorerSelection, asOf: string, metric: MapDemandMetric) {
  const zones = useZones()
  const demand = useQuery({
    queryKey: ['demand', 'hourly', selection.date, asOf],
    queryFn: ({ signal }) => demandService.getHourlyDemand({ date: selection.date, zoneId: null }, signal),
    staleTime: Infinity,
    retry: 1,
  })
  const weather = useQuery({
    queryKey: ['weather', 'hourly', selection.date],
    queryFn: ({ signal }) => weatherService.getHourlyWeather(selection.date, signal),
    staleTime: Infinity,
    retry: 1,
  })
  const hours = useMemo(() => !demand.data ? [] : selection.zoneId === null
    ? demand.data.hours
    : aggregateHourlyDemand(demand.data.zoneHours, selection.zoneId), [demand.data, selection.zoneId])
  const dailySummary = useMemo(() => demand.data
    ? summarizeDemand(demand.data.zoneHours, { startDate: selection.date, endDate: selection.date }, demand.data.asOf)
    : undefined, [demand.data, selection.date])
  const observedMetric = useMemo(() => dailySummary ? getDailyMapMetric(dailySummary, 'observed') : undefined, [dailySummary])
  const observedAvailable = !!observedMetric?.values.size
  const effectiveMetric = metric === 'observed' && !observedAvailable ? 'predicted' : metric
  const mapMetric = useMemo(() => !dailySummary ? undefined : effectiveMetric === 'observed' ? observedMetric : getDailyMapMetric(dailySummary, 'predicted'), [dailySummary, effectiveMetric, observedMetric])
  const dailyWeather = useMemo(() => weather.data ? summarizeDailyWeather(weather.data.hours, selection.date) : undefined, [weather.data, selection.date])
  const selectedDaily = selection.zoneId === null ? dailySummary?.totals : dailySummary?.zones.find((zone) => zone.zoneId === selection.zoneId)
  const expectedZoneHours = getDayIntervals(selection.date).length * (selection.zoneId === null ? zones.data?.features.length ?? dailySummary?.zoneCount ?? 0 : 1)
  return {
    zones, demand, weather, hours, mapMetric, observedAvailable, effectiveMetric, selectedDaily, dailyWeather, expectedZoneHours,
    selectedDemand: hours.find((hour) => hour.interval.start === selection.intervalStart),
    selectedWeather: weather.data?.hours.find((hour) => hour.interval.start === selection.intervalStart),
  }
}
