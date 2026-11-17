import { LoaderCircle } from 'lucide-react'
import { Button } from './ui/button'

export function DataNotice({ message, pending = false, onRetry }: { message: string; pending?: boolean; onRetry?: () => void }) {
  return <div role={onRetry ? 'alert' : 'status'} className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
    {pending && <LoaderCircle className="size-5 animate-spin text-teal-700" />}
    <p>{message}</p>
    {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
  </div>
}
