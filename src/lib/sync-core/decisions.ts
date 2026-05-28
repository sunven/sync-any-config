import type { LocalFileState, RemoteHeadResult, SecretWarning, UploadDecision } from './types'
import { MAX_SYNC_FILE_BYTES } from './types'

export function decideUpload(local: LocalFileState, remote: RemoteHeadResult): UploadDecision {
  if (!remote.readOk) {
    return { type: 'blocked', reason: 'cloud_unknown' }
  }

  if (!local.watchEnabled) {
    return { type: 'blocked', reason: 'paused' }
  }

  if (local.byteSize > MAX_SYNC_FILE_BYTES) {
    return { type: 'blocked', reason: 'too_large' }
  }

  if (!local.hasLocalChanges) {
    return { type: 'blocked', reason: 'unchanged' }
  }

  if (local.lastAppliedRevisionId !== remote.currentRevisionId) {
    return {
      type: 'conflict',
      remoteRevisionId: remote.currentRevisionId,
      localBaseRevisionId: local.lastAppliedRevisionId,
    }
  }

  return { type: 'upload', expectedRevisionId: remote.currentRevisionId }
}

const SECRET_PATTERNS: Array<[SecretWarning['kind'], RegExp]> = [
  ['api_key', /(?:^|\W)(?:api[_-]?key|secret[_-]?key)\s*[:=]\s*["']?[\w-]{16,}/i],
  ['token', /(?:^|\W)(?:access[_-]?token|refresh[_-]?token|token)\s*[:=]\s*["']?[\w.-]{16,}/i],
  ['password', /(?:^|\W)(?:password|passwd|pwd)\s*[:=]\s*.{8,}/i],
]

export function detectObviousSecrets(text: string): SecretWarning[] {
  return SECRET_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([kind]) => ({
      kind,
      label: kind === 'api_key'
        ? '疑似 API key'
        : kind === 'token'
          ? '疑似 token'
          : '疑似密码',
    }))
}
