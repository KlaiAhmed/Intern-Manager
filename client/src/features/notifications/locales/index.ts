import { notificationsAr } from './ar'
import { notificationsEn } from './en'
import { notificationsFr } from './fr'

export const notificationsLocales = {
	en: notificationsEn,
	fr: notificationsFr,
	ar: notificationsAr,
} as const

export { notificationsAr, notificationsEn, notificationsFr }
