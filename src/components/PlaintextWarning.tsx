import { AlertTriangle } from 'lucide-react'

export function PlaintextWarning() {
  return (
    <section className="plaintext-warning" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <strong>明文同步</strong>
        <p>
          v1 会把配置文件内容以明文保存到 Supabase。不要同步包含 API key、token、密码或私密服务地址的文件。
        </p>
      </div>
    </section>
  )
}
