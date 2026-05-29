import type { Dispatch, SetStateAction } from 'react'
import type { HealthCheckStatus } from '@/components/app/presentation'
import type { ConfigPreset } from '@/lib/sync-core/presets'
import type { TrackedFileView } from '@/lib/sync-core/types'
import { AlertTriangle, Archive, Check, CheckCircle2, Cloud, Columns2, Download, FilePlus2, FolderOpen, GitBranch, GitMerge, Link2, ListPlus, LogOut, Pause, Pencil, Play, RefreshCw, RotateCcw, ToggleLeft, ToggleRight, Trash2, Undo2, Unlink, UploadCloud, X } from 'lucide-react'
import { formatBytes, formatDate, healthStatusPresentation, previewLines, syncStatusPresentation } from '@/components/app/presentation'
import { PlaintextWarning } from '@/components/PlaintextWarning'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface HealthCheckResultView {
  fileId: string
  displayName: string
  localPath: string | null
  status: HealthCheckStatus
  detail: string
}

interface ConflictDetailView {
  conflict: {
    id: string
    fileId: string
    localContentText: string
  }
  remoteContentText: string
  mergedContentText: string
}

interface ArchivedFileView {
  id: string
  displayName: string
  deletedAt: string
}

interface SelectedFileView {
  id: string
  displayName: string
  localPath: string | null
  currentRevisionId: string | null
  lastAppliedRevisionId: string | null
  updatedAt: string | null
  watchEnabled: boolean
  autoUploadEnabled: boolean
}

interface RevisionView {
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

function StatusBadge({ status }: { status: TrackedFileView['status'] }) {
  const presentation = syncStatusPresentation(status)
  return (
    <Badge variant={presentation.tone === 'danger' ? 'destructive' : 'secondary'}>
      {presentation.label}
    </Badge>
  )
}

export function AppView(props: AppViewProps) {
  const isConflict = props.selectedViewFile?.status === 'conflict'

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
          <Badge variant="secondary">{props.userEmail ?? '未登录'}</Badge>
          {props.isSignedIn
            ? (
                <Button variant="outline" disabled={props.isAuthBusy} onClick={props.onSignOut}>
                  <LogOut size={16} />
                  退出登录
                </Button>
              )
            : (
                <Button variant="outline" disabled={!props.hasSupabaseConfig || props.isAuthBusy} onClick={props.onSignIn}>
                  <Cloud size={16} />
                  使用 Google 登录
                </Button>
              )}
        </div>
      </header>

      {!props.hasSupabaseConfig && (
        <section className="inline-error" role="alert">
          缺少 Supabase 配置。请在 `.env.local` 设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。
        </section>
      )}

      {props.authError && <section className="inline-error" role="alert">{props.authError}</section>}

      {props.isDesktopCallbackVisible && (
        <section className="manual-callback" aria-label="桌面登录回调">
          <div className="manual-callback-icon">
            <Link2 size={18} />
          </div>
          <div className="manual-callback-body">
            <h2>等待浏览器登录回调</h2>
            <p>如果浏览器停在 sync-any-config://auth/callback 页面，把地址栏里的完整 URL 粘贴到这里完成开发模式登录。</p>
            <div className="manual-callback-row">
              <Input
                aria-label="登录回调 URL"
                placeholder="sync-any-config://auth/callback?code=..."
                value={props.manualCallbackUrl}
                onChange={event => props.setManualCallbackUrl(event.target.value)}
              />
              <Button disabled={props.isActionBusy || !props.manualCallbackUrl.trim()} onClick={props.onManualCallback}>
                完成登录
              </Button>
            </div>
          </div>
        </section>
      )}

      {props.actionError && <section className="inline-error" role="alert">{props.actionError}</section>}
      {props.notice && <section className="inline-notice" role="status">{props.notice}</section>}

      <PlaintextWarning />

      <section className="workspace">
        <aside className="sidebar">
          <Button className="full-width" disabled={!props.isSignedIn || props.isActionBusy} onClick={props.onAddFile}>
            <FilePlus2 size={16} />
            添加配置文件
          </Button>
          <Button className="full-width preset-toggle" variant="outline" disabled={!props.isSignedIn || props.isActionBusy} onClick={() => props.setShowPresets(current => !current)}>
            <ListPlus size={16} />
            添加常用配置
          </Button>
          <Button className="full-width preset-toggle" variant="outline" disabled={!props.isSignedIn || props.isActionBusy || props.isHealthChecking} onClick={props.onRunHealthCheck}>
            <CheckCircle2 size={16} />
            {props.isHealthChecking ? '检查中' : '健康检查'}
          </Button>
          <Button
            className="full-width preset-toggle"
            variant="outline"
            disabled={!props.isSignedIn || props.isActionBusy}
            onClick={() => {
              const nextShowArchivedFiles = !props.showArchivedFiles
              props.setShowArchivedFiles(nextShowArchivedFiles)
              if (nextShowArchivedFiles) {
                props.onLoadArchivedFiles()
              }
            }}
          >
            <Archive size={16} />
            {props.showArchivedFiles ? '隐藏归档文件' : '查看归档文件'}
          </Button>

          {props.showPresets && (
            <section className="preset-panel" aria-label="常用配置">
              {props.presets.map(preset => (
                <button key={preset.key} className="preset-row" type="button" disabled={props.isActionBusy} onClick={() => props.onAddPreset(preset)}>
                  <strong>{preset.label}</strong>
                  <span>{preset.description}</span>
                  <small>{preset.fileName}</small>
                </button>
              ))}
            </section>
          )}

          {props.healthResults.length > 0 && (
            <section className="health-panel" aria-label="健康检查结果">
              <div className="health-heading">
                <strong>健康检查</strong>
                <span>{formatDate(props.healthCheckedAt)}</span>
              </div>
              <div className="health-list">
                {props.healthResults.map((result) => {
                  const status = healthStatusPresentation(result.status)
                  return (
                    <button key={result.fileId} className="health-row" type="button" onClick={() => props.onSelectFile(result.fileId)}>
                      <span>
                        <strong>{result.displayName}</strong>
                        <small>{result.detail}</small>
                      </span>
                      <Badge variant={status.tone === 'danger' ? 'destructive' : 'secondary'}>
                        {status.label}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {props.showArchivedFiles && (
            <section className="archived-panel" aria-label="归档文件">
              <div className="health-heading">
                <strong>归档文件</strong>
                <Button variant="ghost" disabled={props.isLoadingArchivedFiles} onClick={props.onLoadArchivedFiles}>
                  <RefreshCw size={14} />
                  刷新
                </Button>
              </div>
              <div className="archived-list">
                {props.isLoadingArchivedFiles && <div className="empty-state">正在加载归档文件...</div>}
                {!props.isLoadingArchivedFiles && props.archivedFiles.length === 0 && <div className="empty-state">没有归档文件。</div>}
                {!props.isLoadingArchivedFiles && props.archivedFiles.map(file => (
                  <article key={file.id} className="archived-row">
                    <span>
                      <strong>{file.displayName}</strong>
                      <small>{`归档于 ${formatDate(file.deletedAt)}`}</small>
                    </span>
                    <Button variant="outline" disabled={props.isActionBusy} onClick={() => props.onRestoreArchivedFile(file.id)}>
                      <Undo2 size={16} />
                      恢复
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="file-list">
            {props.isLoadingFiles && <div className="empty-state">正在加载云端文件...</div>}
            {!props.isLoadingFiles && props.viewFiles.length === 0 && (
              <div className="empty-state">
                {props.isSignedIn ? '还没有同步文件。先添加一个本机配置文件。' : '登录后查看同步文件。'}
              </div>
            )}
            {props.viewFiles.map(file => (
              <button
                key={file.id}
                className={file.id === props.selectedViewFile?.id ? 'file-row active' : 'file-row'}
                type="button"
                onClick={() => props.onSelectFile(file.id)}
              >
                <span>
                  <strong>{file.displayName}</strong>
                  <small>{file.localPath ?? '这台设备尚未选择路径'}</small>
                </span>
                <StatusBadge status={file.status} />
              </button>
            ))}
          </div>
        </aside>

        <section className="content-pane">
          {props.selectedFile && props.selectedViewFile
            ? (
                <>
                  <div className="file-heading">
                    <div>
                      <h2>{props.selectedFile.displayName}</h2>
                      <p>{props.selectedFile.localPath ?? '选择这台设备上的保存路径后开始同步'}</p>
                    </div>
                    <Badge variant={isConflict ? 'destructive' : 'secondary'}>
                      {props.selectedViewFile.revision}
                    </Badge>
                  </div>

                  <div className="action-row">
                    {!isConflict && (
                      <Button disabled={props.isActionBusy} onClick={props.onSyncNow}>
                        <RefreshCw size={16} />
                        立即同步
                      </Button>
                    )}
                    <Button variant={isConflict ? 'ghost' : 'outline'} disabled={props.isActionBusy} onClick={props.onLinkLocalPath}>
                      <FolderOpen size={16} />
                      选择本机路径
                    </Button>
                    {props.selectedFile.localPath && !isConflict && (
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

                  <p className="status-check">
                    {props.lastStatusCheckAt
                      ? `上次自动检测：${formatDate(props.lastStatusCheckAt)}。自动上传${props.selectedFile.autoUploadEnabled ? '已开启' : '未开启'}。`
                      : '自动检测将在后台运行；自动上传默认关闭。'}
                  </p>

                  {isConflict && (
                    <section className="conflict-panel" aria-label="冲突处理">
                      <div><GitMerge size={20} /></div>
                      <div className="conflict-panel-body">
                        <h3>本机和云端都改过</h3>
                        <p>自动同步已暂停，避免覆盖任一端内容。选择一个版本作为新的云端基线后，这台设备会继续同步。</p>
                        <div className="conflict-actions">
                          <Button variant="outline" disabled={props.isActionBusy || !props.selectedFile.localPath} onClick={props.onUseRemote}>
                            <Download size={16} />
                            用云端覆盖本机
                          </Button>
                          <Button disabled={props.isActionBusy || !props.selectedFile.localPath} onClick={props.onKeepLocal}>
                            <UploadCloud size={16} />
                            保留本机并上传
                          </Button>
                          <Button variant="outline" disabled={props.isActionBusy || props.isLoadingConflictDetail || !props.selectedFile.localPath} onClick={props.onLoadConflictDetail}>
                            <Columns2 size={16} />
                            {props.isLoadingConflictDetail ? '加载中' : '查看差异'}
                          </Button>
                        </div>

                        {props.activeConflictDetail && (
                          <section className="conflict-detail" aria-label="冲突详情">
                            <div className="diff-grid">
                              <article>
                                <h4>本机版本</h4>
                                <pre>{previewLines(props.activeConflictDetail.conflict.localContentText)}</pre>
                              </article>
                              <article>
                                <h4>云端版本</h4>
                                <pre>{previewLines(props.activeConflictDetail.remoteContentText)}</pre>
                              </article>
                            </div>

                            <label className="merge-editor">
                              <span>合并后的内容</span>
                              <Textarea
                                className="font-mono text-xs leading-relaxed"
                                value={props.activeConflictDetail.mergedContentText}
                                onChange={event => props.onConflictMergedTextChange(event.target.value)}
                              />
                            </label>

                            <div className="conflict-actions">
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
                  )}

                  <div className="state-grid">
                    <article>
                      <CheckCircle2 size={20} />
                      <h3>同步状态</h3>
                      <p>{syncStatusPresentation(props.selectedViewFile.status).label}</p>
                    </article>
                    <article>
                      <Cloud size={20} />
                      <h3>上次更新</h3>
                      <p>{formatDate(props.selectedFile.updatedAt)}</p>
                    </article>
                    <article>
                      <AlertTriangle size={20} />
                      <h3>保护规则</h3>
                      <p>{props.selectedFile.autoUploadEnabled ? '只自动上传本机变化，不自动覆盖下载。' : '远端状态未知时不会自动上传。'}</p>
                    </article>
                  </div>

                  <div className="detail-grid">
                    <article>
                      <UploadCloud size={18} />
                      <div>
                        <h3>云端文件</h3>
                        <p>{props.selectedFile.currentRevisionId ?? '还没有 revision'}</p>
                      </div>
                    </article>
                    <article>
                      <Download size={18} />
                      <div>
                        <h3>本机应用点</h3>
                        <p>{props.selectedFile.lastAppliedRevisionId ?? '这台设备还没有应用过云端版本'}</p>
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
                      {props.isRenamingFile
                        ? (
                            <div className="rename-row">
                              <Input
                                aria-label="云端文件名"
                                value={props.renameValue}
                                onChange={event => props.setRenameValue(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    props.onSaveRename()
                                  }
                                  if (event.key === 'Escape') {
                                    props.setRenamingFileId(null)
                                    props.setRenameValue(props.selectedFile?.displayName ?? '')
                                  }
                                }}
                              />
                              <Button disabled={props.isActionBusy || !props.renameValue.trim()} onClick={props.onSaveRename}>
                                <Check size={16} />
                                保存
                              </Button>
                              <Button
                                variant="ghost"
                                disabled={props.isActionBusy}
                                onClick={() => {
                                  props.setRenamingFileId(null)
                                  props.setRenameValue(props.selectedFile?.displayName ?? '')
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
                              disabled={props.isActionBusy}
                              onClick={() => {
                                props.setRenamingFileId(props.selectedFile?.id ?? null)
                                props.setRenameValue(props.selectedFile?.displayName ?? '')
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

                  <section className="revision-section" aria-label="最近版本">
                    <div className="section-heading">
                      <div>
                        <h3>最近版本</h3>
                        <p>恢复历史版本会创建一个新的云端版本，不会改写旧记录。</p>
                      </div>
                      <GitBranch size={18} />
                    </div>

                    {props.isLoadingRevisions && <div className="revision-empty">正在加载版本...</div>}
                    {!props.isLoadingRevisions && props.revisions.length === 0 && <div className="revision-empty">还没有历史版本。</div>}
                    {!props.isLoadingRevisions && props.revisions.length > 0 && (
                      <div className="revision-list">
                        {props.revisions.map(revision => (
                          <article key={revision.id} className="revision-row">
                            <div className="revision-meta">
                              <strong>{revision.id.slice(0, 8)}</strong>
                              <span>{`${formatDate(revision.createdAt)} · ${formatBytes(revision.byteSize)}`}</span>
                              <small>{`${revision.message ?? '无说明'} · ${revision.contentHash.slice(0, 12)}`}</small>
                            </div>
                            <Button
                              variant="outline"
                              disabled={props.isActionBusy || revision.id === props.selectedFile?.currentRevisionId}
                              onClick={() => props.onRestoreRevision(revision.id)}
                            >
                              <RotateCcw size={16} />
                              {revision.id === props.selectedFile?.currentRevisionId ? '当前版本' : '恢复'}
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
                  <h2>{props.isSignedIn ? '添加第一个配置文件' : '先登录 Google'}</h2>
                  <p>{props.isSignedIn ? '选择一个 json、yml、toml 或其他文本配置文件，内容会明文存到 Supabase。' : '登录后可以查看和同步你的配置文件。'}</p>
                </div>
              )}
        </section>
      </section>
    </main>
  )
}
