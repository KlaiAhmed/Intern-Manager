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

  const iconPathByTheme: Record<ThemeMode, string> = {
    light:
      'M12 3.8v1.9M12 18.3v1.9M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M3.8 12h1.9M18.3 12h1.9M5.4 18.6l1.4-1.4M17.2 6.8l1.4-1.4M12 16a4 4 0 1 0 0-8a4 4 0 0 0 0 8Z',
    dark: 'M15.5 3.5a7.5 7.5 0 1 0 5 13a8 8 0 1 1-5-13Z',
    system: 'M4 5h16v10H4zM9 19h6M12 15v4',
  }

  return (
    <IconDropdown
      ariaLabel={`${t('theme.label')}: ${t(`theme.${themeMode}` as 'theme.light' | 'theme.dark' | 'theme.system')}`}
      title={`${t('theme.label')}: ${t(`theme.${themeMode}` as 'theme.light' | 'theme.dark' | 'theme.system')}`}
      icon={
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d={iconPathByTheme[themeMode]} />
        </svg>
      }
      valueText={t(`theme.${themeMode}` as 'theme.light' | 'theme.dark' | 'theme.system').slice(0, 2).toUpperCase()}
      options={options}
      selectedValue={themeMode}
      onSelect={(value) => setThemeMode(value as ThemeMode)}
      shouldClose={shouldClose}
    />
  )
}
