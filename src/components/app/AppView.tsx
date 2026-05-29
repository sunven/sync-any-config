import type { AppViewProps } from '@/components/app/view-types'
import { AppContent } from '@/components/app/AppContent'
import { AppHeader } from '@/components/app/AppHeader'
import { AppMessages } from '@/components/app/AppMessages'
import { AppSidebar } from '@/components/app/AppSidebar'

export type { AppViewProps } from '@/components/app/view-types'

export function AppView(props: AppViewProps) {
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <AppHeader
        userEmail={props.userEmail}
        isSignedIn={props.isSignedIn}
        hasSupabaseConfig={props.hasSupabaseConfig}
        isAuthBusy={props.isAuthBusy}
        onSignIn={props.onSignIn}
        onSignOut={props.onSignOut}
      />

      <AppMessages
        hasSupabaseConfig={props.hasSupabaseConfig}
        authError={props.authError}
        actionError={props.actionError}
        notice={props.notice}
        isDesktopCallbackVisible={props.isDesktopCallbackVisible}
        isActionBusy={props.isActionBusy}
        manualCallbackUrl={props.manualCallbackUrl}
        setManualCallbackUrl={props.setManualCallbackUrl}
        onManualCallback={props.onManualCallback}
      />

      <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,35svh)_minmax(0,1fr)] gap-4 overflow-hidden p-4 sm:px-6 sm:pb-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        <AppSidebar
          isSignedIn={props.isSignedIn}
          isActionBusy={props.isActionBusy}
          isHealthChecking={props.isHealthChecking}
          isLoadingFiles={props.isLoadingFiles}
          isLoadingArchivedFiles={props.isLoadingArchivedFiles}
          showPresets={props.showPresets}
          showArchivedFiles={props.showArchivedFiles}
          presets={props.presets}
          healthResults={props.healthResults}
          healthCheckedAt={props.healthCheckedAt}
          archivedFiles={props.archivedFiles}
          viewFiles={props.viewFiles}
          selectedViewFile={props.selectedViewFile}
          setShowPresets={props.setShowPresets}
          setShowArchivedFiles={props.setShowArchivedFiles}
          onAddFile={props.onAddFile}
          onAddPreset={props.onAddPreset}
          onRunHealthCheck={props.onRunHealthCheck}
          onLoadArchivedFiles={props.onLoadArchivedFiles}
          onRestoreArchivedFile={props.onRestoreArchivedFile}
          onSelectFile={props.onSelectFile}
        />
        <AppContent {...props} />
      </section>
    </main>
  )
}
