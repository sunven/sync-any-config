import { AppView } from '@/components/app/AppView'
import { useConfigSyncApp } from '@/useConfigSyncApp'

export function App() {
  return <AppView {...useConfigSyncApp()} />
}
