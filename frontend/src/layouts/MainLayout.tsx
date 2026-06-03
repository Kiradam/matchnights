import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
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

function BallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5l2.6 1.9-1 3.1h-3.2l-1-3.1z" fill="currentColor" />
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

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function MainLayout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const closeMenu = () => setMenuOpen(false);

  const navLinks = [
    { to: "/matches", label: "Matches" },
    { to: "/calendar", label: "Calendar" },
    ...(user?.role === "admin" ? [{ to: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header className="mn-nav" style={{ position: "relative" }}>
        {/* Hamburger — mobile only */}
        <button
          className="mn-icon-btn mn-hamburger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <XIcon /> : <MenuIcon />}
        </button>

        {/* Brand */}
        <Link to="/matches" className="mn-brand" onClick={closeMenu}>
          <span className="mn-mark">
            <BallIcon />
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

        {/* Right: theme toggle + avatar */}
        <div className="mn-nav-right">
          <button
            className="mn-icon-btn"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          {user && (
            <div style={{ position: "relative" }}>
              <button
                className="mn-avatar"
                title={user.full_name}
                onClick={handleLogout}
                style={{ cursor: "pointer" }}
              >
                {initials(user.full_name)}
              </button>
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
              Logout
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
