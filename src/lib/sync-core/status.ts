import type { SyncStatus } from './types'

export interface DisplayStatusInput {
  hasOpenConflict: boolean
  paused: boolean
  watchEnabled: boolean
  hasLocalPath: boolean
  currentRevisionId: string | null
  lastAppliedRevisionId: string | null
  storedLocalHash: string | null
  observedLocalHash?: string | null
  localReadOk?: boolean
}

export function decideDisplayStatus(input: DisplayStatusInput): SyncStatus {
  if (input.hasOpenConflict) {
    return 'conflict'
  }
  if (input.paused || !input.watchEnabled) {
    return 'paused'
  }
  if (!input.hasLocalPath) {
    return 'unlinked'
  }
  if (input.localReadOk === false) {
    return 'error'
  }

  const hasLocalChanges = input.localReadOk === true && input.observedLocalHash !== input.storedLocalHash
  const hasRemoteChanges = Boolean(input.currentRevisionId && input.lastAppliedRevisionId !== input.currentRevisionId)

  if (hasLocalChanges && hasRemoteChanges) {
    return 'conflict'
  }
  if (hasLocalChanges) {
    return 'local_changed'
  }
  if (hasRemoteChanges) {
    return 'remote_changed'
  }
  return 'idle'
}
