import { Cloud, LogOut } from 'lucide-react'
import { PlaintextWarning } from '@/components/PlaintextWarning'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface AppHeaderProps {
  userEmail: string | null
  isSignedIn: boolean
  hasSupabaseConfig: boolean
  isAuthBusy: boolean
  onSignIn: () => void
  onSignOut: () => void
}

export function AppHeader(props: AppHeaderProps) {
  return (
    <header className="grid gap-4 border-b border-border bg-card px-4 py-4 sm:px-6 lg:grid-cols-[minmax(220px,320px)_minmax(260px,1fr)_auto] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted text-foreground">
          <Cloud size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <h1 className="truncate text-lg font-semibold leading-none">Sync Any Config</h1>
          <p className="truncate text-sm text-muted-foreground">多设备同步配置文件</p>
        </div>
      </div>

      <PlaintextWarning />

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
  )
}
