import { useI18n, type SupportedLocale } from '../../../locales/I18nContext'
import { IconDropdown } from '../IconDropdown'

const languageOptions: Array<{ value: SupportedLocale; labelKey: 'language.en' | 'language.fr' | 'language.ar' }> = [
  { value: 'en', labelKey: 'language.en' },
  { value: 'fr', labelKey: 'language.fr' },
  { value: 'ar', labelKey: 'language.ar' },
]

type LanguageSwitcherProps = {
  shouldClose?: boolean
}

export function LanguageSwitcher({ shouldClose = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n()
  const activeLanguage = languageOptions.find((option) => option.value === locale) ?? languageOptions[0]
  const options = languageOptions.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }))

  return (
    <IconDropdown
      ariaLabel={`${t('language.label')}: ${t(activeLanguage.labelKey)}`}
      title={`${t('language.label')}: ${t(activeLanguage.labelKey)}`}
      icon={
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18" />
          <path d="M5 7h14" />
          <path d="M5 17h14" />
        </svg>
      }
      valueText={locale.toUpperCase()}
      options={options}
      selectedValue={locale}
      onSelect={(value) => setLocale(value as SupportedLocale)}
      shouldClose={shouldClose}
    />
  )
}




