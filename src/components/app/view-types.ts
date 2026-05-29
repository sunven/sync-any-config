import type { Dispatch, SetStateAction } from 'react'
import type { HealthCheckStatus } from '@/components/app/presentation'
import type { ConfigPreset } from '@/lib/sync-core/presets'
import type { TrackedFileView } from '@/lib/sync-core/types'

export interface HealthCheckResultView {
  fileId: string
  displayName: string
  localPath: string | null
  status: HealthCheckStatus
  detail: string
}

export interface ConflictDetailView {
  conflict: {
    id: string
    fileId: string
    localContentText: string
  }
  remoteContentText: string
  mergedContentText: string
}

export interface ArchivedFileView {
  id: string
  displayName: string
  deletedAt: string
}

export interface SelectedFileView {
  id: string
  displayName: string
  localPath: string | null
  currentRevisionId: string | null
  lastAppliedRevisionId: string | null
  updatedAt: string | null
  watchEnabled: boolean
  autoUploadEnabled: boolean
}

export interface RevisionView {
  id: string
  contentHash: string
  byteSize: number
  createdAt: string
  message: string | null
}

export interface AppViewProps {
  isSignedIn: boolean
  userEmail: string | null
  hasSupabaseConfig: boolean
  authError: string
  actionError: string
  notice: string
  isAuthBusy: boolean
  isActionBusy: boolean
  isDesktopCallbackVisible: boolean
  manualCallbackUrl: string
  setManualCallbackUrl: Dispatch<SetStateAction<string>>
  presets: ConfigPreset[]
  showPresets: boolean
  setShowPresets: Dispatch<SetStateAction<boolean>>
  showArchivedFiles: boolean
  setShowArchivedFiles: Dispatch<SetStateAction<boolean>>
  isLoadingFiles: boolean
  isLoadingArchivedFiles: boolean
  isLoadingRevisions: boolean
  isHealthChecking: boolean
  healthResults: HealthCheckResultView[]
  healthCheckedAt: string | null
  archivedFiles: ArchivedFileView[]
  viewFiles: TrackedFileView[]
  selectedFile: SelectedFileView | null
  selectedViewFile: TrackedFileView | null
  lastStatusCheckAt: string | null
  isRenamingFile: boolean
  renameValue: string
  setRenameValue: Dispatch<SetStateAction<string>>
  setRenamingFileId: Dispatch<SetStateAction<string | null>>
  activeConflictDetail: ConflictDetailView | null
  onConflictMergedTextChange: (value: string) => void
  onCloseConflictDetail: () => void
  isLoadingConflictDetail: boolean
  revisions: RevisionView[]
  onSignIn: () => void
  onSignOut: () => void
  onManualCallback: () => void
  onAddFile: () => void
  onAddPreset: (preset: ConfigPreset) => void
  onRunHealthCheck: () => void
  onLoadArchivedFiles: () => void
  onRestoreArchivedFile: (fileId: string) => void
  onSelectFile: (fileId: string) => void
  onLoadFiles: () => void
  onSyncNow: () => void
  onLinkLocalPath: () => void
  onToggleWatch: () => void
  onToggleAutoUpload: () => void
  onUnlinkLocalPath: () => void
  onUseRemote: () => void
  onKeepLocal: () => void
  onLoadConflictDetail: () => void
  onManualMerge: () => void
  onSaveRename: () => void
  onArchiveFile: () => void
  onRestoreRevision: (revisionId: string) => void
}
