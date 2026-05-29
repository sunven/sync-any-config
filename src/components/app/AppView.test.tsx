import type { AppViewProps } from '@/components/app/AppView'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppView } from '@/components/app/AppView'

function makeProps(overrides: Partial<AppViewProps> = {}): AppViewProps {
  const selectedFile = {
    id: 'file-1',
    displayName: 'settings.json',
    localPath: '/Users/me/.config/settings.json',
    currentRevisionId: 'revision-current-123456',
    lastAppliedRevisionId: 'revision-current-123456',
    updatedAt: '2026-05-29T04:00:00.000Z',
    watchEnabled: true,
    autoUploadEnabled: false,
  }

  const props: AppViewProps = {
    isSignedIn: true,
    userEmail: 'dev@example.com',
    hasSupabaseConfig: true,
    authError: '',
    actionError: '',
    notice: '',
    isAuthBusy: false,
    isActionBusy: false,
    isDesktopCallbackVisible: false,
    manualCallbackUrl: '',
    setManualCallbackUrl: vi.fn(),
    presets: [],
    showPresets: false,
    setShowPresets: vi.fn(),
    showArchivedFiles: false,
    setShowArchivedFiles: vi.fn(),
    isLoadingFiles: false,
    isLoadingArchivedFiles: false,
    isLoadingRevisions: false,
    isHealthChecking: false,
    healthResults: [],
    healthCheckedAt: null,
    archivedFiles: [],
    viewFiles: [{
      id: selectedFile.id,
      displayName: selectedFile.displayName,
      localPath: selectedFile.localPath,
      status: 'idle',
      updatedAt: selectedFile.updatedAt,
      revision: 'revision',
    }],
    selectedFile,
    selectedViewFile: {
      id: selectedFile.id,
      displayName: selectedFile.displayName,
      localPath: selectedFile.localPath,
      status: 'idle',
      updatedAt: selectedFile.updatedAt,
      revision: 'revision',
    },
    lastStatusCheckAt: null,
    isRenamingFile: false,
    renameValue: '',
    setRenameValue: vi.fn(),
    setRenamingFileId: vi.fn(),
    activeConflictDetail: null,
    onConflictMergedTextChange: vi.fn(),
    onCloseConflictDetail: vi.fn(),
    isLoadingConflictDetail: false,
    revisions: [],
    onSignIn: vi.fn(),
    onSignOut: vi.fn(),
    onManualCallback: vi.fn(),
    onAddFile: vi.fn(),
    onAddPreset: vi.fn(),
    onRunHealthCheck: vi.fn(),
    onLoadArchivedFiles: vi.fn(),
    onRestoreArchivedFile: vi.fn(),
    onSelectFile: vi.fn(),
    onLoadFiles: vi.fn(),
    onSyncNow: vi.fn(),
    onLinkLocalPath: vi.fn(),
    onToggleWatch: vi.fn(),
    onToggleAutoUpload: vi.fn(),
    onUnlinkLocalPath: vi.fn(),
    onUseRemote: vi.fn(),
    onKeepLocal: vi.fn(),
    onLoadConflictDetail: vi.fn(),
    onManualMerge: vi.fn(),
    onSaveRename: vi.fn(),
    onArchiveFile: vi.fn(),
    onRestoreRevision: vi.fn(),
  }

  return { ...props, ...overrides }
}

describe('app view', () => {
  it('shows the normal sync actions for an idle selected file', () => {
    render(<AppView {...makeProps()} />)

    expect(screen.getByRole('button', { name: /立即同步/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /暂停检测/ })).toBeInTheDocument()
    expect(screen.getAllByText('已同步')).toHaveLength(2)
  })

  it('prioritizes conflict actions and suppresses normal sync controls', () => {
    render(
      <AppView
        {...makeProps({
          viewFiles: [{
            id: 'file-1',
            displayName: 'settings.json',
            localPath: '/Users/me/.config/settings.json',
            status: 'conflict',
            updatedAt: '2026-05-29T04:00:00.000Z',
            revision: 'revision',
          }],
          selectedViewFile: {
            id: 'file-1',
            displayName: 'settings.json',
            localPath: '/Users/me/.config/settings.json',
            status: 'conflict',
            updatedAt: '2026-05-29T04:00:00.000Z',
            revision: 'revision',
          },
        })}
      />,
    )

    expect(screen.queryByRole('button', { name: /立即同步/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /暂停检测/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /用云端覆盖本机/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /保留本机并上传/ })).toBeInTheDocument()
  })
})
