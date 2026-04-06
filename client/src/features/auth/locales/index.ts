import { authAr } from './ar'
import { authEn } from './en'
import { authFr } from './fr'

export const authLocales = {
	en: authEn,
	fr: authFr,
	ar: authAr,
} as const

export { authAr, authEn, authFr }
