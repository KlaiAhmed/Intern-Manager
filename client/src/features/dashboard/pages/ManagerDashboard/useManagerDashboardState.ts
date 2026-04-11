import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import { toErrorMessage } from '../../shared/utils/errorMessage'
import type {
  Activity,
  AuditLogRecord,
  Department,
  DepartmentRecord,
  Intern,
  InternDirectoryRecord,
  InternshipRecord,
  ManagerNavItem,
  ManagerTabId,
  PagedResponse,
  Supervisor,
  UserRecord,
} from './types'
import {
  asNonEmptyString,
  computeCompletionPercentage,
  estimateProgress,
  formatActivityDate,
  getActivityIcon,
  getInitials,
  inferActivityType,
  normalizeInternStatus,
  readNumericValue,
  resolveUserName,
} from './utils'

function normalizeFilterValue(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase()
  return normalized && normalized.length > 0 ? normalized : 'unknown'
}

export function useManagerDashboardState() {
  const { t } = useI18n()
  const api = useDashboardApi()

  const [loadingKPIs, setLoadingKPIs] = useState(true)
  const [loadingInterns, setLoadingInterns] = useState(true)
  const [loadingSupervisors, setLoadingSupervisors] = useState(true)
  const [loadingDepartments, setLoadingDepartments] = useState(true)
  const [loadingActivity, setLoadingActivity] = useState(true)

  const [kpisError, setKpisError] = useState<string | null>(null)
  const [internsError, setInternsError] = useState<string | null>(null)
  const [supervisorsError, setSupervisorsError] = useState<string | null>(null)
  const [departmentsError, setDepartmentsError] = useState<string | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)

  const [internsCount, setInternsCount] = useState(0)
  const [activeMissionsCount, setActiveMissionsCount] = useState(0)
  const [avgCompletion, setAvgCompletion] = useState(0)
  const [pendingReviews, setPendingReviews] = useState(0)
  const [interns, setInterns] = useState<Intern[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [activities, setActivities] = useState<Activity[]>([])

  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [selectedVerificationStatus, setSelectedVerificationStatus] = useState<string>('all')
  const [internsSearch, setInternsSearch] = useState('')
  const [activeTab, setActiveTab] = useState<ManagerTabId>('overview')

  const [selectedIntern, setSelectedIntern] = useState<Intern | null>(null)
  const [isInternModalOpen, setIsInternModalOpen] = useState(false)

  const loadKPIs = async () => {
    setLoadingKPIs(true)
    setKpisError(null)

    try {
      const [internsCountPayload, missionsPayload, pendingPayload, internshipsPayload] = await Promise.all([
        api.get<{ count?: number } | number>('/api/stats/interns/count'),
        api.get<{ count?: number } | number>('/api/stats/missions'),
        api.get<{ count?: number } | number>('/api/stats/deliverables/pending'),
        api.get<PagedResponse<InternshipRecord>>('/api/internships?page=1&limit=200'),
      ])

      const internshipsData = internshipsPayload.data ?? []
      const completionPercent = computeCompletionPercentage(internshipsData)

      setInternsCount(readNumericValue(internsCountPayload))
      setActiveMissionsCount(readNumericValue(missionsPayload))
      setAvgCompletion(completionPercent)
      setPendingReviews(readNumericValue(pendingPayload))
    } catch (error) {
      setKpisError(toErrorMessage(error, t('dashboard.error.load') || 'Failed to load'))
    } finally {
      setLoadingKPIs(false)
    }
  }

  const loadInterns = async () => {
    setLoadingInterns(true)
    setInternsError(null)

    try {
      const [internUsersPayload, internshipsPayload, internDirectoryPayload] = await Promise.all([
        api.get<PagedResponse<UserRecord>>('/api/users?role=intern&page=1&limit=100'),
        api.get<PagedResponse<InternshipRecord>>('/api/internships?page=1&limit=200'),
        api.get<PagedResponse<InternDirectoryRecord>>('/api/interns?limit=500'),
      ])

      const internshipsByInternId = new Map<string, InternshipRecord>()
      for (const internship of internshipsPayload.data ?? []) {
        const internId = asNonEmptyString(internship.internId)
        if (internId) internshipsByInternId.set(internId, internship)
      }

      const internDirectoryById = new Map<string, InternDirectoryRecord>()
      for (const internDirectoryEntry of internDirectoryPayload.data ?? []) {
        const internId = asNonEmptyString(internDirectoryEntry.id)
        if (internId) internDirectoryById.set(internId, internDirectoryEntry)
      }

      const mappedInterns: Intern[] = (internUsersPayload.data ?? [])
        .map((user): Intern | null => {
          const userId = asNonEmptyString(user.id)
          if (!userId) return null

          const internship = internshipsByInternId.get(userId)
          const internDirectoryEntry = internDirectoryById.get(userId)

          const accountStatusSource = asNonEmptyString(user.status) || asNonEmptyString(internDirectoryEntry?.status)
          const verificationStatusSource = asNonEmptyString(user.verificationStatus)
            || asNonEmptyString(internDirectoryEntry?.verificationStatus)
          const statusSource = asNonEmptyString(internship?.status) || accountStatusSource

          return {
            id: userId,
            name: resolveUserName(user),
            email: asNonEmptyString(user.email),
            department: asNonEmptyString(user.department) || asNonEmptyString(internship?.department) || undefined,
            missionTitle: asNonEmptyString(internship?.missionTitle) || undefined,
            supervisorName: asNonEmptyString(internship?.supervisorName) || undefined,
            startDate: asNonEmptyString(internship?.startDate)
              || asNonEmptyString(internDirectoryEntry?.startDate)
              || undefined,
            endDate: asNonEmptyString(internship?.endDate)
              || asNonEmptyString(internDirectoryEntry?.endDate)
              || undefined,
            progress: estimateProgress(internship?.startDate, internship?.endDate, statusSource),
            status: normalizeInternStatus(statusSource),
            accountStatus: accountStatusSource || 'Unknown',
            verificationStatus: verificationStatusSource || 'Unknown',
            cvFileUrl: asNonEmptyString(internDirectoryEntry?.cvFileUrl) || null,
            internshipId: asNonEmptyString(internship?.id) || undefined,
            internshipType: asNonEmptyString(internship?.type) || undefined,
          }
        })
        .filter((intern): intern is Intern => intern !== null)

      setInterns(mappedInterns)
    } catch (error) {
      setInternsError(toErrorMessage(error, t('dashboard.error.load') || 'Failed to load'))
    } finally {
      setLoadingInterns(false)
    }
  }

  const loadSupervisors = async () => {
    setLoadingSupervisors(true)
    setSupervisorsError(null)

    try {
      const [supervisorUsersPayload, internshipsPayload] = await Promise.all([
        api.get<PagedResponse<UserRecord>>('/api/users?role=supervisor&page=1&limit=100'),
        api.get<PagedResponse<InternshipRecord>>('/api/internships?page=1&limit=200'),
      ])

      const activeInternsBySupervisorId = new Map<string, number>()
      for (const internship of internshipsPayload.data ?? []) {
        const supervisorId = asNonEmptyString(internship.supervisorId)
        const internshipStatus = normalizeInternStatus(asNonEmptyString(internship.status))
        if (!supervisorId || internshipStatus === 'completed') continue
        activeInternsBySupervisorId.set(supervisorId, (activeInternsBySupervisorId.get(supervisorId) ?? 0) + 1)
      }

      const mappedSupervisors: Supervisor[] = (supervisorUsersPayload.data ?? [])
        .map((user): Supervisor | null => {
          const userId = asNonEmptyString(user.id)
          if (!userId) return null

          return {
            id: userId,
            name: resolveUserName(user),
            email: asNonEmptyString(user.email),
            department: asNonEmptyString(user.department) || undefined,
            activeInternsCount: activeInternsBySupervisorId.get(userId) ?? 0,
          }
        })
        .filter((supervisor): supervisor is Supervisor => supervisor !== null)

      setSupervisors(mappedSupervisors)
    } catch (error) {
      setSupervisorsError(toErrorMessage(error, t('dashboard.error.load') || 'Failed to load'))
    } finally {
      setLoadingSupervisors(false)
    }
  }

  const loadDepartments = async () => {
    setLoadingDepartments(true)
    setDepartmentsError(null)

    try {
      const [departmentPayload, internUsersPayload, supervisorUsersPayload, internshipsPayload] = await Promise.all([
        api.get<PagedResponse<DepartmentRecord>>('/api/admin/settings/departments'),
        api.get<PagedResponse<UserRecord>>('/api/users?role=intern&page=1&limit=200'),
        api.get<PagedResponse<UserRecord>>('/api/users?role=supervisor&page=1&limit=200'),
        api.get<PagedResponse<InternshipRecord>>('/api/internships?page=1&limit=200'),
      ])

      const progressByDepartment = new Map<string, number[]>()
      for (const internship of internshipsPayload.data ?? []) {
        const departmentName = asNonEmptyString(internship.department)
        if (!departmentName) continue

        const progress = estimateProgress(internship.startDate, internship.endDate, internship.status)
        const current = progressByDepartment.get(departmentName) ?? []
        current.push(progress)
        progressByDepartment.set(departmentName, current)
      }

      const mappedDepartments: Department[] = (departmentPayload.data ?? [])
        .map((department): Department | null => {
          const name = asNonEmptyString(department.name)
          const id = asNonEmptyString(department.id)
          if (!name || !id) return null

          const internCount = (internUsersPayload.data ?? []).filter((user) => asNonEmptyString(user.department) === name).length
          const supervisorCount = (supervisorUsersPayload.data ?? []).filter((user) => asNonEmptyString(user.department) === name).length
          const progressValues = progressByDepartment.get(name) ?? []
          const avgProgress = progressValues.length > 0
            ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
            : 0

          return { id, name, internCount, supervisorCount, avgProgress }
        })
        .filter((department): department is Department => department !== null)

      setDepartments(mappedDepartments)
    } catch (error) {
      setDepartmentsError(toErrorMessage(error, t('dashboard.error.load') || 'Failed to load'))
    } finally {
      setLoadingDepartments(false)
    }
  }

  const loadActivity = async () => {
    setLoadingActivity(true)
    setActivityError(null)

    try {
      const activityPayload = await api.get<PagedResponse<AuditLogRecord>>('/api/admin/audit-logs?limit=10')

      const mappedActivities: Activity[] = (activityPayload.data ?? [])
        .map((log, index): Activity | null => {
          const action = asNonEmptyString(log.action) || asNonEmptyString(log.description)
          if (!action) return null

          const timestamp = asNonEmptyString(log.timestamp) || asNonEmptyString(log.createdAt)

          return {
            id: asNonEmptyString(log.id) || `${timestamp || 'activity'}-${index}`,
            type: inferActivityType(action),
            actor: asNonEmptyString(log.actor) || 'System',
            description: action,
            timestamp: timestamp || new Date().toISOString(),
          }
        })
        .filter((activity): activity is Activity => activity !== null)

      setActivities(mappedActivities)
    } catch (error) {
      setActivityError(toErrorMessage(error, t('dashboard.error.load') || 'Failed to load'))
    } finally {
      setLoadingActivity(false)
    }
  }

  useEffect(() => {
    void loadKPIs()
    void loadInterns()
    void loadSupervisors()
    void loadDepartments()
    void loadActivity()
  }, [])

  const refreshAll = () => {
    void loadKPIs()
    void loadInterns()
    void loadSupervisors()
    void loadDepartments()
    void loadActivity()
  }

  const filteredInterns = useMemo(() => {
    return interns.filter((intern) => {
      const matchesDepartment = selectedDepartment === 'all' || intern.department === selectedDepartment
      const matchesVerificationStatus = selectedVerificationStatus === 'all'
        || normalizeFilterValue(intern.verificationStatus) === selectedVerificationStatus
      const matchesSearch = intern.name.toLowerCase().includes(internsSearch.toLowerCase())
        || intern.email.toLowerCase().includes(internsSearch.toLowerCase())

      return matchesDepartment && matchesVerificationStatus && matchesSearch
    })
  }, [interns, selectedDepartment, selectedVerificationStatus, internsSearch])

  const departmentOptions = useMemo(() => {
    return ['all', ...departments.map((department) => department.name)]
  }, [departments])

  const verificationStatusOptions = useMemo(() => {
    const values = new Set(
      interns.map((intern) => normalizeFilterValue(intern.verificationStatus)),
    )

    return ['all', ...Array.from(values)]
  }, [interns])

  const navItems: ManagerNavItem[] = [
    { id: 'overview', label: 'Overview', icon: 'overview' },
    { id: 'interns', label: 'Interns', icon: 'interns', badge: interns.length },
    { id: 'supervisors', label: 'Supervisors', icon: 'supervisors', badge: supervisors.length },
    { id: 'departments', label: 'Departments', icon: 'departments', badge: departments.length },
  ]

  const openInternModal = (intern: Intern) => {
    setSelectedIntern(intern)
    setIsInternModalOpen(true)
  }

  const closeInternModal = () => {
    setIsInternModalOpen(false)
    setSelectedIntern(null)
  }

  return {
    loadingKPIs,
    loadingInterns,
    loadingSupervisors,
    loadingDepartments,
    loadingActivity,
    kpisError,
    internsError,
    supervisorsError,
    departmentsError,
    activityError,
    internsCount,
    activeMissionsCount,
    avgCompletion,
    pendingReviews,
    interns,
    supervisors,
    departments,
    activities,
    selectedDepartment,
    setSelectedDepartment,
    selectedVerificationStatus,
    setSelectedVerificationStatus,
    internsSearch,
    setInternsSearch,
    activeTab,
    setActiveTab,
    selectedIntern,
    isInternModalOpen,
    navItems,
    filteredInterns,
    departmentOptions,
    verificationStatusOptions,
    openInternModal,
    closeInternModal,
    refreshAll,
    loadKPIs,
    loadInterns,
    loadSupervisors,
    loadDepartments,
    loadActivity,
    formatActivityDate,
    getActivityIcon,
    getInitials,
  }
}
