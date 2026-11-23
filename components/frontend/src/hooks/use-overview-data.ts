import { useQuery } from '@tanstack/react-query'
import { demandService } from '../services'
import type { DateRange } from '../types/time'

/** One summary supplies every Overview metric, chart, ranking, and map value. */
export function useOverviewData(range: DateRange, asOf: string) {
  return useQuery({
    queryKey: ['demand', 'summary', range.startDate, range.endDate, asOf],
    queryFn: ({ signal }) => demandService.getSummary(range, signal),
    staleTime: Infinity,
    retry: 1,
  })
}
