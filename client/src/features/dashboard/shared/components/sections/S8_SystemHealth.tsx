import { format } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useI18n } from '@/locales/I18nContext'
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { BiSectionData, BiSystemHealthResponse } from '../../types/biDashboard'
import { formatMonthLabel, formatNumberTooltip, formatNumberValue } from '../../utils/chartFormatters'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiSystemHealthResponse>; }

function formatDateLabel(value: unknown, pattern: string) {
  const rawValue = String(value)
  const date = new Date(rawValue)

  if (Number.isNaN(date.getTime())) {
    return rawValue
  }

  return format(date, pattern)
}

function normalizeRoleName(role: string | null | undefined): string {
  if (role == null || typeof role !== 'string') {
    console.warn('[S8_SystemHealth] normalizeRoleName received unexpected value:', role)
    return 'unknown'
  }
  return role.trim().toLowerCase()
}

export function S8_SystemHealth({ data }: Props) {
  const { t } = useI18n()

  if (data.loading) {
    return (
      <div className={`${styles.sectionGrid} ${styles.grid3}`} aria-busy="true">
        <Skeleton height="280px" />
        <Skeleton height="280px" />
        <Skeleton height="280px" />
      </div>
    )
  }

  if (data.error) {
    return <ErrorState message={data.error} onRetry={data.refetch} />
  }

  if (!data.data) {
    return <div className={styles.emptyState}>{t('dashboard.bi.system.noData')}</div>
  }

  const userGrowth = data.data.userGrowthByMonth
  const auditLog = data.data.auditLogByDay
  const auditAverage = auditLog.length > 0
    ? auditLog.reduce((sum, entry) => sum + entry.count, 0) / auditLog.length
    : null
  const safeAuditActions = data.data.auditByAction ?? [];
  const safeRoles = data.data.usersByRole ?? [];
  const roleLabels: Record<string, string> = {
    admin: t('dashboard.bi.system.roleAdmins'),
    intern: t('dashboard.bi.system.roleInterns'),
    superadmin: t('dashboard.bi.system.roleSuperAdmins'),
    supervisor: t('dashboard.bi.system.roleSupervisors'),
  }

  return (
    <div className={`${styles.sectionGrid} ${styles.grid3}`} aria-busy={data.loading}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.system.growthTitle')}</h3>
        </div>

        {userGrowth.length > 0 ? (
          <div className={styles.chartFrame}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={userGrowth} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={formatMonthLabel} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={formatNumberTooltip} labelFormatter={formatMonthLabel} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="interns"
                  name={t('dashboard.bi.system.roleInterns')}
                  stackId="a"
                  stroke="#378ADD"
                  fill="#378ADD"
                  fillOpacity={0.72}
                />
                <Area
                  type="monotone"
                  dataKey="supervisors"
                  name={t('dashboard.bi.system.roleSupervisors')}
                  stackId="a"
                  stroke="#1D9E75"
                  fill="#1D9E75"
                  fillOpacity={0.72}
                />
                <Area
                  type="monotone"
                  dataKey="admins"
                  name={t('dashboard.bi.system.roleAdmins')}
                  stackId="a"
                  stroke="#7F77DD"
                  fill="#7F77DD"
                  fillOpacity={0.72}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>{t('dashboard.bi.system.noGrowth')}</div>
        )}
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.system.auditTitle')}</h3>
        </div>

        {auditLog.length > 0 ? (
          <div className={styles.chartFrame}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={auditLog} margin={{ top: 12, right: 24, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDateLabel(value, 'MMM d')}
                  interval={4}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={formatNumberTooltip} labelFormatter={(value) => formatDateLabel(value, 'PPP')} />
                {auditAverage !== null && (
                  <ReferenceLine
                    y={auditAverage}
                    stroke="#D4537E"
                    strokeDasharray="3 3"
                    label={{ value: t('dashboard.bi.system.avg'), position: 'right', fontSize: 11 }}
                  />
                )}
                <Line dataKey="count" stroke="#7F77DD" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>{t('dashboard.bi.system.noAudit')}</div>
        )}
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.system.topActions')}</h3>
        </div>

        {safeAuditActions.length > 0 ? (
          <div className={styles.chartFrame}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={safeAuditActions}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={formatNumberTooltip} />
                <Bar dataKey="value" fill="#7F77DD" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>{t('dashboard.bi.system.noActions')}</div>
        )}

        <div className={`${styles.statBox} ${styles.activeSessionsBox}`}>
          <span className={styles.statLabel}>{t('dashboard.bi.system.activeSessions')}</span>
          <strong className={styles.statValue}>{formatNumberValue(data.data.activeSessionsCount)}</strong>
          <span className={styles.statSubtitle}>{t('dashboard.bi.system.sessionsSub')}</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>{t('dashboard.bi.system.totalUsers')}</span>
          <strong className={styles.statValue}>{formatNumberValue(data.data.totalUsers)}</strong>
        </div>
        {safeRoles.length > 0 && (
          <div className={styles.statusCounts}>
            {safeRoles.map((role) => (
              <span className={`${styles.statusPill} ${styles.statusPillBlue}`} key={role.name}>
                {roleLabels[normalizeRoleName(role.name)] ?? role.name}: {formatNumberValue(role.value)}
              </span>
            ))}
          </div>
        )}
      </article>
    </div>
  )
}
