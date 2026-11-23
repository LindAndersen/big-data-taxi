import { useQuery } from '@tanstack/react-query'
import { zoneService } from '../services/zones'

export function useZones() {
  return useQuery({
    queryKey: ['zones', 'Manhattan'],
    queryFn: ({ signal }) => zoneService.getZones(signal),
    staleTime: Infinity,
    retry: 1,
  })
}
