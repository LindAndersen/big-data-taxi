import { BarChart3, ChevronRight, MapPinned, MoveUpRight, CarTaxiFront } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { cn } from '../lib/utils'

/** Shared responsive navigation; pages own their independent filter state. */
export function AppLayout() {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:p-3">Skip to content</a>
      <aside className="border-b border-border bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
        <Link to="/explorer" className="flex items-center gap-3 px-6 py-7" aria-label="Taxi manager home"><span className="flex size-10 items-center justify-center rounded-xl bg-taxi-yellow"><CarTaxiFront className="size-6" /></span><span className="font-semibold tracking-tight">taxi<span className="text-muted-foreground">manager</span><span className="block text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">NYC demand intelligence</span></span></Link>
        <div className="hidden px-6 pt-5 pb-3 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase lg:block">Workspace</div>
        <nav aria-label="Main navigation" className="flex gap-2 px-4 pb-4 lg:flex-col">
          {[{ to: '/explorer', label: 'Demand Explorer', Icon: MapPinned }, { to: '/overview', label: 'Overview', Icon: BarChart3 }].map(({ to, label, Icon }) => <NavLink key={to} to={to} className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors', isActive ? 'bg-taxi-yellow text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}><Icon className="size-4" />{label}</NavLink>)}
        </nav>
        <div className="mt-auto hidden p-5 lg:block"><div className="rounded-lg border border-border bg-muted/60 p-3"><div className="flex items-center justify-between text-xs font-semibold">Manhattan, New York<MoveUpRight className="size-3 text-muted-foreground" /></div><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">University Big Data project<br />Frontend development preview</p></div><p className="mt-4 text-[10px] text-muted-foreground">America/New_York</p></div>
      </aside>
      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-border bg-white/80 px-5 sm:px-8"><div className="flex items-center gap-2 text-xs text-muted-foreground">Workspace<ChevronRight className="size-3" /><span className="font-medium text-foreground">Taxi demand</span></div><span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] text-muted-foreground">Local frontend</span></header>
        <main id="main-content" className="mx-auto max-w-[1600px] p-5 sm:p-8"><Outlet /></main>
      </div>
    </div>
  )
}
