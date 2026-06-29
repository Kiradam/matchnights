import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}


function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function dicebearUrl(seed: number | string): string {
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}`;
}

function LangSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;
  const switchTo = (lang: string) => {
    void i18n.changeLanguage(lang);
    localStorage.setItem("mn-lang", lang);
  };
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {(["en", "hu"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => switchTo(lang)}
          style={{
            padding: "2px 7px",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "'Archivo', sans-serif",
            fontStretch: "125%",
            letterSpacing: "0.04em",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: current === lang ? "var(--text)" : "transparent",
            color: current === lang ? "var(--bg)" : "var(--text-3)",
            cursor: "pointer",
            transition: "all 0.12s",
            textTransform: "uppercase",
          }}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function MainLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  const navLinks = [
    { to: "/matches", label: t("nav.matches") },
    { to: "/my-tips", label: t("nav.myTips") },
    { to: "/calendar", label: t("nav.calendar") },
    { to: "/standings", label: t("nav.standings") },
    { to: "/bracket", label: t("nav.bracket") },
    ...(user?.role === "admin" ? [{ to: "/admin", label: t("nav.admin") }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header className="mn-nav" style={{ position: "relative" }}>
        {/* Hamburger — mobile only */}
        <button
          className="mn-icon-btn mn-hamburger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={t("nav.toggleMenu")}
        >
          {menuOpen ? <XIcon /> : <MenuIcon />}
        </button>

        {/* Brand */}
        <Link to="/matches" className="mn-brand" onClick={closeMenu}>
          <span className="mn-mark">
            <img src="/logo.png" alt="MatchNights logo" />
          </span>
          <span className="mn-wordmark">
            Match<em>Nights</em>
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="mn-nav-links">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `mn-nav-link${isActive ? " active" : ""}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        {/* Right: LangSwitcher | theme toggle | avatar */}
        <div className="mn-nav-right">
          <LangSwitcher />
          <button
            className="mn-icon-btn"
            onClick={toggle}
            aria-label={t("nav.toggleTheme")}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          {user && (
            <div ref={profileRef} style={{ position: "relative" }}>
              <button
                className="mn-avatar"
                title={user.full_name}
                onClick={() => setProfileOpen((o) => !o)}
                aria-expanded={profileOpen}
                aria-haspopup="true"
              >
                <img src={dicebearUrl(user.id)} alt={user.full_name} />
              </button>

              {profileOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    minWidth: 180,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    overflow: "hidden",
                    zIndex: 300,
                  }}
                >
                  <div
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {user.full_name}
                    <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-3)", marginTop: 1 }}>
                      {user.email}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "10px 14px",
                      border: "none",
                      background: "transparent",
                      color: "var(--skip)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left" as const,
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background = "color-mix(in oklab, var(--skip) 10%, transparent)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
                    }
                  >
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15" style={{ flexShrink: 0 }}>
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t("nav.logout")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="mn-mobile-sheet">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={closeMenu}
              className={({ isActive }) =>
                `mn-mobile-link${isActive ? " active" : ""}`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
            <div style={{ padding: "4px 12px", fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
              {user?.full_name}
            </div>
            <button className="mn-mobile-link" onClick={handleLogout} style={{ width: "100%" }}>
              {t("nav.logout")}
            </button>
          </div>
        </div>
      )}

      <main className="mn-page">
        <Outlet />
      </main>
    </div>
  );
}
