import type { RevisionView } from '@/components/app/view-types'
import { GitBranch, RotateCcw } from 'lucide-react'
import { formatBytes, formatDate } from '@/components/app/presentation'
import { cardClass, ellipsisTextClass, emptyStateClass, insetCardClass } from '@/components/app/view-styles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RevisionSectionProps {
  currentRevisionId: string | null
  isActionBusy: boolean
  isLoadingRevisions: boolean
  revisions: RevisionView[]
  onRestoreRevision: (revisionId: string) => void
}

export function RevisionSection(props: RevisionSectionProps) {
  return (
    <section className={cn(cardClass, 'mt-3 p-4')} aria-label="最近版本">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold leading-none">最近版本</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">恢复历史版本会创建一个新的云端版本，不会改写旧记录。</p>
        </div>
        <GitBranch className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      {props.isLoadingRevisions && <div className={cn(emptyStateClass, 'mt-4')}>正在加载版本...</div>}
      {!props.isLoadingRevisions && props.revisions.length === 0 && <div className={cn(emptyStateClass, 'mt-4')}>还没有历史版本。</div>}
      {!props.isLoadingRevisions && props.revisions.length > 0 && (
        <div className="mt-4 grid gap-2">
          {props.revisions.map(revision => (
            <article key={revision.id} className={cn(insetCardClass, 'grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center')}>
              <div className="min-w-0">
                <strong className="block text-sm">{revision.id.slice(0, 8)}</strong>
                <span className={cn(ellipsisTextClass, 'mt-1 block text-xs text-muted-foreground')}>{`${formatDate(revision.createdAt)} · ${formatBytes(revision.byteSize)}`}</span>
                <small className={cn(ellipsisTextClass, 'mt-1 block text-xs text-muted-foreground')}>{`${revision.message ?? '无说明'} · ${revision.contentHash.slice(0, 12)}`}</small>
              </div>
              <Button
                variant="outline"
                disabled={props.isActionBusy || revision.id === props.currentRevisionId}
                onClick={() => props.onRestoreRevision(revision.id)}
              >
                <RotateCcw size={16} />
                {revision.id === props.currentRevisionId ? '当前版本' : '恢复'}
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
