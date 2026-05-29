import type { AppViewProps } from '@/components/app/view-types'
import { Cloud, FolderOpen, Pause, Play, RefreshCw, ToggleLeft, ToggleRight, Unlink } from 'lucide-react'
import { CloudManagementSection } from '@/components/app/CloudManagementSection'
import { ConflictPanel } from '@/components/app/ConflictPanel'
import { FileStatusCards } from '@/components/app/FileStatusCards'
import { formatDate } from '@/components/app/presentation'
import { RevisionSection } from '@/components/app/RevisionSection'
import { cardClass } from '@/components/app/view-styles'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function AppContent(props: AppViewProps) {
  const isConflict = props.selectedViewFile?.status === 'conflict'

  return (
    <section className={cn(cardClass, 'min-h-0 min-w-0 overflow-y-auto p-4 sm:p-5')}>
      {props.selectedFile && props.selectedViewFile
        ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold leading-tight">{props.selectedFile.displayName}</h2>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {props.selectedFile.localPath ?? '选择这台设备上的保存路径后开始同步'}
                  </p>
                </div>
                <Badge variant={isConflict ? 'destructive' : 'secondary'}>
                  {props.selectedViewFile.revision}
                </Badge>
              </div>

              <FileActionBar {...props} isConflict={isConflict} />

              <p className="-mt-2 mb-4 text-xs text-muted-foreground">
                {props.lastStatusCheckAt
                  ? `上次自动检测：${formatDate(props.lastStatusCheckAt)}。自动上传${props.selectedFile.autoUploadEnabled ? '已开启' : '未开启'}。`
                  : '自动检测将在后台运行；自动上传默认关闭。'}
              </p>

              {isConflict && (
                <ConflictPanel
                  activeConflictDetail={props.activeConflictDetail}
                  hasLocalPath={Boolean(props.selectedFile.localPath)}
                  isActionBusy={props.isActionBusy}
                  isLoadingConflictDetail={props.isLoadingConflictDetail}
                  onUseRemote={props.onUseRemote}
                  onKeepLocal={props.onKeepLocal}
                  onLoadConflictDetail={props.onLoadConflictDetail}
                  onConflictMergedTextChange={props.onConflictMergedTextChange}
                  onManualMerge={props.onManualMerge}
                  onCloseConflictDetail={props.onCloseConflictDetail}
                />
              )}

              <FileStatusCards selectedFile={props.selectedFile} selectedViewFile={props.selectedViewFile} />

              <CloudManagementSection
                selectedFile={props.selectedFile}
                isActionBusy={props.isActionBusy}
                isRenamingFile={props.isRenamingFile}
                renameValue={props.renameValue}
                setRenameValue={props.setRenameValue}
                setRenamingFileId={props.setRenamingFileId}
                onSaveRename={props.onSaveRename}
                onArchiveFile={props.onArchiveFile}
              />

              <RevisionSection
                currentRevisionId={props.selectedFile.currentRevisionId}
                isActionBusy={props.isActionBusy}
                isLoadingRevisions={props.isLoadingRevisions}
                revisions={props.revisions}
                onRestoreRevision={props.onRestoreRevision}
              />
            </>
          )
        : (
            <div className="flex min-h-[260px] flex-col justify-center">
              <h2 className="text-xl font-semibold">{props.isSignedIn ? '添加第一个配置文件' : '先登录 Google'}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {props.isSignedIn ? '选择一个 json、yml、toml 或其他文本配置文件，内容会明文存到 Supabase。' : '登录后可以查看和同步你的配置文件。'}
              </p>
            </div>
          )}
    </section>
  )
}

function FileActionBar(props: AppViewProps & { isConflict: boolean }) {
  if (!props.selectedFile) {
    return null
  }

  return (
    <div className="my-5 flex flex-wrap items-center gap-2">
      {!props.isConflict && (
        <Button disabled={props.isActionBusy} onClick={props.onSyncNow}>
          <RefreshCw size={16} />
          立即同步
        </Button>
      )}
      <Button variant={props.isConflict ? 'ghost' : 'outline'} disabled={props.isActionBusy} onClick={props.onLinkLocalPath}>
        <FolderOpen size={16} />
        选择本机路径
      </Button>
      {props.selectedFile.localPath && !props.isConflict && (
        <>
          <Button variant="outline" disabled={props.isActionBusy} onClick={props.onToggleWatch}>
            {props.selectedFile.watchEnabled ? <Pause size={16} /> : <Play size={16} />}
            {props.selectedFile.watchEnabled ? '暂停检测' : '恢复检测'}
          </Button>
          <Button variant="outline" disabled={props.isActionBusy || !props.selectedFile.watchEnabled} onClick={props.onToggleAutoUpload}>
            {props.selectedFile.autoUploadEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {props.selectedFile.autoUploadEnabled ? '关闭自动上传' : '开启自动上传'}
          </Button>
        </>
      )}
      {props.selectedFile.localPath && (
        <Button variant="ghost" disabled={props.isActionBusy} onClick={props.onUnlinkLocalPath}>
          <Unlink size={16} />
          取消本机路径
        </Button>
      )}
      <Button variant="ghost" disabled={!props.isSignedIn || props.isLoadingFiles} onClick={props.onLoadFiles}>
        <Cloud size={16} />
        刷新
      </Button>
    </div>
  )
}
