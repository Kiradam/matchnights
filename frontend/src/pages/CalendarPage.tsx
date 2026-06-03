import { useMemo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useTheme } from "../contexts/ThemeContext";
import type { Match } from "../types";

type ViewMode = "week" | "day";
type CalFilter = "watching" | "all";
type MatchColor = "watch_together" | "watch" | "skip" | "none";

// ── Helpers ───────────────────────────────────────────────────────────────────

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - ((day + 6) % 7));
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function assignMatch(m: Match): { displayDate: Date; section: "evening" | "dawn" } {
  const dt = new Date(m.match_datetime);
  const totalMin = dt.getHours() * 60 + dt.getMinutes();
  if (totalMin <= 390) {
    const prev = new Date(dt);
    prev.setDate(prev.getDate() - 1);
    prev.setHours(0, 0, 0, 0);
    return { displayDate: prev, section: "dawn" };
  }
  const d = new Date(dt);
  d.setHours(0, 0, 0, 0);
  return { displayDate: d, section: "evening" };
}

function matchPrefClass(m: Match): MatchColor {
  if (m.my_preferences.some((p) => p.choice === "watch_together")) return "watch_together";
  if (m.my_preferences.some((p) => p.choice === "watch")) return "watch";
  if (m.my_preferences.some((p) => p.choice === "skip")) return "skip";
  return "none";
}

function isWatching(m: Match): boolean {
  return matchPrefClass(m) !== "none" && matchPrefClass(m) !== "skip";
}

// ── iCal download ─────────────────────────────────────────────────────────────

async function downloadICal() {
  const res = await api.get<{ token: string }>("/users/me/calendar-token");
  window.location.href = `/api/users/me/calendar.ics?token=${encodeURIComponent(res.data.token)}`;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevL() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevR() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
      <path d="M12 3v11m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Match pill (week view) ────────────────────────────────────────────────────

function MatchPill({ match }: { match: Match }) {
  const prefClass = matchPrefClass(match);
  return (
    <Link to={`/matches/${match.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div className={`cal-match ${prefClass}`}>
        <div className="cm-time tnum">{fmtTime(match.match_datetime)}</div>
        <div className="cm-teams">
          {match.home_team_tla ?? match.home_team.slice(0, 3).toUpperCase()}
          <span className="cm-vs">v</span>
          {match.away_team_tla ?? match.away_team.slice(0, 3).toUpperCase()}
        </div>
        <div className="cm-grp">
          {match.stage}
          {match.matchday ? ` · MD${match.matchday}` : ""}
        </div>
      </div>
    </Link>
  );
}

// ── Day match card ────────────────────────────────────────────────────────────

function DayMatchCard({ match }: { match: Match }) {
  const prefClass = matchPrefClass(match);
  const homeTla = match.home_team_tla ?? match.home_team.slice(0, 3).toUpperCase();
  const awayTla = match.away_team_tla ?? match.away_team.slice(0, 3).toUpperCase();

  return (
    <Link to={`/matches/${match.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div className={`day-row ${prefClass}`}>
        <span className="dr-time tnum">{fmtTime(match.match_datetime)}</span>
        <span className="dr-teams">
          <span className="dr-team">{homeTla}</span>
          <span className="dr-vs">vs</span>
          <span className="dr-team">{awayTla}</span>
        </span>
        <span className="dr-grp">
          {match.stage}
          {match.matchday ? ` · MD${match.matchday}` : ""}
        </span>
      </div>
    </Link>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 10,
        borderRight: "1px solid var(--border)",
        background: muted ? "var(--surface-3)" : "var(--surface-2)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--text-3)",
          writingMode: "vertical-lr",
          transform: "rotate(180deg)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({
  viewDate,
  matches,
  onDayClick,
}: {
  viewDate: Date;
  matches: Match[];
  onDayClick: (d: Date) => void;
}) {
  const { dark } = useTheme();
  const today = new Date();
  const monday = startOfWeek(viewDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const dotPattern: React.CSSProperties = {
    backgroundImage: dark
      ? "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)"
      : "radial-gradient(circle, rgba(0,0,0,0.055) 1px, transparent 1px)",
    backgroundSize: "22px 22px",
  };

  const assigned = useMemo(() => {
    const map: Record<string, { evening: Match[]; dawn: Match[] }> = {};
    for (const m of matches) {
      const { displayDate, section } = assignMatch(m);
      const k = dayKey(displayDate);
      if (!map[k]) map[k] = { evening: [], dawn: [] };
      map[k][section].push(m);
    }
    for (const k of Object.keys(map)) {
      const sort = (a: Match, b: Match) =>
        new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime();
      map[k].evening.sort(sort);
      map[k].dawn.sort(sort);
    }
    return map;
  }, [matches]);

  return (
    <div
      style={{
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ overflowX: "auto", flex: 1, minHeight: 0 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.5rem repeat(7, 1fr)",
            gridTemplateRows: "auto 1fr auto",
            height: "100%",
            minWidth: 560,
          }}
        >
          {/* Day headers */}
          <div style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }} />
          {days.map((day, i) => {
            const isToday = sameDay(day, today);
            return (
              <button
                key={i}
                onClick={() => onDayClick(day)}
                style={{
                  padding: "10px 8px",
                  textAlign: "center",
                  borderBottom: "1px solid var(--border)",
                  borderLeft: "1px solid var(--border)",
                  background: isToday
                    ? "color-mix(in oklab, var(--gold) 15%, var(--surface-2))"
                    : "var(--surface-2)",
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (!isToday) (e.currentTarget as HTMLElement).style.background = "var(--surface-3)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = isToday
                    ? "color-mix(in oklab, var(--gold) 15%, var(--surface-2))"
                    : "var(--surface-2)";
                }}
              >
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: isToday ? "var(--gold)" : "var(--text-3)",
                }}>
                  {day.toLocaleDateString("en-GB", { weekday: "short" })}
                </div>
                <div style={{
                  fontFamily: "Archivo, sans-serif",
                  fontStretch: "125%",
                  fontWeight: 800,
                  fontSize: 18,
                  lineHeight: 1.1,
                  color: isToday ? "var(--gold)" : "var(--text)",
                }}>
                  {day.getDate()}
                </div>
                <div style={{ fontSize: 9, color: isToday ? "var(--gold)" : "var(--text-3)", marginTop: 2 }}>
                  {day.toLocaleDateString("en-GB", { month: "short" })}
                </div>
              </button>
            );
          })}

          {/* Evening row */}
          <SectionLabel label="Evening" />
          {days.map((day, i) => {
            const { evening } = assigned[dayKey(day)] ?? { evening: [], dawn: [] };
            const isToday = sameDay(day, today);
            return (
              <div
                key={i}
                style={{
                  padding: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  overflowY: "auto",
                  borderLeft: "1px solid var(--border)",
                  borderBottom: "1px solid var(--border)",
                  background: isToday
                    ? "color-mix(in oklab, var(--gold) 5%, var(--surface))"
                    : "var(--surface)",
                  ...(evening.length === 0 ? dotPattern : {}),
                }}
              >
                {evening.map((m) => (
                  <MatchPill key={m.id} match={m} />
                ))}
              </div>
            );
          })}

          {/* Late night row */}
          <SectionLabel label="Late" muted />
          {days.map((day, i) => {
            const { dawn } = assigned[dayKey(day)] ?? { evening: [], dawn: [] };
            const isToday = sameDay(day, today);
            return (
              <div
                key={i}
                style={{
                  padding: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  minHeight: 80,
                  borderLeft: "1px solid var(--border)",
                  background: isToday
                    ? "color-mix(in oklab, var(--gold) 3%, var(--surface-2))"
                    : "var(--surface-2)",
                  ...(dawn.length === 0 ? dotPattern : {}),
                }}
              >
                {dawn.map((m) => (
                  <MatchPill key={m.id} match={m} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Day view ──────────────────────────────────────────────────────────────────

function DayView({ viewDate, matches }: { viewDate: Date; matches: Match[] }) {
  const { evening, dawn } = useMemo(() => {
    const ev: Match[] = [];
    const dw: Match[] = [];
    for (const m of matches) {
      const { displayDate, section } = assignMatch(m);
      if (sameDay(displayDate, viewDate)) {
        (section === "dawn" ? dw : ev).push(m);
      }
    }
    const sort = (a: Match, b: Match) =>
      new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime();
    ev.sort(sort);
    dw.sort(sort);
    return { evening: ev, dawn: dw };
  }, [matches, viewDate]);

  if (evening.length === 0 && dawn.length === 0) {
    return <div className="empty-day">No matches on this day.</div>;
  }

  const SectionHead = ({ label, muted }: { label: string; muted?: boolean }) => (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    }}>
      <span style={{
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: muted ? "var(--text-3)" : "var(--text-2)",
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      {evening.length > 0 && (
        <div>
          <SectionHead label="Evening" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {evening.map((m) => <DayMatchCard key={m.id} match={m} />)}
          </div>
        </div>
      )}
      {dawn.length > 0 && (
        <div>
          <SectionHead label="Late night" muted />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dawn.map((m) => <DayMatchCard key={m.id} match={m} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("week");
  const [calFilter, setCalFilter] = useState<CalFilter>("watching");
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    api
      .get<Match[]>("/matches", { params: { page_size: 200 } })
      .then((r) => setAllMatches(r.data))
      .finally(() => setLoading(false));
  }, []);

  const watchMatches = useMemo(() => allMatches.filter(isWatching), [allMatches]);
  const displayMatches = calFilter === "all" ? allMatches : watchMatches;

  const step = (dir: 1 | -1) => {
    setViewDate((prev) => {
      const d = new Date(prev);
      if (view === "week") d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const handleDayClick = (day: Date) => {
    setViewDate(day);
    setView("day");
  };

  const headerLabel = () => {
    if (view === "week") {
      const mon = startOfWeek(viewDate);
      const sun = addDays(mon, 6);
      if (mon.getMonth() === sun.getMonth()) {
        return `${mon.getDate()}–${sun.getDate()} ${mon.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;
      }
      return `${mon.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return viewDate.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const isEmpty = !loading && watchMatches.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 6.5rem)" }}>
      {/* Screen head */}
      <div className="screen-head">
        <div className="screen-title">
          <h1>Calendar</h1>
        </div>
        <div className="seg-toggle">
          <button className={view === "week" ? "on" : ""} onClick={() => setView("week")}>
            Week
          </button>
          <button className={view === "day" ? "on" : ""} onClick={() => setView("day")}>
            Day
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="mn-icon-btn" onClick={() => step(-1)} aria-label="Previous">
            <ChevL />
          </button>
          <span className="cal-range">{loading ? "…" : headerLabel()}</span>
          <button className="mn-icon-btn" onClick={() => step(1)} aria-label="Next">
            <ChevR />
          </button>
        </div>

        <button className="btn-ghost" onClick={() => setViewDate(new Date())}>
          Today
        </button>

        <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
          Times shown in your local time
        </span>

        {/* Watching/All toggle */}
        <div className="seg-toggle" style={{ marginLeft: "auto" }}>
          {(["watching", "all"] as CalFilter[]).map((f) => (
            <button
              key={f}
              className={calFilter === f ? "on" : ""}
              onClick={() => setCalFilter(f)}
            >
              {f === "watching" ? "Watching" : "All"}
            </button>
          ))}
        </div>

        {!loading && watchMatches.length > 0 && (
          <button className="btn-gold" onClick={() => { void downloadICal(); }}>
            <DownloadIcon />
            Download .ics
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            animation: "skeleton-pulse 2s ease-in-out infinite",
          }}
        />
      ) : isEmpty ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-3)",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 40 }}>📅</div>
          <div style={{ fontWeight: 700, color: "var(--text-2)" }}>Your watchlist is empty</div>
          <div style={{ fontSize: 13 }}>
            Mark matches as <strong>Watch</strong> or <strong>Together</strong> to see them here.
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          {view === "week" && (
            <WeekView
              viewDate={viewDate}
              matches={displayMatches}
              onDayClick={handleDayClick}
            />
          )}
          {view === "day" && (
            <DayView viewDate={viewDate} matches={displayMatches} />
          )}
        </div>
      )}
    </div>
  );
}
