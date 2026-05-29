import type { ConflictDetailView } from '@/components/app/view-types'
import { Columns2, Download, GitMerge, UploadCloud, X } from 'lucide-react'
import { previewLines } from '@/components/app/presentation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ConflictPanelProps {
  activeConflictDetail: ConflictDetailView | null
  hasLocalPath: boolean
  isActionBusy: boolean
  isLoadingConflictDetail: boolean
  onUseRemote: () => void
  onKeepLocal: () => void
  onLoadConflictDetail: () => void
  onConflictMergedTextChange: (value: string) => void
  onManualMerge: () => void
  onCloseConflictDetail: () => void
}

export function ConflictPanel(props: ConflictPanelProps) {
  return (
    <section className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/35 bg-destructive/8 p-4 text-destructive" aria-label="冲突处理">
      <GitMerge className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-none">本机和云端都改过</h3>
        <p className="mt-2 text-sm leading-relaxed text-destructive/80">
          自动同步已暂停，避免覆盖任一端内容。选择一个版本作为新的云端基线后，这台设备会继续同步。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={props.isActionBusy || !props.hasLocalPath} onClick={props.onUseRemote}>
            <Download size={16} />
            用云端覆盖本机
          </Button>
          <Button disabled={props.isActionBusy || !props.hasLocalPath} onClick={props.onKeepLocal}>
            <UploadCloud size={16} />
            保留本机并上传
          </Button>
          <Button variant="outline" disabled={props.isActionBusy || props.isLoadingConflictDetail || !props.hasLocalPath} onClick={props.onLoadConflictDetail}>
            <Columns2 size={16} />
            {props.isLoadingConflictDetail ? '加载中' : '查看差异'}
          </Button>
        </div>

        {props.activeConflictDetail && (
          <section className="mt-4 grid gap-3" aria-label="冲突详情">
            <div className="grid gap-3 lg:grid-cols-2">
              <DiffPreview title="本机版本" text={props.activeConflictDetail.conflict.localContentText} />
              <DiffPreview title="云端版本" text={props.activeConflictDetail.remoteContentText} />
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-semibold text-destructive">合并后的内容</span>
              <Textarea
                className="min-h-[220px] font-mono text-xs leading-relaxed"
                value={props.activeConflictDetail.mergedContentText}
                onChange={event => props.onConflictMergedTextChange(event.target.value)}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={props.isActionBusy || !props.activeConflictDetail.mergedContentText.trim()} onClick={props.onManualMerge}>
                <GitMerge size={16} />
                保存合并并上传
              </Button>
              <Button variant="ghost" disabled={props.isActionBusy} onClick={props.onCloseConflictDetail}>
                <X size={16} />
                关闭详情
              </Button>
            </div>
          </section>
        )}
      </div>
    </section>
  )
}

function DiffPreview({ title, text }: { title: string, text: string }) {
  return (
    <article className="min-w-0 rounded-md border border-destructive/25 bg-card p-3">
      <h4 className="text-xs font-semibold text-destructive">{title}</h4>
      <pre className={cn(
        'mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-sm bg-background p-2',
        'font-mono text-xs leading-relaxed text-foreground',
      )}
      >
        {previewLines(text)}
      </pre>
    </article>
  )
}
