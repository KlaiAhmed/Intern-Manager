import type { ReactNode } from 'react'
import { themeModes, type ThemeMode, useTheme } from '../theme/ThemeContext'
import { useI18n } from '../i18n/I18nContext'
import { IconDropdown } from './IconDropdown'

type ThemeSwitcherProps = {
  shouldClose?: boolean
}

export function ThemeSwitcher({ shouldClose = false }: ThemeSwitcherProps) {
  const { themeMode, setThemeMode } = useTheme()
  const { t } = useI18n()
  const options = themeModes.map((mode) => ({
    value: mode,
    label: t(`theme.${mode}` as 'theme.light' | 'theme.dark' | 'theme.system'),
  }))

  const iconPathByTheme: Record<ThemeMode, ReactNode> = {
    light: (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
    dark: (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
    system: (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  }

  return (
    <IconDropdown
      ariaLabel={`${t('theme.label')}: ${t(`theme.${themeMode}` as 'theme.light' | 'theme.dark' | 'theme.system')}`}
      title={`${t('theme.label')}: ${t(`theme.${themeMode}` as 'theme.light' | 'theme.dark' | 'theme.system')}`}
      icon={iconPathByTheme[themeMode]}
      valueText={t(`theme.${themeMode}` as 'theme.light' | 'theme.dark' | 'theme.system').slice(0, 2).toUpperCase()}
      options={options}
      selectedValue={themeMode}
      onSelect={(value) => setThemeMode(value as ThemeMode)}
      shouldClose={shouldClose}
    />
  )
}
