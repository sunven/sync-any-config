import type { ReactNode } from 'react'
import type { SelectedFileView } from '@/components/app/view-types'
import type { TrackedFileView } from '@/lib/sync-core/types'
import { AlertTriangle, CheckCircle2, Cloud, Download, UploadCloud } from 'lucide-react'
import { formatDate, syncStatusPresentation } from '@/components/app/presentation'
import { cardClass } from '@/components/app/view-styles'
import { cn } from '@/lib/utils'

interface FileStatusCardsProps {
  selectedFile: SelectedFileView
  selectedViewFile: TrackedFileView
}

export function FileStatusCards({ selectedFile, selectedViewFile }: FileStatusCardsProps) {
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-3">
        <StatusCard icon={<CheckCircle2 size={20} />} title="同步状态" detail={syncStatusPresentation(selectedViewFile.status).label} />
        <StatusCard icon={<Cloud size={20} />} title="上次更新" detail={formatDate(selectedFile.updatedAt)} />
        <StatusCard
          icon={<AlertTriangle size={20} />}
          title="保护规则"
          detail={selectedFile.autoUploadEnabled ? '只自动上传本机变化，不自动覆盖下载。' : '远端状态未知时不会自动上传。'}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <DetailCard icon={<UploadCloud size={18} />} title="云端文件" detail={selectedFile.currentRevisionId ?? '还没有 revision'} />
        <DetailCard icon={<Download size={18} />} title="本机应用点" detail={selectedFile.lastAppliedRevisionId ?? '这台设备还没有应用过云端版本'} />
      </div>
    </>
  )
}

function StatusCard({ icon, title, detail }: { icon: ReactNode, title: string, detail: string }) {
  return (
    <article className={cn(cardClass, 'p-4')}>
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="mt-3 text-sm font-semibold leading-none">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </article>
  )
}

function DetailCard({ icon, title, detail }: { icon: ReactNode, title: string, detail: string }) {
  return (
    <article className={cn(cardClass, 'flex min-w-0 items-start gap-3 p-4')}>
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-none">{title}</h3>
        <p className="mt-2 break-words text-xs text-muted-foreground">{detail}</p>
      </div>
    </article>
  )
}
