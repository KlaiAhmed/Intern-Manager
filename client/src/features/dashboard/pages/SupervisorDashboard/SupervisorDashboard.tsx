import { matchPath, useLocation } from 'react-router-dom'
import { SupervisorJournalReviewPage } from './SupervisorJournalReviewPage'
import { SupervisorDashboardView } from './SupervisorDashboardView'
import { useSupervisorDashboardState } from './useSupervisorDashboardState'

/**
 * Tableau de bord pour le rôle supervisor.
 * Gère les missions, les livrables, les évaluations et les réunions.
 */
export function SupervisorDashboard() {
  const location = useLocation()

  const isJournalReviewRoute = Boolean(
    matchPath('/dashboard/supervisor/interns/:internId/journal', location.pathname),
  )

  if (isJournalReviewRoute) {
    return <SupervisorJournalReviewPage />
  }

  const state = useSupervisorDashboardState()

  return <SupervisorDashboardView state={state} />
}
