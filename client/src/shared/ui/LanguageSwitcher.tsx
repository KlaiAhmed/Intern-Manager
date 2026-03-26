import { useI18n, type SupportedLocale } from '../i18n/I18nContext'
import { IconDropdown } from './IconDropdown'

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
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Zm0 0c2.4 0 4.3 4 4.3 9s-1.9 9-4.3 9s-4.3-4-4.3-9s1.9-9 4.3-9ZM3 12h18M4.8 7.5h14.4M4.8 16.5h14.4" />
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
