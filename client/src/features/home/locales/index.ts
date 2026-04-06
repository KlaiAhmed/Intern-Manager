import { homeAr } from './ar'
import { homeEn } from './en'
import { homeFr } from './fr'

export const homeLocales = {
	en: homeEn,
	fr: homeFr,
	ar: homeAr,
} as const

export { homeAr, homeEn, homeFr }
