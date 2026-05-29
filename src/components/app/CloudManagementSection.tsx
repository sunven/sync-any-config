import type { Dispatch, SetStateAction } from 'react'
import type { SelectedFileView } from '@/components/app/view-types'
import { Check, Cloud, Pencil, Trash2, X } from 'lucide-react'
import { cardClass } from '@/components/app/view-styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface CloudManagementSectionProps {
  selectedFile: SelectedFileView
  isActionBusy: boolean
  isRenamingFile: boolean
  renameValue: string
  setRenameValue: Dispatch<SetStateAction<string>>
  setRenamingFileId: Dispatch<SetStateAction<string | null>>
  onSaveRename: () => void
  onArchiveFile: () => void
}

export function CloudManagementSection(props: CloudManagementSectionProps) {
  const cancelRename = () => {
    props.setRenamingFileId(null)
    props.setRenameValue(props.selectedFile.displayName)
  }

  return (
    <section className={cn(cardClass, 'mt-3 p-4')} aria-label="云端管理">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold leading-none">云端管理</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">这些操作影响云端记录；归档不会删除任何本机文件。</p>
        </div>
        <Cloud className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {props.isRenamingFile
          ? (
              <div className="grid min-w-0 flex-1 gap-2 sm:min-w-[280px] sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <Input
                  aria-label="云端文件名"
                  value={props.renameValue}
                  onChange={event => props.setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      props.onSaveRename()
                    }
                    if (event.key === 'Escape') {
                      cancelRename()
                    }
                  }}
                />
                <Button disabled={props.isActionBusy || !props.renameValue.trim()} onClick={props.onSaveRename}>
                  <Check size={16} />
                  保存
                </Button>
                <Button variant="ghost" disabled={props.isActionBusy} onClick={cancelRename}>
                  <X size={16} />
                  取消
                </Button>
              </div>
            )
          : (
              <Button
                variant="outline"
                disabled={props.isActionBusy}
                onClick={() => {
                  props.setRenamingFileId(props.selectedFile.id)
                  props.setRenameValue(props.selectedFile.displayName)
                }}
              >
                <Pencil size={16} />
                重命名云端文件
              </Button>
            )}

        <Button variant="ghost" disabled={props.isActionBusy} onClick={props.onArchiveFile}>
          <Trash2 size={16} />
          归档云端文件
        </Button>
      </div>
    </section>
  )
}
