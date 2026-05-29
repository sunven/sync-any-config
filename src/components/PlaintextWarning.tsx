import { AlertTriangle } from 'lucide-react'

export function PlaintextWarning() {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-warning/45 bg-warning/12 px-3 py-2 text-warning-foreground">
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-xs leading-tight">
        <strong className="block font-semibold">明文同步</strong>
        <span className="block truncate">
          配置文件内容会以明文保存到 Supabase，不要同步 API key、token、密码或私密服务地址。
        </span>
      </div>
    </div>
  )
}
