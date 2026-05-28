import type { Session, User } from '@supabase/supabase-js'
import type { ArchivedFileListItem, ConflictSnapshot, RemoteFileListItem, RevisionListItem } from '@/lib/sync-adapters/supabase-sync-store'
import type { ConfigPreset } from '@/lib/sync-core/presets'
import type { SyncStatus, TrackedFileView } from '@/lib/sync-core/types'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { confirm, open, save } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { AlertTriangle, Archive, Check, CheckCircle2, Cloud, Columns2, Download, FilePlus2, FolderOpen, GitBranch, GitMerge, Link2, ListPlus, LogOut, Pause, Pencil, Play, RefreshCw, RotateCcw, ToggleLeft, ToggleRight, Trash2, Undo2, Unlink, UploadCloud, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCurrentUser, handleOAuthCallback, hasSupabaseConfig, signInWithGoogle, signOut, supabase } from '@/auth/oauth-service'
import { PlaintextWarning } from '@/components/PlaintextWarning'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getDeviceId, getDeviceLabel, getPlatform } from '@/lib/sync-adapters/device-store'
import { atomicWriteTextWithBackup, localPathExists, makeLocalTextFile, readLocalTextFile } from '@/lib/sync-adapters/local-file-store'
import { archiveTrackedFile, createConflict, createRevisionIfCurrent, createTrackedFile, fetchOpenConflict, fetchRemoteHead, fetchRevision, findTrackedFileByCanonicalKey, listArchivedTrackedFiles, listFileRevisions, listTrackedFiles, renameTrackedFile, resolveConflict, restoreArchivedTrackedFile, setFileLocationAutoUploadEnabled, setFileLocationWatchEnabled, unlinkFileLocation, updateFileLocationAfterApply, upsertDevice, upsertFileLocation } from '@/lib/sync-adapters/supabase-sync-store'
import { decideUpload, detectObviousSecrets } from '@/lib/sync-core/decisions'
import { basenameFromPath, formatFromPath } from '@/lib/sync-core/file-metadata'
import { CONFIG_PRESETS, detectPresetPlatform, presetPathForPlatform } from '@/lib/sync-core/presets'
import { decideDisplayStatus } from '@/lib/sync-core/status'

const CONFIG_FILE_FILTERS = [
  {
    name: 'Config files',
    extensions: ['json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config', 'env', 'txt'],
  },
  {
    name: 'All files',
    extensions: ['*'],
  },
]

function statusLabel(status: SyncStatus) {
  switch (status) {
    case 'idle':
      return '已同步'
    case 'local_changed':
      return '待上传'
    case 'remote_changed':
      return '待下载'
    case 'checking_remote':
      return '检查中'
    case 'uploading':
      return '上传中'
    case 'downloading':
      return '下载中'
    case 'conflict':
      return '冲突'
    case 'paused':
      return '已暂停'
    case 'error':
      return '需处理'
    case 'unlinked':
      return '未链接'
  }
}

function healthStatusLabel(status: HealthCheckStatus) {
  switch (status) {
    case 'ok':
      return '正常'
    case 'unlinked':
      return '未链接'
    case 'paused':
      return '已暂停'
    case 'missing':
      return '文件缺失'
    case 'read_error':
      return '读取失败'
    case 'local_changed':
      return '本机已变'
    case 'remote_changed':
      return '云端已变'
    case 'conflict':
      return '冲突'
  }
}

interface ObservedLocalState {
  hash: string | null
  readOk: boolean
}

interface LocalUploadResult {
  type: 'uploaded' | 'unchanged' | 'blocked' | 'conflict'
  revisionId?: string
  reason?: string
}

type HealthCheckStatus = 'ok' | 'unlinked' | 'paused' | 'missing' | 'read_error' | 'local_changed' | 'remote_changed' | 'conflict'

interface HealthCheckResult {
  fileId: string
  displayName: string
  localPath: string | null
  status: HealthCheckStatus
  detail: string
}

interface ConflictDetail {
  conflict: ConflictSnapshot
  remoteContentText: string
  mergedContentText: string
}

interface ConfigFileChangedPayload {
  path: string
}

interface AppEnv {
  HOME?: string
  APPDATA?: string
  USERPROFILE?: string
}

function formatDate(value: string | null) {
  if (!value) {
    return '尚未同步'
  }
  return new Date(value).toLocaleString()
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }
  return `${(value / 1024).toFixed(1)} KB`
}

function buildDefaultMergeText(localText: string, remoteText: string) {
  if (localText === remoteText) {
    return localText
  }

  return [
    '<<<<<<< 本机',
    localText,
    '=======',
    remoteText,
    '>>>>>>> 云端',
  ].join('\n')
}

function previewLines(text: string, maxLines = 80) {
  const lines = text.split(/\r?\n/)
  const visible = lines.slice(0, maxLines)
  if (lines.length > maxLines) {
    visible.push(`... 还有 ${lines.length - maxLines} 行`)
  }
  return visible.join('\n')
}

function toViewFile(file: RemoteFileListItem, observed?: ObservedLocalState): TrackedFileView {
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

function actionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败'
}

function isRevisionConflictError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { message?: unknown, details?: unknown, hint?: unknown, code?: unknown }
  return [candidate.message, candidate.details, candidate.hint, candidate.code]
    .some(value => typeof value === 'string' && value.includes('revision_conflict'))
}

async function pickExistingFile(defaultPath?: string | null) {
  if (!isTauri()) {
    return defaultPath ?? '/tmp/config.json'
  }

  const selected = await open({
    title: '选择要同步的配置文件',
    multiple: false,
    filters: CONFIG_FILE_FILTERS,
    defaultPath: defaultPath ?? undefined,
  })

  return typeof selected === 'string' ? selected : null
}

async function pickSavePath(displayName: string, defaultPath?: string | null) {
  if (!isTauri()) {
    return defaultPath ?? `/tmp/${displayName}`
  }

  return save({
    title: '选择这台设备上的保存路径',
    filters: CONFIG_FILE_FILTERS,
    defaultPath: defaultPath ?? displayName,
  })
}

async function confirmPlaintextUpload(secretLabels: string[]) {
  const message = secretLabels.length > 0
    ? `文件里有 ${secretLabels.join('、')}。这个应用会把内容以明文存到 Supabase，确定继续上传吗？`
    : '这个应用会把文件内容以明文存到 Supabase。请确认文件里没有 API key、token、密码等敏感信息。继续上传吗？'

  if (!isTauri()) {
    void message
    return true
  }

  return confirm(message, {
    title: '明文同步确认',
    kind: secretLabels.length > 0 ? 'warning' : 'info',
    okLabel: '继续上传',
    cancelLabel: '取消',
  })
}

async function confirmLocalOverwrite(path: string) {
  const exists = await localPathExists(path)
  if (!exists) {
    return true
  }

  const message = `本机路径已存在：${path}\n继续会先创建备份，再用云端内容覆盖这个文件。继续吗？`
  if (!isTauri()) {
    void message
    return true
  }

  return confirm(message, {
    title: '确认覆盖本机文件',
    kind: 'warning',
    okLabel: '备份并覆盖',
    cancelLabel: '取消',
  })
}

async function loadAppEnv(): Promise<AppEnv> {
  if (!isTauri()) {
    return {
      HOME: undefined,
      APPDATA: undefined,
      USERPROFILE: undefined,
    }
  }

  const env = await invoke<{ home?: string, appdata?: string, userprofile?: string }>('get_app_env')
  return {
    HOME: env.home,
    APPDATA: env.appdata,
    USERPROFILE: env.userprofile,
  }
}

export function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authError, setAuthError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [isAuthBusy, setIsAuthBusy] = useState(false)
  const [isActionBusy, setIsActionBusy] = useState(false)
  const [files, setFiles] = useState<RemoteFileListItem[]>([])
  const [archivedFiles, setArchivedFiles] = useState<ArchivedFileListItem[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [isLoadingArchivedFiles, setIsLoadingArchivedFiles] = useState(false)
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false)
  const [lastStatusCheckAt, setLastStatusCheckAt] = useState<string | null>(null)
  const [revisions, setRevisions] = useState<RevisionListItem[]>([])
  const [healthResults, setHealthResults] = useState<HealthCheckResult[]>([])
  const [healthCheckedAt, setHealthCheckedAt] = useState<string | null>(null)
  const [isHealthChecking, setIsHealthChecking] = useState(false)
  const [conflictDetail, setConflictDetail] = useState<ConflictDetail | null>(null)
  const [loadingConflictDetailFileId, setLoadingConflictDetailFileId] = useState<string | null>(null)
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [showPresets, setShowPresets] = useState(false)
  const [showArchivedFiles, setShowArchivedFiles] = useState(false)
  const [observedLocalStates, setObservedLocalStates] = useState<Record<string, ObservedLocalState>>({})
  const [isAwaitingDesktopCallback, setIsAwaitingDesktopCallback] = useState(false)
  const [manualCallbackUrl, setManualCallbackUrl] = useState('')
  const [deviceId] = useState(() => getDeviceId())
  const filesRef = useRef<RemoteFileListItem[]>([])
  const autoUploadInFlightRef = useRef<Set<string>>(new Set())
  const fileWatcherDebounceRef = useRef<number | null>(null)

  const viewFiles = useMemo(
    () => files.map(file => toViewFile(file, observedLocalStates[file.id])),
    [files, observedLocalStates],
  )
  const selectedFile = useMemo(() => {
    if (!selectedId) {
      return files[0] ?? null
    }
    return files.find(file => file.id === selectedId) ?? files[0] ?? null
  }, [files, selectedId])
  const selectedViewFile = selectedFile ? toViewFile(selectedFile, observedLocalStates[selectedFile.id]) : null
  const isRenamingFile = Boolean(selectedFile && renamingFileId === selectedFile.id)
  const activeConflictDetail = selectedFile && conflictDetail?.conflict.fileId === selectedFile.id ? conflictDetail : null
  const isLoadingConflictDetail = Boolean(selectedFile && loadingConflictDetailFileId === selectedFile.id)

  useEffect(() => {
    filesRef.current = files
  }, [files])

  const loadFiles = useCallback(async (options: { quiet?: boolean } = {}) => {
    const quiet = options.quiet ?? false

    if (!user) {
      setFiles([])
      setArchivedFiles([])
      setRevisions([])
      setHealthResults([])
      setHealthCheckedAt(null)
      setIsHealthChecking(false)
      setConflictDetail(null)
      setLoadingConflictDetailFileId(null)
      setRenamingFileId(null)
      setRenameValue('')
      setShowPresets(false)
      setShowArchivedFiles(false)
      setObservedLocalStates({})
      setLastStatusCheckAt(null)
      setIsLoadingFiles(false)
      setIsLoadingArchivedFiles(false)
      return
    }

    if (!quiet) {
      setIsLoadingFiles(true)
      setActionError('')
    }
    try {
      await upsertDevice({
        id: deviceId,
        deviceLabel: getDeviceLabel(),
        platform: getPlatform(),
      })
      const loaded = await listTrackedFiles(deviceId)
      setFiles(loaded)
      setSelectedId(current => current && loaded.some(file => file.id === current) ? current : loaded[0]?.id ?? null)
    }
    catch (error) {
      if (!quiet) {
        setActionError(actionErrorMessage(error))
      }
    }
    finally {
      if (!quiet) {
        setIsLoadingFiles(false)
      }
    }
  }, [deviceId, user])

  const loadArchivedFiles = useCallback(async (options: { quiet?: boolean } = {}) => {
    if (!user) {
      setArchivedFiles([])
      setIsLoadingArchivedFiles(false)
      return
    }

    const quiet = options.quiet ?? false
    if (!quiet) {
      setIsLoadingArchivedFiles(true)
    }
    try {
      const loaded = await listArchivedTrackedFiles()
      setArchivedFiles(loaded)
    }
    catch (error) {
      if (!quiet) {
        setActionError(actionErrorMessage(error))
      }
    }
    finally {
      if (!quiet) {
        setIsLoadingArchivedFiles(false)
      }
    }
  }, [user])

  const loadRevisions = useCallback(async (fileId: string | null, options: { quiet?: boolean } = {}) => {
    if (!user || !fileId) {
      setRevisions([])
      return
    }

    const quiet = options.quiet ?? false
    if (!quiet) {
      setIsLoadingRevisions(true)
    }
    try {
      const loaded = await listFileRevisions(fileId)
      setRevisions(loaded)
    }
    catch (error) {
      if (!quiet) {
        setActionError(actionErrorMessage(error))
      }
    }
    finally {
      if (!quiet) {
        setIsLoadingRevisions(false)
      }
    }
  }, [user])

  const uploadLocalFile = useCallback(async (
    file: RemoteFileListItem,
    options: { confirmPlaintext: boolean, message: string },
  ): Promise<LocalUploadResult> => {
    if (!file.localPath) {
      return { type: 'blocked', reason: 'missing_local_path' }
    }

    const remoteHead = await fetchRemoteHead(file.id)
    if (!remoteHead.readOk) {
      return { type: 'blocked', reason: remoteHead.reason }
    }

    const local = await readLocalTextFile(file.localPath)
    const hasLocalChanges = file.localHash !== local.hash
    if (!hasLocalChanges) {
      return { type: 'unchanged' }
    }

    const decision = decideUpload({
      fileId: file.id,
      watchEnabled: file.watchEnabled,
      localHash: local.hash,
      lastAppliedRevisionId: file.lastAppliedRevisionId,
      hasLocalChanges,
      byteSize: local.byteSize,
    }, remoteHead)

    if (decision.type === 'blocked') {
      return { type: 'blocked', reason: decision.reason }
    }

    if (decision.type === 'conflict') {
      if (decision.remoteRevisionId) {
        await createConflict({
          fileId: file.id,
          deviceId,
          baseRevisionId: decision.localBaseRevisionId,
          remoteRevisionId: decision.remoteRevisionId,
          localContentText: local.contents,
          localContentHash: local.hash,
        })
      }
      return { type: 'conflict' }
    }

    if (options.confirmPlaintext) {
      const secretWarnings = detectObviousSecrets(local.contents)
      const shouldUpload = await confirmPlaintextUpload(secretWarnings.map(warning => warning.label))
      if (!shouldUpload) {
        return { type: 'blocked', reason: 'user_cancelled' }
      }
    }

    let revisionId: string
    try {
      revisionId = await createRevisionIfCurrent({
        fileId: file.id,
        expectedCurrentRevisionId: decision.expectedRevisionId,
        deviceId,
        contentText: local.contents,
        contentHash: local.hash,
        byteSize: local.byteSize,
        message: options.message,
      })
    }
    catch (error) {
      if (!isRevisionConflictError(error)) {
        throw error
      }

      const latestHead = await fetchRemoteHead(file.id)
      if (!latestHead.readOk) {
        return { type: 'blocked', reason: latestHead.reason }
      }
      if (latestHead.currentRevisionId) {
        await createConflict({
          fileId: file.id,
          deviceId,
          baseRevisionId: decision.expectedRevisionId,
          remoteRevisionId: latestHead.currentRevisionId,
          localContentText: local.contents,
          localContentHash: local.hash,
        })
      }
      return { type: 'conflict' }
    }

    await updateFileLocationAfterApply({
      fileId: file.id,
      deviceId,
      lastAppliedRevisionId: revisionId,
      localHash: local.hash,
    })

    return { type: 'uploaded', revisionId }
  }, [deviceId])

  const refreshLocalHashes = useCallback(async (isCancelled: () => boolean = () => false) => {
    const linkedFiles = filesRef.current.filter(file => file.localPath && file.watchEnabled)
    if (linkedFiles.length === 0) {
      return
    }

    const updates = await Promise.all(linkedFiles.map(async (file) => {
      try {
        const local = await readLocalTextFile(file.localPath as string)
        return { fileId: file.id, localHash: local.hash, failed: false }
      }
      catch {
        return { fileId: file.id, localHash: null, failed: true }
      }
    }))

    if (isCancelled()) {
      return
    }

    setObservedLocalStates((current) => {
      const next = { ...current }
      for (const update of updates) {
        next[update.fileId] = {
          hash: update.localHash,
          readOk: !update.failed,
        }
      }
      return next
    })
    setLastStatusCheckAt(new Date().toISOString())
  }, [])

  const autoUploadChangedFiles = useCallback(async () => {
    if (!user) {
      return
    }

    const candidates = filesRef.current.filter(file => (
      file.localPath
      && file.watchEnabled
      && file.autoUploadEnabled
      && file.openConflictCount === 0
      && file.lastAppliedRevisionId === file.currentRevisionId
      && !autoUploadInFlightRef.current.has(file.id)
    ))

    if (candidates.length === 0) {
      return
    }

    let shouldRefreshFiles = false
    const uploadedFileIds: string[] = []
    for (const file of candidates) {
      autoUploadInFlightRef.current.add(file.id)
      try {
        const result = await uploadLocalFile(file, {
          confirmPlaintext: false,
          message: 'Automatic upload',
        })
        if (result.type === 'uploaded') {
          uploadedFileIds.push(file.id)
        }
        if (result.type === 'uploaded' || result.type === 'conflict') {
          shouldRefreshFiles = true
        }
      }
      catch {
        // The next manual sync or refresh will surface the actionable error state.
      }
      finally {
        autoUploadInFlightRef.current.delete(file.id)
      }
    }

    if (shouldRefreshFiles) {
      if (uploadedFileIds.length > 0) {
        setNotice(`已自动上传 ${uploadedFileIds.length} 个文件`)
      }
      await loadFiles({ quiet: true })
      if (selectedFile?.id && uploadedFileIds.includes(selectedFile.id)) {
        await loadRevisions(selectedFile.id, { quiet: true })
      }
    }
  }, [loadFiles, loadRevisions, selectedFile?.id, uploadLocalFile, user])

  const processLocalFileChanges = useCallback(async (options: { refreshRemote?: boolean } = {}) => {
    if (!user) {
      return
    }

    await refreshLocalHashes()
    await autoUploadChangedFiles()
    if (options.refreshRemote ?? true) {
      await loadFiles({ quiet: true })
    }
  }, [autoUploadChangedFiles, loadFiles, refreshLocalHashes, user])

  useEffect(() => {
    void getCurrentUser().then(setUser)

    if (!supabase) {
      return undefined
    }

    if (!isTauri() && window.location.pathname === '/auth/callback') {
      void handleOAuthCallback(window.location.href)
        .then(() => getCurrentUser())
        .then((currentUser) => {
          setUser(currentUser)
          setAuthError('')
          window.history.replaceState({}, document.title, '/')
        })
        .catch(async (error) => {
          const currentUser = await getCurrentUser()
          if (currentUser) {
            setUser(currentUser)
            setAuthError('')
            window.history.replaceState({}, document.title, '/')
            return
          }
          setAuthError(error instanceof Error ? error.message : '登录回调处理失败')
        })
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        setAuthError('')
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !isTauri()) {
      return undefined
    }

    let unlisten: (() => void) | undefined
    const processUrl = async (url: string) => {
      setAuthError('')
      try {
        await handleOAuthCallback(url)
        setUser(await getCurrentUser())
      }
      catch (error) {
        setAuthError(error instanceof Error ? error.message : '登录回调处理失败')
      }
    }

    void getCurrent()
      .then(urls => urls?.forEach(url => void processUrl(url)))
      .catch(() => {})

    void onOpenUrl((urls) => {
      urls.forEach(url => void processUrl(url))
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  useEffect(() => {
    if (showArchivedFiles) {
      void loadArchivedFiles()
    }
  }, [loadArchivedFiles, showArchivedFiles])

  useEffect(() => {
    void loadRevisions(selectedFile?.id ?? null)
  }, [loadRevisions, selectedFile?.id, selectedFile?.currentRevisionId])

  useEffect(() => {
    if (!user) {
      return undefined
    }

    let cancelled = false
    void refreshLocalHashes(() => cancelled)
    const intervalId = window.setInterval(() => {
      void refreshLocalHashes(() => cancelled)
      void autoUploadChangedFiles()
      void loadFiles({ quiet: true })
    }, isTauri() ? 30_000 : 8000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [autoUploadChangedFiles, loadFiles, refreshLocalHashes, user])

  useEffect(() => {
    if (!user || !isTauri()) {
      return undefined
    }

    const watchedPaths = files
      .filter(file => file.localPath && file.watchEnabled)
      .map(file => file.localPath as string)

    void invoke('watch_config_files', { paths: watchedPaths })
      .catch(error => setActionError(actionErrorMessage(error)))

    return () => {
      if (fileWatcherDebounceRef.current !== null) {
        window.clearTimeout(fileWatcherDebounceRef.current)
        fileWatcherDebounceRef.current = null
      }
      void invoke('clear_config_file_watchers').catch(() => {})
    }
  }, [files, user])

  useEffect(() => {
    if (!user || !isTauri()) {
      return undefined
    }

    let unlisten: (() => void) | undefined
    let disposed = false
    void listen<ConfigFileChangedPayload>('config-file-changed', () => {
      if (fileWatcherDebounceRef.current !== null) {
        window.clearTimeout(fileWatcherDebounceRef.current)
      }
      fileWatcherDebounceRef.current = window.setTimeout(() => {
        fileWatcherDebounceRef.current = null
        void processLocalFileChanges()
      }, 700)
    }).then((fn) => {
      if (disposed) {
        fn()
        return
      }
      unlisten = fn
    })

    return () => {
      disposed = true
      unlisten?.()
      if (fileWatcherDebounceRef.current !== null) {
        window.clearTimeout(fileWatcherDebounceRef.current)
        fileWatcherDebounceRef.current = null
      }
    }
  }, [processLocalFileChanges, user])

  useEffect(() => {
    if (!user || files.length === 0) {
      return undefined
    }

    let cancelled = false
    void refreshLocalHashes(() => cancelled)

    return () => {
      cancelled = true
    }
  }, [files, refreshLocalHashes, user])

  const runAction = async (action: () => Promise<void>) => {
    setIsActionBusy(true)
    setActionError('')
    setNotice('')
    try {
      await action()
    }
    catch (error) {
      setActionError(actionErrorMessage(error))
    }
    finally {
      setIsActionBusy(false)
    }
  }

  const ensureSignedIn = () => {
    if (!user) {
      throw new Error('请先使用 Google 登录')
    }
  }

  const handleSignIn = async () => {
    setAuthError('')
    setIsAuthBusy(true)
    try {
      const url = await signInWithGoogle()
      if (isTauri()) {
        setIsAwaitingDesktopCallback(true)
        await openUrl(url)
      }
      else {
        window.location.href = url
      }
    }
    catch (error) {
      setAuthError(error instanceof Error ? error.message : '启动 Google 登录失败')
    }
    finally {
      setIsAuthBusy(false)
    }
  }

  const handleManualCallback = () => runAction(async () => {
    const url = manualCallbackUrl.trim()
    if (!url) {
      throw new Error('请粘贴完整的登录回调 URL')
    }

    await handleOAuthCallback(url)
    setUser(await getCurrentUser())
    setAuthError('')
    setManualCallbackUrl('')
    setIsAwaitingDesktopCallback(false)
  })

  const handleSignOut = async () => {
    setAuthError('')
    setIsAuthBusy(true)
    try {
      await signOut()
      setUser(null)
      setFiles([])
      setRevisions([])
      setHealthResults([])
      setHealthCheckedAt(null)
      setIsHealthChecking(false)
      setConflictDetail(null)
      setLoadingConflictDetailFileId(null)
      setRenamingFileId(null)
      setRenameValue('')
      setShowPresets(false)
      setShowArchivedFiles(false)
      setSelectedId(null)
      setObservedLocalStates({})
      setLastStatusCheckAt(null)
    }
    catch (error) {
      setAuthError(error instanceof Error ? error.message : '退出登录失败')
    }
    finally {
      setIsAuthBusy(false)
    }
  }

  const handleAddFile = () => runAction(async () => {
    ensureSignedIn()
    const path = await pickExistingFile()
    if (!path) {
      return
    }

    const local = await readLocalTextFile(path)
    const secretWarnings = detectObviousSecrets(local.contents)
    const shouldUpload = await confirmPlaintextUpload(secretWarnings.map(warning => warning.label))
    if (!shouldUpload) {
      return
    }

    await upsertDevice({
      id: deviceId,
      deviceLabel: getDeviceLabel(),
      platform: getPlatform(),
    })

    const displayName = basenameFromPath(path)
    const trackedFile = await createTrackedFile({
      displayName,
      format: formatFromPath(path),
      canonicalKey: `${deviceId}:${path}`,
      createdDeviceId: deviceId,
    })
    const revisionId = await createRevisionIfCurrent({
      fileId: trackedFile.id,
      expectedCurrentRevisionId: null,
      deviceId,
      contentText: local.contents,
      contentHash: local.hash,
      byteSize: local.byteSize,
      message: 'Initial upload',
    })
    await upsertFileLocation({
      fileId: trackedFile.id,
      deviceId,
      localPath: local.path,
      lastAppliedRevisionId: revisionId,
      localHash: local.hash,
      watchEnabled: true,
    })

    setNotice(`已添加并上传 ${displayName}`)
    await loadFiles()
    setSelectedId(trackedFile.id)
  })

  const handleAddPreset = (preset: ConfigPreset) => runAction(async () => {
    ensureSignedIn()

    const env = await loadAppEnv()
    const platform = detectPresetPlatform(getPlatform())
    const suggestedPath = presetPathForPlatform(preset, platform, env)
    const path = await pickExistingFile(suggestedPath)
    if (!path) {
      return
    }

    await upsertDevice({
      id: deviceId,
      deviceLabel: getDeviceLabel(),
      platform: getPlatform(),
    })

    const existing = await findTrackedFileByCanonicalKey(deviceId, preset.key)
    if (existing) {
      let localHash: string | null = null
      if (existing.currentRevisionId) {
        const shouldOverwrite = await confirmLocalOverwrite(path)
        if (!shouldOverwrite) {
          return
        }
        const remote = await fetchRevision(existing.currentRevisionId)
        await atomicWriteTextWithBackup(path, remote.contentText)
        localHash = remote.contentHash
      }

      await upsertFileLocation({
        fileId: existing.id,
        deviceId,
        localPath: path,
        lastAppliedRevisionId: existing.currentRevisionId,
        localHash,
        watchEnabled: true,
      })

      setNotice(`已把 ${preset.label} 链接到这台设备`)
      setShowPresets(false)
      await loadFiles()
      setSelectedId(existing.id)
      return
    }

    const local = await readLocalTextFile(path)
    const secretWarnings = detectObviousSecrets(local.contents)
    const shouldUpload = await confirmPlaintextUpload(secretWarnings.map(warning => warning.label))
    if (!shouldUpload) {
      return
    }

    const trackedFile = await createTrackedFile({
      displayName: preset.fileName,
      format: preset.format,
      canonicalKey: preset.key,
      createdDeviceId: deviceId,
    })
    const revisionId = await createRevisionIfCurrent({
      fileId: trackedFile.id,
      expectedCurrentRevisionId: null,
      deviceId,
      contentText: local.contents,
      contentHash: local.hash,
      byteSize: local.byteSize,
      message: `Initial upload from ${preset.label}`,
    })
    await upsertFileLocation({
      fileId: trackedFile.id,
      deviceId,
      localPath: local.path,
      lastAppliedRevisionId: revisionId,
      localHash: local.hash,
      watchEnabled: true,
    })

    setNotice(`已添加并上传 ${preset.label}`)
    setShowPresets(false)
    await loadFiles()
    setSelectedId(trackedFile.id)
  })

  const handleRunHealthCheck = () => runAction(async () => {
    ensureSignedIn()

    setIsHealthChecking(true)
    try {
      const latestFiles = await listTrackedFiles(deviceId)
      const results = await Promise.all(latestFiles.map(async (file): Promise<HealthCheckResult> => {
        if (!file.localPath) {
          return {
            fileId: file.id,
            displayName: file.displayName,
            localPath: null,
            status: 'unlinked',
            detail: '这台设备还没有选择本机路径。',
          }
        }

        if (!file.watchEnabled || file.paused) {
          return {
            fileId: file.id,
            displayName: file.displayName,
            localPath: file.localPath,
            status: 'paused',
            detail: '这台设备已暂停检测。',
          }
        }

        const exists = await localPathExists(file.localPath)
        if (!exists) {
          return {
            fileId: file.id,
            displayName: file.displayName,
            localPath: file.localPath,
            status: 'missing',
            detail: '本机路径不存在。',
          }
        }

        let localHash: string
        try {
          const local = await readLocalTextFile(file.localPath)
          localHash = local.hash
        }
        catch (error) {
          return {
            fileId: file.id,
            displayName: file.displayName,
            localPath: file.localPath,
            status: 'read_error',
            detail: actionErrorMessage(error),
          }
        }

        const hasLocalChanges = localHash !== file.localHash
        const hasRemoteChanges = Boolean(file.currentRevisionId && file.lastAppliedRevisionId !== file.currentRevisionId)
        if (file.openConflictCount > 0 || (hasLocalChanges && hasRemoteChanges)) {
          return {
            fileId: file.id,
            displayName: file.displayName,
            localPath: file.localPath,
            status: 'conflict',
            detail: '本机和云端都已变化，需要手动处理。',
          }
        }
        if (hasLocalChanges) {
          return {
            fileId: file.id,
            displayName: file.displayName,
            localPath: file.localPath,
            status: 'local_changed',
            detail: '本机内容不同于上次同步版本。',
          }
        }
        if (hasRemoteChanges) {
          return {
            fileId: file.id,
            displayName: file.displayName,
            localPath: file.localPath,
            status: 'remote_changed',
            detail: '云端有新版本，当前设备尚未应用。',
          }
        }

        return {
          fileId: file.id,
          displayName: file.displayName,
          localPath: file.localPath,
          status: 'ok',
          detail: '本机和云端基线一致。',
        }
      }))

      setFiles(latestFiles)
      setHealthResults(results)
      setHealthCheckedAt(new Date().toISOString())
      setNotice(`健康检查完成：${results.length} 个文件`)
    }
    finally {
      setIsHealthChecking(false)
    }
  })

  const handleLinkLocalPath = () => runAction(async () => {
    ensureSignedIn()
    if (!selectedFile) {
      throw new Error('先选择一个云端文件')
    }

    const path = await pickSavePath(selectedFile.displayName, selectedFile.localPath)
    if (!path) {
      return
    }

    let localHash: string | null = null
    if (selectedFile.currentRevisionId) {
      const shouldOverwrite = await confirmLocalOverwrite(path)
      if (!shouldOverwrite) {
        return
      }

      const remote = await fetchRevision(selectedFile.currentRevisionId)
      await atomicWriteTextWithBackup(path, remote.contentText)
      localHash = remote.contentHash
    }

    await upsertFileLocation({
      fileId: selectedFile.id,
      deviceId,
      localPath: path,
      lastAppliedRevisionId: selectedFile.currentRevisionId,
      localHash,
      watchEnabled: true,
    })

    setNotice(`已把 ${selectedFile.displayName} 链接到这台设备`)
    await loadFiles()
    await loadRevisions(selectedFile.id, { quiet: true })
  })

  const handleToggleWatch = () => runAction(async () => {
    ensureSignedIn()
    if (!selectedFile?.localPath) {
      throw new Error('这台设备还没有选择本机路径')
    }

    await setFileLocationWatchEnabled({
      fileId: selectedFile.id,
      deviceId,
      watchEnabled: !selectedFile.watchEnabled,
    })

    setObservedLocalStates((current) => {
      const next = { ...current }
      delete next[selectedFile.id]
      return next
    })
    setNotice(selectedFile.watchEnabled ? '已暂停这台设备的自动检测' : '已恢复这台设备的自动检测')
    await loadFiles()
  })

  const handleToggleAutoUpload = () => runAction(async () => {
    ensureSignedIn()
    if (!selectedFile?.localPath) {
      throw new Error('这台设备还没有选择本机路径')
    }

    const nextEnabled = !selectedFile.autoUploadEnabled
    if (nextEnabled) {
      const shouldEnable = isTauri()
        ? await confirm('开启后，本机文件变化会自动以明文上传到 Supabase；云端变化仍不会自动覆盖本机。确定开启吗？', {
            title: '开启自动上传',
            kind: 'warning',
            okLabel: '开启',
            cancelLabel: '取消',
          })
        : true

      if (!shouldEnable) {
        return
      }
    }

    await setFileLocationAutoUploadEnabled({
      fileId: selectedFile.id,
      deviceId,
      autoUploadEnabled: nextEnabled,
    })

    setNotice(nextEnabled ? '已开启这台设备的自动上传' : '已关闭这台设备的自动上传')
    await loadFiles()
  })

  const handleUnlinkLocalPath = () => runAction(async () => {
    ensureSignedIn()
    if (!selectedFile?.localPath) {
      throw new Error('这台设备还没有选择本机路径')
    }

    const shouldUnlink = isTauri()
      ? await confirm('只取消这台设备的本机路径链接，不会删除本机文件，也不会删除云端文件。继续吗？', {
          title: '取消本机路径',
          kind: 'warning',
          okLabel: '取消链接',
          cancelLabel: '保留',
        })
      : true

    if (!shouldUnlink) {
      return
    }

    await unlinkFileLocation(selectedFile.id, deviceId)
    setObservedLocalStates((current) => {
      const next = { ...current }
      delete next[selectedFile.id]
      return next
    })
    setNotice(`已取消这台设备上的 ${selectedFile.displayName} 路径链接`)
    await loadFiles()
  })

  const handleSaveRename = () => runAction(async () => {
    ensureSignedIn()
    if (!selectedFile) {
      throw new Error('先选择一个文件')
    }

    const nextName = renameValue.trim()
    if (!nextName) {
      throw new Error('文件名不能为空')
    }
    if (nextName === selectedFile.displayName) {
      setRenamingFileId(null)
      return
    }

    await renameTrackedFile({
      fileId: selectedFile.id,
      displayName: nextName,
    })

    setRenamingFileId(null)
    setNotice(`已重命名为 ${nextName}`)
    await loadFiles()
  })

  const handleArchiveFile = () => runAction(async () => {
    ensureSignedIn()
    if (!selectedFile) {
      throw new Error('先选择一个文件')
    }

    const shouldArchive = isTauri()
      ? await confirm(`归档云端文件「${selectedFile.displayName}」？\n这会让它从所有设备列表消失，但不会删除任何本机文件。`, {
          title: '归档云端文件',
          kind: 'warning',
          okLabel: '归档',
          cancelLabel: '取消',
        })
      : true

    if (!shouldArchive) {
      return
    }

    await archiveTrackedFile(selectedFile.id)
    setObservedLocalStates((current) => {
      const next = { ...current }
      delete next[selectedFile.id]
      return next
    })
    setRevisions([])
    setRenamingFileId(null)
    setRenameValue('')
    setNotice(`已归档 ${selectedFile.displayName}。本机文件没有删除。`)
    await loadFiles()
    if (showArchivedFiles) {
      await loadArchivedFiles({ quiet: true })
    }
  })

  const handleRestoreArchivedFile = (file: ArchivedFileListItem) => runAction(async () => {
    ensureSignedIn()
    await restoreArchivedTrackedFile(file.id)
    setNotice(`已恢复归档文件 ${file.displayName}`)
    await loadFiles()
    await loadArchivedFiles({ quiet: true })
    setSelectedId(file.id)
  })

  const handleSyncNow = () => runAction(async () => {
    ensureSignedIn()
    if (!selectedFile) {
      throw new Error('先选择一个文件')
    }
    if (!selectedFile.localPath) {
      await handleLinkLocalPath()
      return
    }

    const remoteHead = await fetchRemoteHead(selectedFile.id)
    if (!remoteHead.readOk) {
      throw new Error(`读取云端状态失败：${remoteHead.reason}`)
    }

    const local = await readLocalTextFile(selectedFile.localPath)
    const hasLocalChanges = selectedFile.localHash !== local.hash

    if (!hasLocalChanges && selectedFile.lastAppliedRevisionId === remoteHead.currentRevisionId) {
      setNotice('已经是最新状态')
      return
    }

    if (!hasLocalChanges && remoteHead.currentRevisionId && selectedFile.lastAppliedRevisionId !== remoteHead.currentRevisionId) {
      const remote = await fetchRevision(remoteHead.currentRevisionId)
      await atomicWriteTextWithBackup(selectedFile.localPath, remote.contentText)
      await updateFileLocationAfterApply({
        fileId: selectedFile.id,
        deviceId,
        lastAppliedRevisionId: remote.id,
        localHash: remote.contentHash,
      })
      setNotice(`已从云端下载 ${selectedFile.displayName}`)
      await loadFiles()
      await loadRevisions(selectedFile.id, { quiet: true })
      return
    }

    const result = await uploadLocalFile(selectedFile, {
      confirmPlaintext: true,
      message: 'Manual sync',
    })

    if (result.type === 'blocked') {
      throw new Error(`暂不能上传：${result.reason}`)
    }

    if (result.type === 'conflict') {
      setNotice('本地和云端都改过，已停止自动覆盖。请先手动处理冲突。')
      await loadFiles()
      return
    }

    if (result.type === 'unchanged') {
      setNotice('已经是最新状态')
      return
    }

    setNotice(`已上传 ${selectedFile.displayName}`)
    await loadFiles()
    await loadRevisions(selectedFile.id, { quiet: true })
  })

  const handleRestoreRevision = (revision: RevisionListItem) => runAction(async () => {
    ensureSignedIn()
    if (!selectedFile) {
      throw new Error('先选择一个文件')
    }
    if (revision.id === selectedFile.currentRevisionId) {
      setNotice('这个版本已经是当前云端版本')
      return
    }

    const remoteHead = await fetchRemoteHead(selectedFile.id)
    if (!remoteHead.readOk) {
      throw new Error(`读取云端状态失败：${remoteHead.reason}`)
    }
    if (remoteHead.currentRevisionId !== selectedFile.currentRevisionId) {
      throw new Error('云端已更新，请刷新后再恢复历史版本。')
    }

    const snapshot = await fetchRevision(revision.id)
    const revisionId = await createRevisionIfCurrent({
      fileId: selectedFile.id,
      expectedCurrentRevisionId: remoteHead.currentRevisionId,
      deviceId,
      contentText: snapshot.contentText,
      contentHash: snapshot.contentHash,
      byteSize: snapshot.byteSize,
      message: `Restore ${revision.id.slice(0, 8)}`,
    })

    if (selectedFile.localPath) {
      await atomicWriteTextWithBackup(selectedFile.localPath, snapshot.contentText)
      await updateFileLocationAfterApply({
        fileId: selectedFile.id,
        deviceId,
        lastAppliedRevisionId: revisionId,
        localHash: snapshot.contentHash,
      })
    }

    setNotice(`已恢复 ${selectedFile.displayName} 到 ${revision.id.slice(0, 8)}，并创建新的云端版本`)
    await loadFiles()
    await loadRevisions(selectedFile.id, { quiet: true })
  })

  const handleLoadConflictDetail = () => runAction(async () => {
    ensureSignedIn()
    if (!selectedFile?.localPath) {
      throw new Error('先选择这台设备上的本机路径')
    }

    setLoadingConflictDetailFileId(selectedFile.id)
    try {
      const conflict = await fetchOpenConflict(selectedFile.id, deviceId)
      if (!conflict) {
        throw new Error('没有找到待处理冲突')
      }

      const remote = await fetchRevision(conflict.remoteRevisionId)
      setConflictDetail({
        conflict,
        remoteContentText: remote.contentText,
        mergedContentText: buildDefaultMergeText(conflict.localContentText, remote.contentText),
      })
    }
    finally {
      setLoadingConflictDetailFileId(null)
    }
  })

  const handleManualMerge = () => runAction(async () => {
    ensureSignedIn()
    if (!selectedFile?.localPath) {
      throw new Error('先选择这台设备上的本机路径')
    }
    if (!activeConflictDetail) {
      throw new Error('先打开冲突详情')
    }

    const mergedText = activeConflictDetail.mergedContentText
    const secretWarnings = detectObviousSecrets(mergedText)
    const shouldUpload = await confirmPlaintextUpload(secretWarnings.map(warning => warning.label))
    if (!shouldUpload) {
      return
    }

    const remoteHead = await fetchRemoteHead(selectedFile.id)
    if (!remoteHead.readOk) {
      throw new Error(`读取云端状态失败：${remoteHead.reason}`)
    }
    if (remoteHead.currentRevisionId !== activeConflictDetail.conflict.remoteRevisionId) {
      throw new Error('云端又更新了。请刷新后重新处理冲突。')
    }

    const merged = await makeLocalTextFile(selectedFile.localPath, mergedText)
    const revisionId = await createRevisionIfCurrent({
      fileId: selectedFile.id,
      expectedCurrentRevisionId: activeConflictDetail.conflict.remoteRevisionId,
      deviceId,
      contentText: merged.contents,
      contentHash: merged.hash,
      byteSize: merged.byteSize,
      message: 'Resolve conflict by manual merge',
    })

    await atomicWriteTextWithBackup(selectedFile.localPath, merged.contents)
    await updateFileLocationAfterApply({
      fileId: selectedFile.id,
      deviceId,
      lastAppliedRevisionId: revisionId,
      localHash: merged.hash,
    })
    await resolveConflict(activeConflictDetail.conflict.id, 'resolved_manual_merge')

    setConflictDetail(null)
    setNotice(`已手动合并并上传 ${selectedFile.displayName}`)
    await loadFiles()
    await loadRevisions(selectedFile.id, { quiet: true })
  })

  const handleUseRemote = () => runAction(async () => {
    ensureSignedIn()
    if (!selectedFile?.localPath) {
      throw new Error('先选择这台设备上的本机路径')
    }

    const conflict = await fetchOpenConflict(selectedFile.id, deviceId)
    if (!conflict) {
      throw new Error('没有找到待处理冲突')
    }

    const remote = await fetchRevision(conflict.remoteRevisionId)
    await atomicWriteTextWithBackup(selectedFile.localPath, remote.contentText)
    await updateFileLocationAfterApply({
      fileId: selectedFile.id,
      deviceId,
      lastAppliedRevisionId: remote.id,
      localHash: remote.contentHash,
    })
    await resolveConflict(conflict.id, 'resolved_use_remote')

    setNotice(`已用云端版本覆盖本机 ${selectedFile.displayName}`)
    await loadFiles()
    await loadRevisions(selectedFile.id, { quiet: true })
  })

  const handleKeepLocal = () => runAction(async () => {
    ensureSignedIn()
    if (!selectedFile?.localPath) {
      throw new Error('先选择这台设备上的本机路径')
    }

    const conflict = await fetchOpenConflict(selectedFile.id, deviceId)
    if (!conflict) {
      throw new Error('没有找到待处理冲突')
    }

    const local = await readLocalTextFile(selectedFile.localPath)
    const remoteHead = await fetchRemoteHead(selectedFile.id)
    if (!remoteHead.readOk) {
      throw new Error(`读取云端状态失败：${remoteHead.reason}`)
    }
    if (remoteHead.currentRevisionId !== conflict.remoteRevisionId) {
      throw new Error('云端又更新了。请刷新后重新处理冲突。')
    }

    const secretWarnings = detectObviousSecrets(local.contents)
    const shouldUpload = await confirmPlaintextUpload(secretWarnings.map(warning => warning.label))
    if (!shouldUpload) {
      return
    }

    const revisionId = await createRevisionIfCurrent({
      fileId: selectedFile.id,
      expectedCurrentRevisionId: conflict.remoteRevisionId,
      deviceId,
      contentText: local.contents,
      contentHash: local.hash,
      byteSize: local.byteSize,
      message: 'Resolve conflict by keeping local',
    })
    await updateFileLocationAfterApply({
      fileId: selectedFile.id,
      deviceId,
      lastAppliedRevisionId: revisionId,
      localHash: local.hash,
    })
    await resolveConflict(conflict.id, 'resolved_keep_local')

    setNotice(`已保留本机版本并上传 ${selectedFile.displayName}`)
    await loadFiles()
    await loadRevisions(selectedFile.id, { quiet: true })
  })

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <h1>Sync Any Config</h1>
            <p>多设备同步配置文件</p>
          </div>
        </div>
        <div className="account-strip">
          <Badge variant="secondary">{user?.email ?? '未登录'}</Badge>
          {user
            ? (
                <Button variant="outline" disabled={isAuthBusy} onClick={handleSignOut}>
                  <LogOut size={16} />
                  退出登录
                </Button>
              )
            : (
                <Button variant="outline" disabled={!hasSupabaseConfig || isAuthBusy} onClick={handleSignIn}>
                  <Cloud size={16} />
                  使用 Google 登录
                </Button>
              )}
        </div>
      </header>

      {!hasSupabaseConfig && (
        <section className="inline-error" role="alert">
          缺少 Supabase 配置。请在 `.env.local` 设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。
        </section>
      )}

      {authError && (
        <section className="inline-error" role="alert">
          {authError}
        </section>
      )}

      {isTauri() && !user && isAwaitingDesktopCallback && (
        <section className="manual-callback" aria-label="桌面登录回调">
          <div className="manual-callback-icon">
            <Link2 size={18} />
          </div>
          <div className="manual-callback-body">
            <h2>等待浏览器登录回调</h2>
            <p>如果浏览器停在 sync-any-config://auth/callback 页面，把地址栏里的完整 URL 粘贴到这里完成开发模式登录。</p>
            <div className="manual-callback-row">
              <input
                aria-label="登录回调 URL"
                placeholder="sync-any-config://auth/callback?code=..."
                value={manualCallbackUrl}
                onChange={event => setManualCallbackUrl(event.target.value)}
              />
              <Button disabled={isActionBusy || !manualCallbackUrl.trim()} onClick={handleManualCallback}>
                完成登录
              </Button>
            </div>
          </div>
        </section>
      )}

      {actionError && (
        <section className="inline-error" role="alert">
          {actionError}
        </section>
      )}

      {notice && (
        <section className="inline-notice" role="status">
          {notice}
        </section>
      )}

      <PlaintextWarning />

      <section className="workspace">
        <aside className="sidebar">
          <Button className="full-width" disabled={!user || isActionBusy} onClick={handleAddFile}>
            <FilePlus2 size={16} />
            添加配置文件
          </Button>
          <Button className="full-width preset-toggle" variant="outline" disabled={!user || isActionBusy} onClick={() => setShowPresets(current => !current)}>
            <ListPlus size={16} />
            添加常用配置
          </Button>
          <Button className="full-width preset-toggle" variant="outline" disabled={!user || isActionBusy || isHealthChecking} onClick={handleRunHealthCheck}>
            <CheckCircle2 size={16} />
            {isHealthChecking ? '检查中' : '健康检查'}
          </Button>
          <Button
            className="full-width preset-toggle"
            variant="outline"
            disabled={!user || isActionBusy}
            onClick={() => {
              const nextShowArchivedFiles = !showArchivedFiles
              setShowArchivedFiles(nextShowArchivedFiles)
              if (nextShowArchivedFiles) {
                void loadArchivedFiles()
              }
            }}
          >
            <Archive size={16} />
            {showArchivedFiles ? '隐藏归档文件' : '查看归档文件'}
          </Button>

          {showPresets && (
            <section className="preset-panel" aria-label="常用配置">
              {CONFIG_PRESETS.map(preset => (
                <button
                  key={preset.key}
                  className="preset-row"
                  type="button"
                  disabled={isActionBusy}
                  onClick={() => handleAddPreset(preset)}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.description}</span>
                  <small>{preset.fileName}</small>
                </button>
              ))}
            </section>
          )}

          {healthResults.length > 0 && (
            <section className="health-panel" aria-label="健康检查结果">
              <div className="health-heading">
                <strong>健康检查</strong>
                <span>{formatDate(healthCheckedAt)}</span>
              </div>
              <div className="health-list">
                {healthResults.map(result => (
                  <button
                    key={result.fileId}
                    className="health-row"
                    type="button"
                    onClick={() => setSelectedId(result.fileId)}
                  >
                    <span>
                      <strong>{result.displayName}</strong>
                      <small>{result.detail}</small>
                    </span>
                    <Badge variant={result.status === 'ok' || result.status === 'paused' ? 'secondary' : 'destructive'}>
                      {healthStatusLabel(result.status)}
                    </Badge>
                  </button>
                ))}
              </div>
            </section>
          )}

          {showArchivedFiles && (
            <section className="archived-panel" aria-label="归档文件">
              <div className="health-heading">
                <strong>归档文件</strong>
                <Button variant="ghost" disabled={isLoadingArchivedFiles} onClick={() => void loadArchivedFiles()}>
                  <RefreshCw size={14} />
                  刷新
                </Button>
              </div>
              <div className="archived-list">
                {isLoadingArchivedFiles && (
                  <div className="empty-state">正在加载归档文件...</div>
                )}
                {!isLoadingArchivedFiles && archivedFiles.length === 0 && (
                  <div className="empty-state">没有归档文件。</div>
                )}
                {!isLoadingArchivedFiles && archivedFiles.map(file => (
                  <article key={file.id} className="archived-row">
                    <span>
                      <strong>{file.displayName}</strong>
                      <small>{`归档于 ${formatDate(file.deletedAt)}`}</small>
                    </span>
                    <Button variant="outline" disabled={isActionBusy} onClick={() => handleRestoreArchivedFile(file)}>
                      <Undo2 size={16} />
                      恢复
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="file-list">
            {isLoadingFiles && (
              <div className="empty-state">正在加载云端文件...</div>
            )}
            {!isLoadingFiles && viewFiles.length === 0 && (
              <div className="empty-state">
                {user ? '还没有同步文件。先添加一个本机配置文件。' : '登录后查看同步文件。'}
              </div>
            )}
            {viewFiles.map(file => (
              <button
                key={file.id}
                className={file.id === selectedViewFile?.id ? 'file-row active' : 'file-row'}
                type="button"
                onClick={() => setSelectedId(file.id)}
              >
                <span>
                  <strong>{file.displayName}</strong>
                  <small>{file.localPath ?? '这台设备尚未选择路径'}</small>
                </span>
                <Badge variant={file.status === 'conflict' || file.status === 'error' ? 'destructive' : 'secondary'}>
                  {statusLabel(file.status)}
                </Badge>
              </button>
            ))}
          </div>
        </aside>

        <section className="content-pane">
          {selectedFile && selectedViewFile
            ? (
                <>
                  <div className="file-heading">
                    <div>
                      <h2>{selectedFile.displayName}</h2>
                      <p>{selectedFile.localPath ?? '选择这台设备上的保存路径后开始同步'}</p>
                    </div>
                    <Badge variant={selectedViewFile.status === 'conflict' ? 'destructive' : 'secondary'}>
                      {selectedViewFile.revision}
                    </Badge>
                  </div>

                  <div className="action-row">
                    <Button disabled={isActionBusy} onClick={handleSyncNow}>
                      <RefreshCw size={16} />
                      立即同步
                    </Button>
                    <Button variant="outline" disabled={isActionBusy} onClick={handleLinkLocalPath}>
                      <FolderOpen size={16} />
                      选择本机路径
                    </Button>
                    {selectedFile.localPath && (
                      <Button variant="outline" disabled={isActionBusy} onClick={handleToggleWatch}>
                        {selectedFile.watchEnabled ? <Pause size={16} /> : <Play size={16} />}
                        {selectedFile.watchEnabled ? '暂停检测' : '恢复检测'}
                      </Button>
                    )}
                    {selectedFile.localPath && (
                      <Button variant="outline" disabled={isActionBusy || !selectedFile.watchEnabled} onClick={handleToggleAutoUpload}>
                        {selectedFile.autoUploadEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        {selectedFile.autoUploadEnabled ? '关闭自动上传' : '开启自动上传'}
                      </Button>
                    )}
                    {selectedFile.localPath && (
                      <Button variant="ghost" disabled={isActionBusy} onClick={handleUnlinkLocalPath}>
                        <Unlink size={16} />
                        取消本机路径
                      </Button>
                    )}
                    <Button variant="ghost" disabled={!user || isLoadingFiles} onClick={() => void loadFiles()}>
                      <Cloud size={16} />
                      刷新
                    </Button>
                  </div>

                  <p className="status-check">
                    {lastStatusCheckAt
                      ? `上次自动检测：${formatDate(lastStatusCheckAt)}。自动上传${selectedFile.autoUploadEnabled ? '已开启' : '未开启'}。`
                      : '自动检测将在后台运行；自动上传默认关闭。'}
                  </p>

                  {selectedViewFile.status === 'conflict' && (
                    <section className="conflict-panel" aria-label="冲突处理">
                      <div>
                        <GitMerge size={20} />
                      </div>
                      <div className="conflict-panel-body">
                        <h3>本机和云端都改过</h3>
                        <p>自动同步已暂停，避免覆盖任一端内容。选择一个版本作为新的云端基线后，这台设备会继续同步。</p>
                        <div className="conflict-actions">
                          <Button variant="outline" disabled={isActionBusy || !selectedFile.localPath} onClick={handleUseRemote}>
                            <Download size={16} />
                            用云端覆盖本机
                          </Button>
                          <Button disabled={isActionBusy || !selectedFile.localPath} onClick={handleKeepLocal}>
                            <UploadCloud size={16} />
                            保留本机并上传
                          </Button>
                          <Button variant="outline" disabled={isActionBusy || isLoadingConflictDetail || !selectedFile.localPath} onClick={handleLoadConflictDetail}>
                            <Columns2 size={16} />
                            {isLoadingConflictDetail ? '加载中' : '查看差异'}
                          </Button>
                        </div>

                        {activeConflictDetail && (
                          <section className="conflict-detail" aria-label="冲突详情">
                            <div className="diff-grid">
                              <article>
                                <h4>本机版本</h4>
                                <pre>{previewLines(activeConflictDetail.conflict.localContentText)}</pre>
                              </article>
                              <article>
                                <h4>云端版本</h4>
                                <pre>{previewLines(activeConflictDetail.remoteContentText)}</pre>
                              </article>
                            </div>

                            <label className="merge-editor">
                              <span>合并后的内容</span>
                              <textarea
                                value={activeConflictDetail.mergedContentText}
                                onChange={event => setConflictDetail(current => current
                                  ? {
                                      ...current,
                                      mergedContentText: event.target.value,
                                    }
                                  : current)}
                              />
                            </label>

                            <div className="conflict-actions">
                              <Button disabled={isActionBusy || !activeConflictDetail.mergedContentText.trim()} onClick={handleManualMerge}>
                                <GitMerge size={16} />
                                保存合并并上传
                              </Button>
                              <Button variant="ghost" disabled={isActionBusy} onClick={() => setConflictDetail(null)}>
                                <X size={16} />
                                关闭详情
                              </Button>
                            </div>
                          </section>
                        )}
                      </div>
                    </section>
                  )}

                  <div className="state-grid">
                    <article>
                      <CheckCircle2 size={20} />
                      <h3>同步状态</h3>
                      <p>{statusLabel(selectedViewFile.status)}</p>
                    </article>
                    <article>
                      <Cloud size={20} />
                      <h3>上次更新</h3>
                      <p>{formatDate(selectedFile.updatedAt)}</p>
                    </article>
                    <article>
                      <AlertTriangle size={20} />
                      <h3>保护规则</h3>
                      <p>{selectedFile.autoUploadEnabled ? '只自动上传本机变化，不自动覆盖下载。' : '远端状态未知时不会自动上传。'}</p>
                    </article>
                  </div>

                  <div className="detail-grid">
                    <article>
                      <UploadCloud size={18} />
                      <div>
                        <h3>云端文件</h3>
                        <p>{selectedFile.currentRevisionId ?? '还没有 revision'}</p>
                      </div>
                    </article>
                    <article>
                      <Download size={18} />
                      <div>
                        <h3>本机应用点</h3>
                        <p>{selectedFile.lastAppliedRevisionId ?? '这台设备还没有应用过云端版本'}</p>
                      </div>
                    </article>
                  </div>

                  <section className="cloud-management" aria-label="云端管理">
                    <div className="section-heading">
                      <div>
                        <h3>云端管理</h3>
                        <p>这些操作影响云端记录；归档不会删除任何本机文件。</p>
                      </div>
                      <Cloud size={18} />
                    </div>

                    <div className="management-row">
                      {isRenamingFile
                        ? (
                            <div className="rename-row">
                              <input
                                aria-label="云端文件名"
                                value={renameValue}
                                onChange={event => setRenameValue(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    void handleSaveRename()
                                  }
                                  if (event.key === 'Escape') {
                                    setRenamingFileId(null)
                                    setRenameValue(selectedFile.displayName)
                                  }
                                }}
                              />
                              <Button disabled={isActionBusy || !renameValue.trim()} onClick={handleSaveRename}>
                                <Check size={16} />
                                保存
                              </Button>
                              <Button
                                variant="ghost"
                                disabled={isActionBusy}
                                onClick={() => {
                                  setRenamingFileId(null)
                                  setRenameValue(selectedFile.displayName)
                                }}
                              >
                                <X size={16} />
                                取消
                              </Button>
                            </div>
                          )
                        : (
                            <Button
                              variant="outline"
                              disabled={isActionBusy}
                              onClick={() => {
                                setRenamingFileId(selectedFile.id)
                                setRenameValue(selectedFile.displayName)
                              }}
                            >
                              <Pencil size={16} />
                              重命名云端文件
                            </Button>
                          )}

                      <Button variant="ghost" disabled={isActionBusy} onClick={handleArchiveFile}>
                        <Trash2 size={16} />
                        归档云端文件
                      </Button>
                    </div>
                  </section>

                  <section className="revision-section" aria-label="最近版本">
                    <div className="section-heading">
                      <div>
                        <h3>最近版本</h3>
                        <p>恢复历史版本会创建一个新的云端版本，不会改写旧记录。</p>
                      </div>
                      <GitBranch size={18} />
                    </div>

                    {isLoadingRevisions && (
                      <div className="revision-empty">正在加载版本...</div>
                    )}

                    {!isLoadingRevisions && revisions.length === 0 && (
                      <div className="revision-empty">还没有历史版本。</div>
                    )}

                    {!isLoadingRevisions && revisions.length > 0 && (
                      <div className="revision-list">
                        {revisions.map(revision => (
                          <article key={revision.id} className="revision-row">
                            <div className="revision-meta">
                              <strong>{revision.id.slice(0, 8)}</strong>
                              <span>
                                {`${formatDate(revision.createdAt)} · ${formatBytes(revision.byteSize)}`}
                              </span>
                              <small>
                                {`${revision.message ?? '无说明'} · ${revision.contentHash.slice(0, 12)}`}
                              </small>
                            </div>
                            <Button
                              variant="outline"
                              disabled={isActionBusy || revision.id === selectedFile.currentRevisionId}
                              onClick={() => handleRestoreRevision(revision)}
                            >
                              <RotateCcw size={16} />
                              {revision.id === selectedFile.currentRevisionId ? '当前版本' : '恢复'}
                            </Button>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )
            : (
                <div className="empty-content">
                  <h2>{user ? '添加第一个配置文件' : '先登录 Google'}</h2>
                  <p>{user ? '选择一个 json、yml、toml 或其他文本配置文件，内容会明文存到 Supabase。' : '登录后可以查看和同步你的配置文件。'}</p>
                </div>
              )}
        </section>
      </section>
    </main>
  )
}
