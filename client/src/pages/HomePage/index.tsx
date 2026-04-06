import { AppShell } from '../../components/layout/AppShell'
import { HomePage as HomeFeaturePage } from '../../features/home'

export function HomePage() {
  return (
    <AppShell>
      <HomeFeaturePage />
    </AppShell>
  )
}
