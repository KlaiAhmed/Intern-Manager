import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext'
import { LanguageSwitcher } from '../ui/LanguageSwitcher'
import { ThemeSwitcher } from '../ui/ThemeSwitcher'
import { Button } from '../ui/Button'
import { classNames } from '../utils/classNames'

const navigationItems = [
  { id: 'benefits', labelKey: 'nav.product' },
  { id: 'lifecycle', labelKey: 'nav.lifecycle' },
  { id: 'roles', labelKey: 'nav.roles' },
  { id: 'trust', labelKey: 'nav.security' },
] as const

export function Header() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false)
  const lastScrollTopRef = useRef(0)
  const frameRef = useRef<number | null>(null)

  const closeMenu = (): void => setIsMobileMenuOpen(false)

  useEffect(() => {
    const initialScrollTop = window.scrollY
    lastScrollTopRef.current = initialScrollTop
    setIsHeaderScrolled(initialScrollTop >= 12)

    const updateHeaderState = (): void => {
      const currentScrollTop = window.scrollY
      const scrollDelta = currentScrollTop - lastScrollTopRef.current
      const isNearTop = currentScrollTop < 12

      setIsHeaderScrolled(!isNearTop)

      if (isNearTop || scrollDelta < -4) {
        setIsHeaderVisible(true)
      } else if (scrollDelta > 6 && currentScrollTop > 88) {
        setIsHeaderVisible(false)
      }

      lastScrollTopRef.current = currentScrollTop
      frameRef.current = null
    }

    const onScroll = (): void => {
      if (frameRef.current !== null) {
        return
      }

      frameRef.current = window.requestAnimationFrame(updateHeaderState)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!isHeaderVisible) {
      setIsMobileMenuOpen(false)
    }
  }, [isHeaderVisible])

  return (
    <header
      className={classNames(
        'site-header',
        isHeaderScrolled && 'is-scrolled',
        !isHeaderVisible && 'is-hidden',
      )}
    >
      <div className="container header-content">
        <a className="brand" href="/" aria-label="Axia Intern Manager">
          <span className="brand-mark" aria-hidden="true">
            SA
          </span>
          <span className="brand-text">Axia Intern Manager</span>
        </a>

        <button
          type="button"
          className="mobile-menu-button"
          onClick={() => setIsMobileMenuOpen((prevState) => !prevState)}
          aria-expanded={isMobileMenuOpen}
          aria-controls="main-navigation"
          aria-label={t('nav.mobileMenu')}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <div className={classNames('header-panels', isMobileMenuOpen && 'is-open')}>
          <nav id="main-navigation" aria-label="Main navigation">
            <ul className="main-nav-list">
              {navigationItems.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} onClick={closeMenu}>
                    {t(item.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="header-controls">
            <LanguageSwitcher shouldClose={!isHeaderVisible} />
            <ThemeSwitcher shouldClose={!isHeaderVisible} />
            <Button className="header-signin" size="sm" onClick={() => navigate('/login')}>
              {t('nav.login')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
