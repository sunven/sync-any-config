import type { ArchivedFileView, HealthCheckResultView } from '@/components/app/view-types'
import type { ConfigPreset } from '@/lib/sync-core/presets'
import type { TrackedFileView } from '@/lib/sync-core/types'
import { Archive, CheckCircle2, FilePlus2, ListPlus, RefreshCw, Undo2 } from 'lucide-react'
import { formatDate, healthStatusPresentation } from '@/components/app/presentation'
import { StatusBadge } from '@/components/app/StatusBadge'
import { cardClass, ellipsisTextClass, emptyStateClass, insetCardClass } from '@/components/app/view-styles'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AppSidebarProps {
  isSignedIn: boolean
  isActionBusy: boolean
  isHealthChecking: boolean
  isLoadingFiles: boolean
  isLoadingArchivedFiles: boolean
  showPresets: boolean
  showArchivedFiles: boolean
  presets: ConfigPreset[]
  healthResults: HealthCheckResultView[]
  healthCheckedAt: string | null
  archivedFiles: ArchivedFileView[]
  viewFiles: TrackedFileView[]
  selectedViewFile: TrackedFileView | null
  setShowPresets: (value: (current: boolean) => boolean) => void
  setShowArchivedFiles: (value: boolean) => void
  onAddFile: () => void
  onAddPreset: (preset: ConfigPreset) => void
  onRunHealthCheck: () => void
  onLoadArchivedFiles: () => void
  onRestoreArchivedFile: (fileId: string) => void
  onSelectFile: (fileId: string) => void
}

export function AppSidebar(props: AppSidebarProps) {
  return (
    <aside className={cn(cardClass, 'min-h-0 min-w-0 overflow-y-auto p-3')}>
      <div className="grid gap-2">
        <Button className="w-full" disabled={!props.isSignedIn || props.isActionBusy} onClick={props.onAddFile}>
          <FilePlus2 size={16} />
          添加配置文件
        </Button>
        <Button className="w-full" variant="outline" disabled={!props.isSignedIn || props.isActionBusy} onClick={() => props.setShowPresets(current => !current)}>
          <ListPlus size={16} />
          添加常用配置
        </Button>
        <Button className="w-full" variant="outline" disabled={!props.isSignedIn || props.isActionBusy || props.isHealthChecking} onClick={props.onRunHealthCheck}>
          <CheckCircle2 size={16} />
          {props.isHealthChecking ? '检查中' : '健康检查'}
        </Button>
        <Button
          className="w-full"
          variant="outline"
          disabled={!props.isSignedIn || props.isActionBusy}
          onClick={() => {
            const nextShowArchivedFiles = !props.showArchivedFiles
            props.setShowArchivedFiles(nextShowArchivedFiles)
            if (nextShowArchivedFiles) {
              props.onLoadArchivedFiles()
            }
          }}
        >
          <Archive size={16} />
          {props.showArchivedFiles ? '隐藏归档文件' : '查看归档文件'}
        </Button>
      </div>

      {props.showPresets && (
        <section className="mt-3 grid gap-2" aria-label="常用配置">
          {props.presets.map(preset => (
            <button
              key={preset.key}
              className={cn(insetCardClass, 'w-full cursor-pointer p-3 text-left disabled:cursor-not-allowed disabled:opacity-55')}
              type="button"
              disabled={props.isActionBusy}
              onClick={() => props.onAddPreset(preset)}
            >
              <strong className={cn(ellipsisTextClass, 'block text-sm')}>{preset.label}</strong>
              <span className={cn(ellipsisTextClass, 'mt-1 block text-xs text-muted-foreground')}>{preset.description}</span>
              <small className={cn(ellipsisTextClass, 'mt-1 block text-[11px] text-muted-foreground/80')}>{preset.fileName}</small>
            </button>
          ))}
        </section>
      )}

      {props.healthResults.length > 0 && (
        <section className={cn(cardClass, 'mt-3 p-3')} aria-label="健康检查结果">
          <PanelHeading title="健康检查" meta={formatDate(props.healthCheckedAt)} />
          <div className="mt-3 grid gap-2">
            {props.healthResults.map((result) => {
              const status = healthStatusPresentation(result.status)
              return (
                <button
                  key={result.fileId}
                  className={cn(insetCardClass, 'grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-2 text-left')}
                  type="button"
                  onClick={() => props.onSelectFile(result.fileId)}
                >
                  <span className="min-w-0">
                    <strong className={cn(ellipsisTextClass, 'block text-xs')}>{result.displayName}</strong>
                    <small className={cn(ellipsisTextClass, 'mt-1 block text-[11px] text-muted-foreground')}>{result.detail}</small>
                  </span>
                  <Badge variant={status.tone === 'danger' ? 'destructive' : 'secondary'}>
                    {status.label}
                  </Badge>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {props.showArchivedFiles && (
        <section className={cn(cardClass, 'mt-3 p-3')} aria-label="归档文件">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm">归档文件</strong>
            <Button variant="ghost" disabled={props.isLoadingArchivedFiles} onClick={props.onLoadArchivedFiles}>
              <RefreshCw size={14} />
              刷新
            </Button>
          </div>
          <div className="mt-3 grid gap-2">
            {props.isLoadingArchivedFiles && <div className={emptyStateClass}>正在加载归档文件...</div>}
            {!props.isLoadingArchivedFiles && props.archivedFiles.length === 0 && <div className={emptyStateClass}>没有归档文件。</div>}
            {!props.isLoadingArchivedFiles && props.archivedFiles.map(file => (
              <article key={file.id} className={cn(insetCardClass, 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-2')}>
                <span className="min-w-0">
                  <strong className={cn(ellipsisTextClass, 'block text-xs')}>{file.displayName}</strong>
                  <small className={cn(ellipsisTextClass, 'mt-1 block text-[11px] text-muted-foreground')}>{`归档于 ${formatDate(file.deletedAt)}`}</small>
                </span>
                <Button variant="outline" disabled={props.isActionBusy} onClick={() => props.onRestoreArchivedFile(file.id)}>
                  <Undo2 size={16} />
                  恢复
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="mt-4 grid gap-2">
        {props.isLoadingFiles && <div className={emptyStateClass}>正在加载云端文件...</div>}
        {!props.isLoadingFiles && props.viewFiles.length === 0 && (
          <div className={emptyStateClass}>
            {props.isSignedIn ? '还没有同步文件。先添加一个本机配置文件。' : '登录后查看同步文件。'}
          </div>
        )}
        {props.viewFiles.map(file => (
          <button
            key={file.id}
            className={cn(
              'grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-card p-3 text-left',
              file.id === props.selectedViewFile?.id ? 'border-primary bg-accent' : 'border-border',
            )}
            type="button"
            onClick={() => props.onSelectFile(file.id)}
          >
            <span className="min-w-0">
              <strong className={cn(ellipsisTextClass, 'block text-sm')}>{file.displayName}</strong>
              <small className={cn(ellipsisTextClass, 'mt-1 block text-xs text-muted-foreground')}>{file.localPath ?? '这台设备尚未选择路径'}</small>
            </span>
            <StatusBadge status={file.status} />
          </button>
        ))}
      </div>
    </aside>
  )
}

function PanelHeading({ title, meta }: { title: string, meta: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <strong className="text-sm">{title}</strong>
      <span className="text-[11px] text-muted-foreground">{meta}</span>
    </div>
  )
}
