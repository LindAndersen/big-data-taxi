import { ChartNoAxesCombined } from 'lucide-react'
import { Card } from '../components/ui/card'
import { ZoneBrowser } from '../components/zone-browser'

export function Overview() {
  return <div className="space-y-6"><div><p className="eyebrow">The bigger picture</p><h1 className="page-title">Overview</h1><p className="page-description">Demand trends and forecast performance across Manhattan.</p></div><Card className="flex items-start gap-4 p-5"><span className="rounded-lg bg-muted p-3"><ChartNoAxesCombined className="size-5 text-teal-700" /></span><div><h2 className="text-sm font-semibold">Analytics are the next increment</h2><p className="mt-1 text-sm text-muted-foreground">The shared application and geographic coverage are ready. Demand totals and evaluation metrics will use the same deterministic zone-hour data.</p></div></Card><ZoneBrowser /></div>
}
