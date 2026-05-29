import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function PlaintextWarning() {
  return (
    <Alert className="plaintext-warning" variant="warning">
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <AlertTitle>明文同步</AlertTitle>
        <AlertDescription>
          v1 会把配置文件内容以明文保存到 Supabase。不要同步包含 API key、token、密码或私密服务地址的文件。
        </AlertDescription>
      </div>
    </Alert>
  )
}
