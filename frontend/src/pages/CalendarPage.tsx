import { useMemo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import { useTheme } from "../contexts/ThemeContext";
import type { Match } from "../types";

type ViewMode = "week" | "day";
type CalFilter = "watching" | "all";
type MatchColor = "watch_together" | "watch" | "skip" | "none";

// Tournament week boundaries (Monday of first/last week)
const TOUR_FIRST_WEEK = new Date(2026, 5, 8);  // Mon 8 Jun 2026
const TOUR_LAST_WEEK  = new Date(2026, 6, 13); // Mon 13 Jul 2026

// Fixed heights for week-view section rows
// A .cal-match card: 6px pad-top + ~45px content + 6px pad-bot + 2px border = ~59px; use 64px generous.
const CARD_H   = 64;  // px per card
const CARD_GAP = 4;   // px between cards in column
const CELL_PAD = 12;  // px total vertical padding of the cell (6 top + 6 bottom)
const EVENING_H = CELL_PAD + 3 * CARD_H + 2 * CARD_GAP; // 220px — fits 3 cards
const LATE_H    = CELL_PAD + 4 * CARD_H + 3 * CARD_GAP; // 280px — fits 4 cards

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

function fmtTime(dateStr: string, locale = "en-GB") {
  return new Date(dateStr).toLocaleTimeString(locale, {
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

function MatchPill({ match, locale }: { match: Match; locale: string }) {
  const prefClass = matchPrefClass(match);
  return (
    <Link to={`/matches/${match.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div className={`cal-match ${prefClass}`}>
        <div className="cm-time tnum">{fmtTime(match.match_datetime, locale)}</div>
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

function DayMatchCard({ match, locale }: { match: Match; locale: string }) {
  const prefClass = matchPrefClass(match);
  const homeTla = match.home_team_tla ?? match.home_team.slice(0, 3).toUpperCase();
  const awayTla = match.away_team_tla ?? match.away_team.slice(0, 3).toUpperCase();

  return (
    <Link to={`/matches/${match.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div className={`day-row ${prefClass}`}>
        <span className="dr-time tnum">{fmtTime(match.match_datetime, locale)}</span>
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
  locale,
  eveningLabel,
  lateLabel,
}: {
  viewDate: Date;
  matches: Match[];
  onDayClick: (d: Date) => void;
  locale: string;
  eveningLabel: string;
  lateLabel: string;
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
      }}
    >
      {/* Single horizontally-scrollable container for the entire grid */}
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            // 40px label column + 7 day columns, each min 130px so content never truncates
            gridTemplateColumns: `2.5rem repeat(7, minmax(130px, 1fr))`,
            // Fixed row heights: evening fits 3 cards, late fits 4 cards
            gridTemplateRows: `auto ${EVENING_H}px ${LATE_H}px`,
          }}
        >
          {/* Day header row */}
          <div style={{
            background: "var(--surface-2)",
            borderBottom: "1px solid var(--border)",
            borderRight: "1px solid var(--border)",
          }} />
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
                  {day.toLocaleDateString(locale, { weekday: "short" })}
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
                  {day.toLocaleDateString(locale, { month: "short" })}
                </div>
              </button>
            );
          })}

          {/* Evening row — fixed height, no internal scroll */}
          <SectionLabel label={eveningLabel} />
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
                  gap: CARD_GAP,
                  borderLeft: "1px solid var(--border)",
                  borderBottom: "1px solid var(--border)",
                  background: isToday
                    ? "color-mix(in oklab, var(--gold) 5%, var(--surface))"
                    : "var(--surface)",
                  ...(evening.length === 0 ? dotPattern : {}),
                }}
              >
                {evening.map((m) => (
                  <MatchPill key={m.id} match={m} locale={locale} />
                ))}
              </div>
            );
          })}

          {/* Late night row — fixed height, no internal scroll */}
          <SectionLabel label={lateLabel} muted />
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
                  gap: CARD_GAP,
                  borderLeft: "1px solid var(--border)",
                  background: isToday
                    ? "color-mix(in oklab, var(--gold) 3%, var(--surface-2))"
                    : "var(--surface-2)",
                  ...(dawn.length === 0 ? dotPattern : {}),
                }}
              >
                {dawn.map((m) => (
                  <MatchPill key={m.id} match={m} locale={locale} />
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

function DayView({
  viewDate,
  matches,
  locale,
  eveningLabel,
  lateNightLabel,
  noMatchesDayLabel,
}: {
  viewDate: Date;
  matches: Match[];
  locale: string;
  eveningLabel: string;
  lateNightLabel: string;
  noMatchesDayLabel: string;
}) {
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
    return <div className="empty-day">{noMatchesDayLabel}</div>;
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
          <SectionHead label={eveningLabel} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {evening.map((m) => <DayMatchCard key={m.id} match={m} locale={locale} />)}
          </div>
        </div>
      )}
      {dawn.length > 0 && (
        <div>
          <SectionHead label={lateNightLabel} muted />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dawn.map((m) => <DayMatchCard key={m.id} match={m} locale={locale} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "hu" ? "hu-HU" : "en-GB";

  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("week");
  const [calFilter, setCalFilter] = useState<CalFilter>("watching");

  // Open on the current week, clamped to tournament bounds
  const [viewDate, setViewDate] = useState(() => {
    const today = new Date();
    const ws = startOfWeek(today);
    if (ws.getTime() < TOUR_FIRST_WEEK.getTime()) return new Date(TOUR_FIRST_WEEK);
    if (ws.getTime() > TOUR_LAST_WEEK.getTime())  return new Date(TOUR_LAST_WEEK);
    return today;
  });

  useEffect(() => {
    api
      .get<Match[]>("/matches", { params: { page_size: 200 } })
      .then((r) => setAllMatches(r.data))
      .finally(() => setLoading(false));
  }, []);

  const watchMatches = useMemo(() => allMatches.filter(isWatching), [allMatches]);
  const displayMatches = calFilter === "all" ? allMatches : watchMatches;

  // Week navigation boundary check
  const weekStart = startOfWeek(viewDate);
  const canGoPrev = view !== "week" || weekStart.getTime() > TOUR_FIRST_WEEK.getTime();
  const canGoNext = view !== "week" || weekStart.getTime() < TOUR_LAST_WEEK.getTime();

  const step = (dir: 1 | -1) => {
    setViewDate((prev) => {
      if (view === "week") {
        const next = addDays(startOfWeek(prev), dir * 7);
        if (next.getTime() < TOUR_FIRST_WEEK.getTime()) return new Date(TOUR_FIRST_WEEK);
        if (next.getTime() > TOUR_LAST_WEEK.getTime())  return new Date(TOUR_LAST_WEEK);
        return next;
      }
      return addDays(prev, dir);
    });
  };

  const goToday = () => {
    const today = new Date();
    if (view === "week") {
      const ws = startOfWeek(today);
      if (ws.getTime() < TOUR_FIRST_WEEK.getTime()) { setViewDate(new Date(TOUR_FIRST_WEEK)); return; }
      if (ws.getTime() > TOUR_LAST_WEEK.getTime())  { setViewDate(new Date(TOUR_LAST_WEEK));  return; }
    }
    setViewDate(today);
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
        return `${mon.getDate()}–${sun.getDate()} ${mon.toLocaleDateString(locale, { month: "long", year: "numeric" })}`;
      }
      return `${mon.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${sun.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return viewDate.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const ViewToggle = ({ extraClass }: { extraClass?: string }) => (
    <div className={`seg-toggle${extraClass ? ` ${extraClass}` : ""}`}>
      <button className={view === "week" ? "on" : ""} onClick={() => setView("week")}>
        {t("calendar.week")}
      </button>
      <button className={view === "day" ? "on" : ""} onClick={() => setView("day")}>
        {t("calendar.day")}
      </button>
    </div>
  );

  const FilterToggle = () => (
    <div className="seg-toggle">
      {(["watching", "all"] as CalFilter[]).map((f) => (
        <button key={f} className={calFilter === f ? "on" : ""} onClick={() => setCalFilter(f)}>
          {f === "watching" ? t("calendar.watching") : t("calendar.all")}
        </button>
      ))}
    </div>
  );

  const isEmpty = !loading && watchMatches.length === 0;

  return (
    <div>
      {/* ── Calendar header ────────────────────────────────────────────── */}
      <div className="cal-header">
        {/* Row 1: title (+ view toggle on mobile) */}
        <div className="cal-hdr-r1">
          <div className="screen-title">
            <h1>{t("calendar.title")}</h1>
          </div>
          {/* Mobile-only: view toggle sits on row 1 right */}
          <ViewToggle extraClass="cal-r1-toggle" />
        </div>

        {/* Row 2: [Week|Day] · < label > · [Today] · [Watching|All]
            On mobile only the nav stays here; other controls move to row 3 */}
        <div className="cal-hdr-r2">
          {/* Desktop-only: view toggle left of nav */}
          <ViewToggle extraClass="cal-r2-toggle" />

          {/* Navigation — always present */}
          <div className="cal-nav">
            <button
              className="mn-icon-btn"
              onClick={() => step(-1)}
              disabled={!canGoPrev}
              aria-label={t("common.cancel")}
            >
              <ChevL />
            </button>
            <span className="cal-range">{loading ? "…" : headerLabel()}</span>
            <button
              className="mn-icon-btn"
              onClick={() => step(1)}
              disabled={!canGoNext}
              aria-label="Next"
            >
              <ChevR />
            </button>
          </div>

          {/* Desktop-only: Today button inline */}
          <button className="btn-ghost cal-r2-today" onClick={goToday}>
            {t("calendar.today")}
          </button>

          {/* Desktop-only: filter aligned to right */}
          <div className="cal-r2-filter">
            <FilterToggle />
          </div>
        </div>

        {/* Row 3 — mobile only: [Today left] [Watching|All right] */}
        <div className="cal-hdr-r3">
          <button className="btn-ghost" onClick={goToday}>
            {t("calendar.today")}
          </button>
          <FilterToggle />
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      {loading ? (
        <div
          style={{
            height: 400,
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            animation: "skeleton-pulse 2s ease-in-out infinite",
          }}
        />
      ) : isEmpty ? (
        <div
          style={{
            padding: "60px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-3)",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 40 }}>📅</div>
          <div style={{ fontWeight: 700, color: "var(--text-2)" }}>{t("calendar.emptyWatchlist")}</div>
          <div style={{ fontSize: 13 }}>{t("calendar.emptyWatchlistNote")}</div>
        </div>
      ) : view === "week" ? (
        <WeekView
          viewDate={viewDate}
          matches={displayMatches}
          onDayClick={handleDayClick}
          locale={locale}
          eveningLabel={t("calendar.evening")}
          lateLabel={t("calendar.late")}
        />
      ) : (
        <DayView
          viewDate={viewDate}
          matches={displayMatches}
          locale={locale}
          eveningLabel={t("calendar.evening")}
          lateNightLabel={t("calendar.lateNight")}
          noMatchesDayLabel={t("calendar.noMatchesDay")}
        />
      )}

      {/* ── Download .ics — secondary action below the grid ───────────── */}
      {!loading && watchMatches.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-gold" onClick={() => { void downloadICal(); }}>
            <DownloadIcon />
            {t("calendar.downloadIcs")}
          </button>
        </div>
      )}
    </div>
  );
}
