import { dashboardAr } from './ar'
import { dashboardEn } from './en'
import { dashboardFr } from './fr'

export const dashboardLocales = {
	en: dashboardEn,
	fr: dashboardFr,
	ar: dashboardAr,
} as const

export { dashboardAr, dashboardEn, dashboardFr }
