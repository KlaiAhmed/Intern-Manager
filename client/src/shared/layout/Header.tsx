import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiRequestError } from "../api/authApi";
import { useI18n, type SupportedLocale } from "../i18n/I18nContext";
import { useAuth } from "../state/AuthContext";
import { themeModes, useTheme } from "../theme/ThemeContext";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";
import { ThemeSwitcher } from "../ui/ThemeSwitcher";
import { Button } from "../ui/Button";
import { classNames } from "../utils/classNames";

const anchorNavItems = [
  { id: "benefits", labelKey: "nav.product" },
  { id: "lifecycle", labelKey: "nav.lifecycle" },
  { id: "roles", labelKey: "nav.roles" },
  { id: "trust", labelKey: "nav.security" },
] as const;

const languageOptions: Array<{
  value: SupportedLocale;
  labelKey: "language.en" | "language.fr" | "language.ar";
}> = [
  { value: "en", labelKey: "language.en" },
  { value: "fr", labelKey: "language.fr" },
  { value: "ar", labelKey: "language.ar" },
];

type MobileSubmenu = "theme" | "language" | null;

export function Header() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, logout } = useAuth();
  const isHomePage = location.pathname === "/";
  const { themeMode, setThemeMode } = useTheme();
  const { locale, setLocale } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [mobileSubmenu, setMobileSubmenu] = useState<MobileSubmenu>(null);
  const lastScrollTopRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const toggleMobileSubmenu = (submenu: MobileSubmenu): void => {
    setMobileSubmenu((current) => (current === submenu ? null : submenu));
  };

  const closeMenu = (): void => {
    setIsMobileMenuOpen(false);
    setMobileSubmenu(null);
  };

  useEffect(() => {
    const initialScrollTop = window.scrollY;
    lastScrollTopRef.current = initialScrollTop;
    setIsHeaderScrolled(initialScrollTop >= 12);

    const updateHeaderState = (): void => {
      const currentScrollTop = window.scrollY;
      const scrollDelta = currentScrollTop - lastScrollTopRef.current;
      const isNearTop = currentScrollTop < 12;

      setIsHeaderScrolled(!isNearTop);

      if (isNearTop || scrollDelta < -4) {
        setIsHeaderVisible(true);
      } else if (scrollDelta > 6 && currentScrollTop > 88) {
        setIsHeaderVisible(false);
      }

      lastScrollTopRef.current = currentScrollTop;
      frameRef.current = null;
    };

    const onScroll = (): void => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(updateHeaderState);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isHeaderVisible) {
      setIsMobileMenuOpen(false);
      setIsUserMenuOpen(false);
    }
  }, [isHeaderVisible]);

  useEffect(() => {
    if (!isLoggedIn) {
      setIsUserMenuOpen(false);
      setLogoutError(null);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent): void => {
      if (!userMenuRef.current) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  const handleLogout = async (): Promise<void> => {
    setLogoutError(null);

    try {
      await logout();
      setIsUserMenuOpen(false);
      closeMenu();
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setLogoutError(error.message || t("auth.error.logoutFailed"));
      } else if (error instanceof TypeError) {
        setLogoutError(t("auth.error.network"));
      } else {
        setLogoutError(t("auth.error.logoutFailed"));
      }
    }
  };

  const userDisplayName = user?.name.trim()
    ? user.name
    : user?.email || t("auth.user.unknownName");
  const userDisplayEmail = user?.email.trim()
    ? user.email
    : t("auth.user.unknownEmail");

  return (
    <header
      className={classNames(
        "site-header",
        isHeaderScrolled && "is-scrolled",
        !isHeaderVisible && "is-hidden",
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
          aria-label={t("nav.mobileMenu")}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <div
          className={classNames("header-panels", isMobileMenuOpen && "is-open")}
        >
          <nav id="main-navigation" aria-label="Main navigation">
            {/* Desktop navigation - anchor links only on homepage */}
            <ul className="main-nav-list desktop-nav">
              {isHomePage
                ? anchorNavItems.map((item) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} onClick={closeMenu}>
                        {t(item.labelKey)}
                      </a>
                    </li>
                  ))
                : isLoggedIn && (
                    <li>
                      <Link to="/dashboard" onClick={closeMenu}>
                        {t("nav.dashboard")}
                      </Link>
                    </li>
                  )}
            </ul>

            {/* Mobile menu items - shown only when hamburger menu is open */}
            {isMobileMenuOpen && (
              <ul className="mobile-menu-list">
                {/* Navigation items first (when on homepage) */}
                {isHomePage &&
                  anchorNavItems.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        onClick={closeMenu}
                        className="mobile-menu-nav-item"
                      >
                        {t(item.labelKey)}
                      </a>
                    </li>
                  ))}

                {/* Dashboard link when logged in AND on home page */}
                {isLoggedIn && isHomePage && (
                  <li>
                    <button
                      type="button"
                      className="mobile-menu-dashboard"
                      onClick={() => {
                        closeMenu();
                        navigate("/dashboard");
                      }}
                    >
                      {t("nav.dashboard")}
                    </button>
                  </li>
                )}

                {/* Theme submenu */}
                <li>
                  <button
                    type="button"
                    className={classNames(
                      "mobile-submenu-trigger",
                      mobileSubmenu === "theme" && "is-open",
                    )}
                    onClick={() => toggleMobileSubmenu("theme")}
                    aria-expanded={mobileSubmenu === "theme"}
                  >
                    <span className="mobile-submenu-label">
                      {t("theme.label")}
                    </span>
                    <span className="mobile-submenu-chevron" aria-hidden="true">
                      {mobileSubmenu === "theme" ? "▾" : "▸"}
                    </span>
                  </button>
                  {mobileSubmenu === "theme" && (
                    <ul className="mobile-submenu-items">
                      {themeModes.map((mode) => (
                        <li key={mode}>
                          <button
                            type="button"
                            className={classNames(
                              "mobile-submenu-option",
                              themeMode === mode && "is-active",
                            )}
                            onClick={() => {
                              setThemeMode(mode);
                            }}
                          >
                            {t(
                              `theme.${mode}` as
                                | "theme.light"
                                | "theme.dark"
                                | "theme.system",
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>

                {/* Language submenu */}
                <li>
                  <button
                    type="button"
                    className={classNames(
                      "mobile-submenu-trigger",
                      mobileSubmenu === "language" && "is-open",
                    )}
                    onClick={() => toggleMobileSubmenu("language")}
                    aria-expanded={mobileSubmenu === "language"}
                  >
                    <span className="mobile-submenu-label">
                      {t("language.label")}
                    </span>
                    <span className="mobile-submenu-chevron" aria-hidden="true">
                      {mobileSubmenu === "language" ? "▾" : "▸"}
                    </span>
                  </button>
                  {mobileSubmenu === "language" && (
                    <ul className="mobile-submenu-items">
                      {languageOptions.map((option) => (
                        <li key={option.value}>
                          <button
                            type="button"
                            className={classNames(
                              "mobile-submenu-option",
                              locale === option.value && "is-active",
                            )}
                            onClick={() => {
                              setLocale(option.value);
                            }}
                          >
                            {t(option.labelKey)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>

                {/* Logout button - styled red */}
                {isLoggedIn && (
                  <>
                    <li className="mobile-menu-divider" />
                    <li>
                      <button
                        type="button"
                        className="mobile-menu-logout"
                        onClick={() => void handleLogout()}
                      >
                        {t("auth.nav.logout")}
                      </button>
                    </li>
                    {logoutError && (
                      <li>
                        <p className="mobile-menu-error" role="alert">
                          {logoutError}
                        </p>
                      </li>
                    )}
                  </>
                )}
              </ul>
            )}
          </nav>

          <div className="header-controls">
            {!isMobileMenuOpen && (
              <>
                <LanguageSwitcher shouldClose={!isHeaderVisible} />
                <ThemeSwitcher shouldClose={!isHeaderVisible} />
              </>
            )}
            {!isLoggedIn ? (
              <>
                <Button
                  className="header-auth-button header-login"
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate("/login")}
                >
                  {t("nav.login")}
                </Button>
                <Button
                  className="header-auth-button header-signup"
                  size="sm"
                  variant="primary"
                  onClick={() => navigate("/signup")}
                >
                  {t("nav.signup")}
                </Button>
              </>
            ) : (
              // Show user icon only when mobile menu is closed
              !isMobileMenuOpen && (
                <div
                  ref={userMenuRef}
                  className={classNames(
                    "icon-control-dropdown",
                    "user-menu-dropdown",
                    isUserMenuOpen && "is-open",
                  )}
                >
                  <button
                    type="button"
                    className={classNames("icon-control", "user-menu-trigger")}
                    onClick={() => {
                      setLogoutError(null);
                      setIsUserMenuOpen((prevState) => !prevState);
                    }}
                    aria-label={t("auth.nav.userMenu")}
                    title={t("auth.nav.userMenu")}
                    aria-haspopup="menu"
                    aria-expanded={isUserMenuOpen}
                  >
                    <span className="icon-control-mark" aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        focusable="false"
                        aria-hidden="true"
                      >
                        <path d="M12 12a4 4 0 1 0-4-4a4 4 0 0 0 4 4Zm0 2c-4.1 0-7.4 2.2-7.4 4.9V21h14.8v-2.1c0-2.7-3.3-4.9-7.4-4.9Z" />
                      </svg>
                    </span>
                  </button>

                  {isUserMenuOpen ? (
                    <div
                      className="icon-control-menu user-menu-panel"
                      role="menu"
                      aria-label={t("auth.nav.userMenu")}
                    >
                      <div className="user-menu-profile" role="presentation">
                        <p className="user-menu-title">
                          {t("auth.nav.profile")}
                        </p>
                        <p className="user-menu-name">{userDisplayName}</p>
                        <p className="user-menu-email">{userDisplayEmail}</p>
                      </div>

                      <div className="user-menu-divider" role="presentation" />

                      <button
                        type="button"
                        className="icon-control-option"
                        role="menuitem"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate("/dashboard");
                        }}
                      >
                        {t("nav.dashboard")}
                      </button>

                      <button
                        type="button"
                        className="icon-control-option user-menu-logout"
                        role="menuitem"
                        onClick={() => {
                          void handleLogout();
                        }}
                      >
                        {t("auth.nav.logout")}
                      </button>

                      {logoutError ? (
                        <p className="user-menu-error" role="alert">
                          {logoutError}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
