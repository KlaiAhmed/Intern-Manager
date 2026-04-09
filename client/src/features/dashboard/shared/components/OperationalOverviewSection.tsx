import { AdminOverviewContent } from './AdminOverviewContent'
import styles from './OperationalOverviewSection.module.css'

export function OperationalOverviewSection() {
  return (
    <section className={`${styles.root} overview-section admin-view-section`} id="section-overview">
      <AdminOverviewContent />
    </section>
  )
}
