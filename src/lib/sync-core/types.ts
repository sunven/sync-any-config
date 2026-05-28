export const MAX_SYNC_FILE_BYTES = 262_144

export type SyncStatus
  = | 'unlinked'
    | 'idle'
    | 'local_changed'
    | 'remote_changed'
    | 'checking_remote'
    | 'uploading'
    | 'downloading'
    | 'conflict'
    | 'paused'
    | 'error'

export interface TrackedFileView {
  id: string
  displayName: string
  localPath: string | null
  status: SyncStatus
  updatedAt: string | null
  revision: string
}

export interface LocalFileState {
  fileId: string
  watchEnabled: boolean
  localHash: string | null
  lastAppliedRevisionId: string | null
  hasLocalChanges: boolean
  byteSize: number
}

export interface RemoteFileHead {
  fileId: string
  currentRevisionId: string | null
  readOk: true
}

export interface RemoteReadFailed {
  fileId: string
  readOk: false
  reason: string
}

export type RemoteHeadResult = RemoteFileHead | RemoteReadFailed

export type UploadDecision
  = | { type: 'upload', expectedRevisionId: string | null }
    | { type: 'blocked', reason: 'cloud_unknown' | 'paused' | 'too_large' | 'unchanged' }
    | { type: 'conflict', remoteRevisionId: string | null, localBaseRevisionId: string | null }

export interface SecretWarning {
  kind: 'api_key' | 'token' | 'password'
  label: string
}
