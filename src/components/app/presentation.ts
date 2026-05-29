import type { SyncStatus, TrackedFileView } from '@/lib/sync-core/types'
import { decideDisplayStatus } from '@/lib/sync-core/status'

export type HealthCheckStatus = 'ok' | 'unlinked' | 'paused' | 'missing' | 'read_error' | 'local_changed' | 'remote_changed' | 'conflict'

export interface ObservedLocalState {
  hash: string | null
  readOk: boolean
}

export interface TrackedFilePresentationSource {
  id: string
  displayName: string
  localPath: string | null
  paused: boolean
  watchEnabled: boolean
  currentRevisionId: string | null
  lastAppliedRevisionId: string | null
  localHash: string | null
  openConflictCount: number
  updatedAt: string | null
}

export function syncStatusPresentation(status: SyncStatus) {
  switch (status) {
    case 'idle':
      return { label: '已同步', tone: 'neutral' as const }
    case 'local_changed':
      return { label: '待上传', tone: 'warning' as const }
    case 'remote_changed':
      return { label: '待下载', tone: 'warning' as const }
    case 'checking_remote':
      return { label: '检查中', tone: 'neutral' as const }
    case 'uploading':
      return { label: '上传中', tone: 'neutral' as const }
    case 'downloading':
      return { label: '下载中', tone: 'neutral' as const }
    case 'conflict':
      return { label: '冲突', tone: 'danger' as const }
    case 'paused':
      return { label: '已暂停', tone: 'neutral' as const }
    case 'error':
      return { label: '需处理', tone: 'danger' as const }
    case 'unlinked':
      return { label: '未链接', tone: 'neutral' as const }
  }
}

export function healthStatusPresentation(status: HealthCheckStatus) {
  switch (status) {
    case 'ok':
      return { label: '正常', tone: 'neutral' as const }
    case 'unlinked':
      return { label: '未链接', tone: 'warning' as const }
    case 'paused':
      return { label: '已暂停', tone: 'neutral' as const }
    case 'missing':
      return { label: '文件缺失', tone: 'danger' as const }
    case 'read_error':
      return { label: '读取失败', tone: 'danger' as const }
    case 'local_changed':
      return { label: '本机已变', tone: 'warning' as const }
    case 'remote_changed':
      return { label: '云端已变', tone: 'warning' as const }
    case 'conflict':
      return { label: '冲突', tone: 'danger' as const }
  }
}

export function formatDate(value: string | null) {
  if (!value) {
    return '尚未同步'
  }
  return new Date(value).toLocaleString()
}

export function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }
  return `${(value / 1024).toFixed(1)} KB`
}

export function previewLines(text: string, maxLines = 80) {
  const lines = text.split(/\r?\n/)
  const visible = lines.slice(0, maxLines)
  if (lines.length > maxLines) {
    visible.push(`... 还有 ${lines.length - maxLines} 行`)
  }
  return visible.join('\n')
}

export function toViewFile(file: TrackedFilePresentationSource, observed?: ObservedLocalState): TrackedFileView {
  return {
    id: file.id,
    displayName: file.displayName,
    localPath: file.localPath,
    status: decideDisplayStatus({
      hasOpenConflict: file.openConflictCount > 0,
      paused: file.paused,
      watchEnabled: file.watchEnabled,
      hasLocalPath: Boolean(file.localPath),
      currentRevisionId: file.currentRevisionId,
      lastAppliedRevisionId: file.lastAppliedRevisionId,
      storedLocalHash: file.localHash,
      observedLocalHash: observed?.hash,
      localReadOk: observed?.readOk,
    }),
    updatedAt: file.updatedAt,
    revision: file.currentRevisionId ? file.currentRevisionId.slice(0, 8) : '未初始化',
  }
}
