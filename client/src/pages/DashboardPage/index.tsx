import { AppShell } from '../../components/layout/AppShell'
import { DashboardPage as FeatureDashboardPage } from '../../features/dashboard'

export function DashboardPage() {
  return (
    <AppShell>
      <FeatureDashboardPage />
    </AppShell>
  )
}
