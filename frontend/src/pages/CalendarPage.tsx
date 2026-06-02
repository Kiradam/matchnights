import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useTheme } from "../contexts/ThemeContext";
import type { Match } from "../types";

type ViewMode = "week" | "day";
type CalFilter = "watching" | "all";
type MatchColor = "together" | "watch" | "grey";

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
  return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** 00:01–06:30 is "late night" belonging to the previous display day. */
function assignMatch(m: Match): { displayDate: Date; section: "evening" | "dawn" } {
  const dt = new Date(m.match_datetime);
  const totalMin = dt.getHours() * 60 + dt.getMinutes();
  if (totalMin >= 1 && totalMin <= 390) {
    const prev = new Date(dt);
    prev.setDate(prev.getDate() - 1);
    prev.setHours(0, 0, 0, 0);
    return { displayDate: prev, section: "dawn" };
  }
  const d = new Date(dt);
  d.setHours(0, 0, 0, 0);
  return { displayDate: d, section: "evening" };
}

function matchColor(m: Match): MatchColor {
  if (m.my_preferences.some((p) => p.choice === "watch_together")) return "together";
  if (m.my_preferences.some((p) => p.choice === "watch")) return "watch";
  return "grey";
}

function isWatching(m: Match): boolean {
  return matchColor(m) !== "grey";
}

// ── iCal download ─────────────────────────────────────────────────────────────

async function downloadICal() {
  const res = await api.get<{ token: string }>("/users/me/calendar-token");
  window.location.href = `/api/users/me/calendar.ics?token=${encodeURIComponent(res.data.token)}`;
}

// ── Style maps ────────────────────────────────────────────────────────────────

const PILL: Record<MatchColor, string> = {
  together: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700",
  watch:    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700",
  grey:     "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
};

const CARD: Record<MatchColor, string> = {
  together: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
  watch:    "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
  grey:     "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700",
};

const BADGE_LABEL: Partial<Record<MatchColor, string>> = {
  together: "Together",
  watch: "Watching",
};

const BADGE_STYLE: Partial<Record<MatchColor, string>> = {
  together: "bg-green-100 text-green-700 dark:bg-green-800/60 dark:text-green-300",
  watch:    "bg-blue-100 text-blue-700 dark:bg-blue-800/60 dark:text-blue-300",
};

// ── Shared sub-components ─────────────────────────────────────────────────────

function MatchPill({ match }: { match: Match }) {
  const color = matchColor(match);
  return (
    <Link
      to={`/matches/${match.id}`}
      className={`block text-[11px] px-2 py-1.5 rounded-lg border leading-snug hover:opacity-75 transition-opacity ${PILL[color]}`}
    >
      <div className="font-bold tabular-nums">{fmtTime(match.match_datetime)}</div>
      <div className="font-medium truncate">{match.home_team}</div>
      <div className="opacity-55 truncate text-[10px]">vs {match.away_team}</div>
    </Link>
  );
}

function DayMatchCard({ match }: { match: Match }) {
  const color = matchColor(match);
  const dt = new Date(match.match_datetime);
  const badge = BADGE_LABEL[color];
  return (
    <Link
      to={`/matches/${match.id}`}
      className={`block rounded-xl border p-4 hover:opacity-80 transition-all hover:shadow-md ${CARD[color]}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xl">⚽</span>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {match.stage}{match.matchday ? ` · MD${match.matchday}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${BADGE_STYLE[color]}`}>
              {badge}
            </span>
          )}
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
            {dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
      <div className="text-center py-2">
        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {match.home_team}
          <span className="mx-3 font-light text-gray-400 dark:text-gray-500">vs</span>
          {match.away_team}
        </div>
        {match.venue && (
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{match.venue}</div>
        )}
      </div>
    </Link>
  );
}

// ── Section label cell ────────────────────────────────────────────────────────

function SectionLabel({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <div
      className={`flex items-start justify-center pt-3 border-r border-gray-200 dark:border-gray-800 ${
        muted
          ? "bg-gray-50/80 dark:bg-gray-900/70"
          : "bg-gray-50 dark:bg-gray-800/60"
      }`}
    >
      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300 dark:text-gray-600 [writing-mode:vertical-lr]">
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

  // Subtle dot-grid texture for empty cells — adapts to dark mode
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm h-full flex flex-col">
      {/* Scrollable on small screens; flex-1 so the grid fills parent height */}
      <div className="overflow-x-auto flex-1 min-h-0">
        <div className="grid grid-cols-[2.5rem_repeat(7,1fr)] grid-rows-[auto_1fr_auto] h-full min-w-[560px]">

          {/* ── Row 1: Day headers ── */}
          <div className="bg-gray-50 dark:bg-gray-800/80 border-b border-r border-gray-200 dark:border-gray-800" />
          {days.map((day, i) => {
            const isToday = sameDay(day, today);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <button
                key={i}
                onClick={() => onDayClick(day)}
                className={[
                  "w-full px-2 py-2.5 text-center border-b border-l transition-colors",
                  isToday
                    ? "bg-blue-600 border-blue-500 hover:bg-blue-700"
                    : isWeekend
                    ? "bg-slate-100/80 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-slate-200/70 dark:hover:bg-gray-700/60"
                    : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/60",
                ].join(" ")}
              >
                <div className={`text-[10px] font-semibold uppercase tracking-wide ${isToday ? "text-blue-200" : "text-gray-400 dark:text-gray-500"}`}>
                  {day.toLocaleDateString("en-GB", { weekday: "short" })}
                </div>
                <div className={`text-base font-bold leading-tight ${isToday ? "text-white" : "text-gray-900 dark:text-gray-100"}`}>
                  {day.getDate()}
                </div>
                <div className={`text-[9px] mt-0.5 ${isToday ? "text-blue-300" : "text-gray-300 dark:text-gray-600"}`}>
                  {day.toLocaleDateString("en-GB", { month: "short" })}
                </div>
              </button>
            );
          })}

          {/* ── Row 2: Evening — expands to fill available height via 1fr grid row ── */}
          <SectionLabel label="Evening" />
          {days.map((day, i) => {
            const { evening } = assigned[dayKey(day)] ?? { evening: [], dawn: [] };
            const isToday = sameDay(day, today);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const bgClass = isToday
              ? "bg-blue-50/60 dark:bg-blue-950/25"
              : isWeekend
              ? "bg-slate-50 dark:bg-gray-900/40"
              : "bg-white dark:bg-gray-900";
            return (
              <div
                key={i}
                className={`p-1.5 space-y-1.5 overflow-y-auto border-l border-b border-gray-100 dark:border-gray-800 ${bgClass}`}
                style={evening.length === 0 ? dotPattern : undefined}
              >
                {evening.map((m) => <MatchPill key={m.id} match={m} />)}
              </div>
            );
          })}

          {/* ── Row 3: Late night — fixed 80px via grid-rows ── */}
          <SectionLabel label="Late" muted />
          {days.map((day, i) => {
            const { dawn } = assigned[dayKey(day)] ?? { evening: [], dawn: [] };
            const isToday = sameDay(day, today);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const bgClass = isToday
              ? "bg-blue-50/25 dark:bg-blue-950/10"
              : isWeekend
              ? "bg-slate-50/80 dark:bg-gray-900/50"
              : "bg-gray-50/60 dark:bg-gray-900/60";
            return (
              <div
                key={i}
                className={`p-1.5 space-y-1.5 min-h-[80px] border-l border-gray-100 dark:border-gray-800 ${bgClass}`}
                style={dawn.length === 0 ? dotPattern : undefined}
              >
                {dawn.map((m) => <MatchPill key={m.id} match={m} />)}
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
    return (
      <div className="text-center py-20 text-gray-400 dark:text-gray-500 text-sm">
        No matches on this day.
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {evening.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-2">
            <span>Evening</span>
            <div className="flex-1 border-t border-gray-100 dark:border-gray-800" />
          </div>
          <div className="space-y-3">
            {evening.map((m) => <DayMatchCard key={m.id} match={m} />)}
          </div>
        </div>
      )}

      {dawn.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-2">
            <span>Late night</span>
            <div className="flex-1 border-t border-dashed border-gray-200 dark:border-gray-700" />
          </div>
          <div className="space-y-3">
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

  const navigate = (dir: 1 | -1) => {
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
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  };

  const isEmpty = !loading && watchMatches.length === 0;

  return (
    // h-[calc(100dvh-6.5rem)]: fill viewport minus sticky nav (3.5rem) and main padding (3rem)
    <div className="flex flex-col h-[calc(100dvh-6.5rem)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-lg leading-none"
          >
            ‹
          </button>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 min-w-[220px] text-center">
            {loading ? "…" : headerLabel()}
          </h2>
          <button
            onClick={() => navigate(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-lg leading-none"
          >
            ›
          </button>
          <button
            onClick={() => setViewDate(new Date())}
            className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Today
          </button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(["watching", "all"] as CalFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setCalFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
                  ${calFilter === f
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
              >
                {f === "watching" ? "Watching" : "All"}
              </button>
            ))}
          </div>

          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(["week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors
                  ${view === v
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
              >
                {v}
              </button>
            ))}
          </div>

          {!loading && watchMatches.length > 0 && (
            <button
              onClick={() => { void downloadICal(); }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
              title="Download watchlist as calendar file"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download .ics
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      {!loading && !isEmpty && (
        <div className="flex items-center gap-3 mb-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-300 dark:bg-green-700 inline-block" />
            Together
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-300 dark:bg-blue-700 inline-block" />
            Watch
          </span>
          {calFilter === "all" && (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-gray-300 dark:bg-gray-600 inline-block" />
              Skip / undecided
            </span>
          )}
        </div>
      )}

      {/* Content — flex-1 so week grid fills remaining height */}
      {loading ? (
        <div className="flex-1 min-h-0 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-pulse flex flex-col">
          {/* header */}
          <div className="grid grid-cols-[2.5rem_repeat(7,1fr)] bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 shrink-0">
            <div className="h-14 border-r border-gray-200 dark:border-gray-800" />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="py-3 px-2 border-l border-gray-200 dark:border-gray-800">
                <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded mx-auto w-6 mb-1.5" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto w-5" />
              </div>
            ))}
          </div>
          {/* evening — flex-1 */}
          <div className="grid grid-cols-[2.5rem_repeat(7,1fr)] flex-1 min-h-0">
            <div className="bg-gray-50 dark:bg-gray-800/60 border-r border-gray-200 dark:border-gray-800" />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 border-b p-1.5 space-y-1.5">
                <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg" />
              </div>
            ))}
          </div>
          {/* late night — auto height */}
          <div className="grid grid-cols-[2.5rem_repeat(7,1fr)]">
            <div className="bg-gray-50/80 dark:bg-gray-900/70 border-r border-gray-200 dark:border-gray-800" />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="min-h-[80px] bg-gray-50/60 dark:bg-gray-900/60 border-l border-gray-100 dark:border-gray-800" />
            ))}
          </div>
        </div>
      ) : isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
          <div className="text-4xl mb-3">📅</div>
          <div className="font-medium">Your watchlist is empty</div>
          <div className="text-sm mt-1">
            Mark matches as <strong>Watch</strong> or <strong>Together</strong> to see them here.
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 transition-opacity duration-150">
          {view === "week" && (
            <WeekView viewDate={viewDate} matches={displayMatches} onDayClick={handleDayClick} />
          )}
          {view === "day" && (
            <DayView viewDate={viewDate} matches={displayMatches} />
          )}
        </div>
      )}
    </div>
  );
}
