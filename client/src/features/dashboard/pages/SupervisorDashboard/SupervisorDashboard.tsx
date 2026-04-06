import { SupervisorDashboardView } from './SupervisorDashboardView'
import { useSupervisorDashboardState } from './useSupervisorDashboardState'

/**
 * Tableau de bord pour le rôle supervisor.
 * Gère les missions, les livrables, les évaluations et les réunions.
 */
export function SupervisorDashboard() {
  const state = useSupervisorDashboardState()

  return <SupervisorDashboardView state={state} />
}
