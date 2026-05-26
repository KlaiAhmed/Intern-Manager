import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useI18n } from '@/locales/I18nContext'
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { BiDemographicsResponse, BiSectionData, ChartDataPoint } from '../../types/biDashboard'
import { formatNumberTooltip } from '../../utils/chartFormatters'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiDemographicsResponse>; }

const COLORS = ['#378ADD', '#1D9E75', '#7F77DD', '#D4537E', '#BA7517', '#639922', '#E05050', '#36B0C9']
const MAX_MAJOR_SEGMENTS = 8
const skeletonItems = Array.from({ length: 4 }, (_, index) => index)

function groupSmallMajorSegments(items: ChartDataPoint[], otherLabel: string) {
  if (items.length <= MAX_MAJOR_SEGMENTS) {
    return items
  }

  const sortedItems = [...items].sort((a, b) => b.value - a.value)
  const visibleItems = sortedItems.slice(0, MAX_MAJOR_SEGMENTS - 1)
  const otherValue = sortedItems
    .slice(MAX_MAJOR_SEGMENTS - 1)
    .reduce((total, item) => total + item.value, 0)

  return [...visibleItems, { name: otherLabel, value: otherValue }]
}

export function S5_Demographics({ data }: Props) {
  const { t } = useI18n()

  if (data.loading) {
    return (
      <div className={`${styles.sectionGrid} ${styles.grid2}`} aria-busy="true">
        {skeletonItems.map((item) => (
          <Skeleton key={item} height="280px" />
        ))}
      </div>
    )
  }

  if (data.error) {
    return <ErrorState message={data.error} onRetry={data.refetch} />
  }

  if (!data.data) {
    return null
  }

  if (data.data.byMajor.length === 0) {
    return (
      <article className={styles.chartPanel}>
        <div className={`${styles.emptyState} ${styles.chartEmptyState}`}>No profile data available</div>
      </article>
    )
  }

  const byMajor = groupSmallMajorSegments(data.data.byMajor, t('dashboard.bi.demographics.other'))

  return (
    <div className={`${styles.sectionGrid} ${styles.grid2}`}>
      <article className={styles.chartPanel}>
        <h3 className={styles.panelTitle}>{t('dashboard.bi.demographics.byUniversity')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart layout="vertical" data={data.data.byUniversity}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <YAxis type="category" dataKey="name" width={150} />
            <XAxis type="number" allowDecimals={false} />
            <Tooltip formatter={formatNumberTooltip} />
            <Bar dataKey="value" fill="#7F77DD" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </article>

      <article className={styles.chartPanel}>
        <h3 className={styles.panelTitle}>{t('dashboard.bi.demographics.byDepartment')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart layout="vertical" data={data.data.byDepartment}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <YAxis type="category" dataKey="name" width={150} />
            <XAxis type="number" allowDecimals={false} />
            <Tooltip formatter={formatNumberTooltip} />
            <Bar dataKey="value" fill="#1D9E75" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </article>

      <article className={styles.chartPanel}>
        <h3 className={styles.panelTitle}>{t('dashboard.bi.demographics.byMajor')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={byMajor}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={110}
            >
              {byMajor.map((item, index) => (
                <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={formatNumberTooltip} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </article>

      <article className={styles.chartPanel}>
        <h3 className={styles.panelTitle}>{t('dashboard.bi.demographics.byYearOfStudy')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.data.byYearOfStudy}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={formatNumberTooltip} />
            <Bar dataKey="value" fill="#D4537E" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </article>
    </div>
  )
}
