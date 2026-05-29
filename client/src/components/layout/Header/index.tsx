import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiRequestError } from "../../../lib/authApi";
import { useI18n, type SupportedLocale } from "../../../locales/I18nContext";
import { useAuth } from "../../../stores/AuthContext";
import { themeModes, useTheme } from "../../../stores/ThemeContext";
import { LanguageSwitcher } from "../../ui/LanguageSwitcher";
import { ThemeSwitcher } from "../../ui/ThemeSwitcher";
import { Button } from "../../ui/Button";
import { classNames } from "../../../utils/classNames";
import { NotificationBell } from "../../../features/notifications";
import styles from "./index.module.css";

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
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(() =>
    typeof window !== "undefined" ? window.scrollY >= 12 : false,
  );
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

    const updateHeaderState = (): void => {
      const currentScrollTop = window.scrollY;
      const scrollDelta = currentScrollTop - lastScrollTopRef.current;
      const isNearTop = currentScrollTop < 12;

      setIsHeaderScrolled(!isNearTop);

      if (isNearTop || scrollDelta < -4) {
        setIsHeaderVisible(true);
      } else if (scrollDelta > 6 && currentScrollTop > 88) {
        setIsHeaderVisible(false);
        setIsMobileMenuOpen(false);
        setIsUserMenuOpen(false);
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
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
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
        styles.siteHeader,
        isHeaderScrolled && styles.isScrolled,
        !isHeaderVisible && styles.isHidden,
      )}
    >
      <div className={classNames("container", styles.headerContent)}>
        <a className={styles.brand} href="/" aria-label="Axia Smart Intern Manager">
          <img
            src="/axiaLogo.png"
            alt="Axia logo"
            className={styles.brandMark}
            width="40"
            height="40"
          />
          <span className={styles.brandText}>Axia Smart Intern Manager</span>
        </a>

        <button
          type="button"
          className={styles.mobileMenuButton}
          onClick={() => setIsMobileMenuOpen((prevState) => !prevState)}
          aria-expanded={isMobileMenuOpen}
          aria-controls="main-navigation"
          aria-label={t("nav.mobileMenu")}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <div
          className={classNames(styles.headerPanels, isMobileMenuOpen && styles.isOpen)}
        >
          <nav id="main-navigation" aria-label="Main navigation">
            {/* Desktop navigation - anchor links only on homepage */}
            <ul className={classNames(styles.mainNavList, styles.desktopNav)}>
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
              <ul className={styles.mobileMenuList}>
                {/* Navigation items first (when on homepage) */}
                {isHomePage &&
                  anchorNavItems.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        onClick={closeMenu}
                        className={styles.mobileMenuNavItem}
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
                      className={styles.mobileMenuDashboard}
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
                      styles.mobileSubmenuTrigger,
                      mobileSubmenu === "theme" && styles.isOpen,
                    )}
                    onClick={() => toggleMobileSubmenu("theme")}
                    aria-expanded={mobileSubmenu === "theme"}
                  >
                    <span className={styles.mobileSubmenuLabel}>
                      {t("theme.label")}
                    </span>
                    <span className={styles.mobileSubmenuChevron} aria-hidden="true">
                      {mobileSubmenu === "theme" ? "▾" : "▸"}
                    </span>
                  </button>
                  {mobileSubmenu === "theme" && (
                    <ul className={styles.mobileSubmenuItems}>
                      {themeModes.map((mode) => (
                        <li key={mode}>
                          <button
                            type="button"
                            className={classNames(
                              styles.mobileSubmenuOption,
                              themeMode === mode && styles.isActive,
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
                      styles.mobileSubmenuTrigger,
                      mobileSubmenu === "language" && styles.isOpen,
                    )}
                    onClick={() => toggleMobileSubmenu("language")}
                    aria-expanded={mobileSubmenu === "language"}
                  >
                    <span className={styles.mobileSubmenuLabel}>
                      {t("language.label")}
                    </span>
                    <span className={styles.mobileSubmenuChevron} aria-hidden="true">
                      {mobileSubmenu === "language" ? "▾" : "▸"}
                    </span>
                  </button>
                  {mobileSubmenu === "language" && (
                    <ul className={styles.mobileSubmenuItems}>
                      {languageOptions.map((option) => (
                        <li key={option.value}>
                          <button
                            type="button"
                            className={classNames(
                              styles.mobileSubmenuOption,
                              locale === option.value && styles.isActive,
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
                    <li className={styles.mobileMenuDivider} />
                    <li>
                      <button
                        type="button"
                        className={styles.mobileMenuLogout}
                        onClick={() => void handleLogout()}
                      >
                        {t("auth.nav.logout")}
                      </button>
                    </li>
                    {logoutError && (
                      <li>
                        <p className={styles.mobileMenuError} role="alert">
                          {logoutError}
                        </p>
                      </li>
                    )}
                  </>
                )}
              </ul>
            )}
          </nav>

          <div className={styles.headerControls}>
            {!isMobileMenuOpen && (
              <>
                <LanguageSwitcher shouldClose={!isHeaderVisible} />
                <ThemeSwitcher shouldClose={!isHeaderVisible} />
              </>
            )}
            {!isLoggedIn ? (
              <>
                <Button
                  className={classNames(styles.headerAuthButton, styles.headerLogin)}
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate("/login")}
                >
                  {t("nav.login")}
                </Button>
                <Button
                  className={classNames(styles.headerAuthButton, styles.headerSignup)}
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
                <>
                  <NotificationBell
                    role={user?.role}
                    shouldClose={isMobileMenuOpen || !isHeaderVisible}
                  />

                  <div
                    ref={userMenuRef}
                    className={classNames(
                      "icon-control-dropdown",
                      styles.userMenuDropdown,
                      isUserMenuOpen && styles.isOpen,
                    )}
                  >
                    <button
                      type="button"
                      className={classNames("icon-control", styles.userMenuTrigger)}
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
                          fill="currentColor"
                        >
                          <path d="M12 12a4 4 0 1 0-4-4a4 4 0 0 0 4 4Zm0 2c-4.1 0-7.4 2.2-7.4 4.9V21h14.8v-2.1c0-2.7-3.3-4.9-7.4-4.9Z" />
                        </svg>
                      </span>
                    </button>

                    {isUserMenuOpen ? (
                      <div
                        className={classNames("icon-control-menu", styles.userMenuPanel)}
                        role="menu"
                        aria-label={t("auth.nav.userMenu")}
                      >
                        <div className={styles.userMenuProfile} role="presentation">
                          <p className={styles.userMenuTitle}>
                            {t("auth.nav.profile")}
                          </p>
                          <p className={styles.userMenuName}>{userDisplayName}</p>
                          <p className={styles.userMenuEmail}>{userDisplayEmail}</p>
                        </div>

                        <div className={styles.userMenuDivider} role="presentation" />

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
                          className={classNames("icon-control-option", styles.userMenuLogout)}
                          role="menuitem"
                          onClick={() => {
                            void handleLogout();
                          }}
                        >
                          {t("auth.nav.logout")}
                        </button>

                        {logoutError ? (
                          <p className={styles.userMenuError} role="alert">
                            {logoutError}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

