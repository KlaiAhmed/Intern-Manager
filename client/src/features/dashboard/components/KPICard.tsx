interface KPICardProps {
  title: string
  value: string | number
  variant?: 'default' | 'warning' | 'success'
}

/**
 * Carte KPI affichant une métrique clé avec titre et valeur.
 */
export function KPICard({ title, value, variant = 'default' }: KPICardProps) {
  return (
    <div className={`kpi-card kpi-card-${variant}`}>
      <p className="kpi-title">{title}</p>
      <p className="kpi-value">{value}</p>
    </div>
  )
}
