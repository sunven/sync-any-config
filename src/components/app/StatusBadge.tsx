import type { TrackedFileView } from '@/lib/sync-core/types'
import { syncStatusPresentation } from '@/components/app/presentation'
import { Badge } from '@/components/ui/badge'

export function StatusBadge({ status }: { status: TrackedFileView['status'] }) {
  const presentation = syncStatusPresentation(status)
  return (
    <Badge variant={presentation.tone === 'danger' ? 'destructive' : 'secondary'}>
      {presentation.label}
    </Badge>
  )
}
