import type { TranslateFn } from '../../types/internDashboard'

export type DegreeLevel = 'licence' | 'master' | 'doctorat'
export type StudyYear = '1' | '2' | '3'

const degreeLevelOrder: DegreeLevel[] = ['licence', 'master', 'doctorat']

const degreeLevelLabelKeys: Record<DegreeLevel, string> = {
  licence: 'dashboard.intern.application.degreeLevel.licence',
  master: 'dashboard.intern.application.degreeLevel.master',
  doctorat: 'dashboard.intern.application.degreeLevel.doctorat',
}

const studyYearLabelKeys: Record<StudyYear, string> = {
  '1': 'dashboard.intern.application.studyYear.year1',
  '2': 'dashboard.intern.application.studyYear.year2',
  '3': 'dashboard.intern.application.studyYear.year3',
}

const degreeLevelYearMap: Record<DegreeLevel, StudyYear[]> = {
  licence: ['1', '2', '3'],
  master: ['1', '2'],
  doctorat: ['1', '2', '3'],
}

const degreeAliases: Record<string, DegreeLevel> = {
  licence: 'licence',
  master: 'master',
  doctorat: 'doctorat',
  doctorate: 'doctorat',
}

export const getDegreeLevelOptions = (t: TranslateFn) =>
  degreeLevelOrder.map((degreeLevel) => ({
    value: degreeLevel,
    label: t(degreeLevelLabelKeys[degreeLevel]),
  }))

export const getStudyYearOptions = (degreeLevel: DegreeLevel | null | undefined, t: TranslateFn) => {
  if (!degreeLevel) {
    return []
  }

  return degreeLevelYearMap[degreeLevel].map((year) => ({
    value: year,
    label: t(studyYearLabelKeys[year]),
  }))
}

export const getDefaultStudyYear = (degreeLevel: DegreeLevel): StudyYear => degreeLevelYearMap[degreeLevel][0]

export const isStudyYearValid = (degreeLevel: DegreeLevel, studyYear: StudyYear): boolean =>
  degreeLevelYearMap[degreeLevel].includes(studyYear)

export const buildCurrentYearOfStudy = (degreeLevel: DegreeLevel, studyYear: StudyYear): string =>
  `${degreeLevel}_${studyYear}`

export const parseCurrentYearOfStudy = (value: string | null | undefined) => {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const parts = normalized.split('_')
  if (parts.length === 1) {
    const degreeLevel = normalizeDegreeLevel(parts[0])
    if (!degreeLevel) {
      return null
    }

    return { degreeLevel, studyYear: null as StudyYear | null }
  }

  if (parts.length !== 2) {
    return null
  }

  const degreeLevel = normalizeDegreeLevel(parts[0])
  const studyYear = normalizeStudyYear(parts[1])

  if (!degreeLevel || !studyYear) {
    return null
  }

  if (!isStudyYearValid(degreeLevel, studyYear)) {
    return null
  }

  return { degreeLevel, studyYear }
}

export const getDegreeLevelLabel = (degreeLevel: DegreeLevel | null | undefined, t: TranslateFn): string | null => {
  if (!degreeLevel) {
    return null
  }

  return t(degreeLevelLabelKeys[degreeLevel])
}

export const getStudyYearLabel = (studyYear: StudyYear | null | undefined, t: TranslateFn): string | null => {
  if (!studyYear) {
    return null
  }

  return t(studyYearLabelKeys[studyYear])
}

export const formatCurrentYearOfStudy = (value: string | null | undefined, t: TranslateFn): string | null => {
  const parsed = parseCurrentYearOfStudy(value)
  if (!parsed) {
    return value?.trim() ?? null
  }

  const degreeLabel = getDegreeLevelLabel(parsed.degreeLevel, t)
  const yearLabel = getStudyYearLabel(parsed.studyYear, t)

  if (degreeLabel && yearLabel) {
    return `${degreeLabel} - ${yearLabel}`
  }

  return degreeLabel ?? value?.trim() ?? null
}

const normalizeDegreeLevel = (value: string | null | undefined): DegreeLevel | null => {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return degreeAliases[normalized] ?? null
}

const normalizeStudyYear = (value: string | null | undefined): StudyYear | null => {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  if (normalized === '1' || normalized === '2' || normalized === '3') {
    return normalized
  }

  return null
}
