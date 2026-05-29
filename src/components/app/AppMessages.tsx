import { Link2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AppMessagesProps {
  hasSupabaseConfig: boolean
  authError: string
  actionError: string
  notice: string
  isDesktopCallbackVisible: boolean
  isActionBusy: boolean
  manualCallbackUrl: string
  setManualCallbackUrl: (value: string) => void
  onManualCallback: () => void
}

export function AppMessages(props: AppMessagesProps) {
  return (
    <>
      {!props.hasSupabaseConfig && (
        <Alert className="mx-4 mt-4 sm:mx-6" variant="destructive">
          缺少 Supabase 配置。请在 `.env.local` 设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。
        </Alert>
      )}

      {props.authError && (
        <Alert className="mx-4 mt-4 sm:mx-6" variant="destructive">
          {props.authError}
        </Alert>
      )}

      {props.isDesktopCallbackVisible && (
        <Alert className="mx-4 mt-4 flex gap-3 border-info/35 bg-info/10 text-info-foreground sm:mx-6" variant="info" aria-label="桌面登录回调">
          <Link2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <AlertTitle>等待浏览器登录回调</AlertTitle>
            <AlertDescription>
              如果浏览器停在 sync-any-config://auth/callback 页面，把地址栏里的完整 URL 粘贴到这里完成开发模式登录。
            </AlertDescription>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
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
        </Alert>
      )}

      {props.actionError && (
        <Alert className="mx-4 mt-4 sm:mx-6" variant="destructive">
          {props.actionError}
        </Alert>
      )}

      {props.notice && (
        <Alert className="mx-4 mt-4 sm:mx-6" variant="success" role="status">
          {props.notice}
        </Alert>
      )}
    </>
  )
}
