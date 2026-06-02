import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import type { Match } from "../types";

type ViewMode = "month" | "week" | "day";

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchDate(m: Match): Date {
  return new Date(m.match_datetime);
}

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
  copy.setDate(copy.getDate() - ((day + 6) % 7)); // Monday start
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

function topChoice(m: Match): "watch_together" | "watch" | null {
  if (m.my_preferences.some((p) => p.choice === "watch_together")) return "watch_together";
  if (m.my_preferences.some((p) => p.choice === "watch")) return "watch";
  return null;
}

function isWatching(m: Match): boolean {
  return topChoice(m) !== null;
}

// ── iCal export ───────────────────────────────────────────────────────────────

function toICalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// RFC 5545 §3.3.11 — escape TEXT property values
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// RFC 5545 §3.1 — fold lines longer than 75 octets (CRLF + space)
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const chunks: string[] = [];
  let current = "";
  for (const char of line) {
    const next = current + char;
    if (encoder.encode(next).length > 75) {
      chunks.push(current);
      current = " " + char;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.join("\r\n");
}

function downloadICal(matches: Match[]) {
  const now = toICalDate(new Date());
  const rawLines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WatchMatch//WC2026//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:WC 2026 Watchlist",
  ];

  for (const m of matches) {
    const start = new Date(m.match_datetime);
    const end = new Date(start.getTime() + 2 * 3600 * 1000);
    const choice = topChoice(m);
    const desc = [
      m.stage,
      m.matchday ? `MD${m.matchday}` : "",
      choice === "watch_together" ? "Watching together" : "Watching",
    ]
      .filter(Boolean)
      .join(" - ");

    rawLines.push(
      "BEGIN:VEVENT",
      `UID:wm-${m.id}@wc2026-planner`,
      `DTSTAMP:${now}`,
      `DTSTART:${toICalDate(start)}`,
      `DTEND:${toICalDate(end)}`,
      `SUMMARY:${esc(`${m.home_team} vs ${m.away_team}`)}`,
      `DESCRIPTION:${esc(desc)}`,
      ...(m.venue ? [`LOCATION:${esc(m.venue)}`] : []),
      "END:VEVENT",
    );
  }

  rawLines.push("END:VCALENDAR");

  const content = rawLines.map(fold).join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "wc2026-watchlist.ics";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Style maps ────────────────────────────────────────────────────────────────

const PILL: Record<"watch" | "watch_together", string> = {
  watch_together:
    "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700",
  watch:
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700",
};

const CARD: Record<"watch" | "watch_together", string> = {
  watch_together:
    "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
  watch:
    "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
};

const BADGE: Record<"watch" | "watch_together", string> = {
  watch_together:
    "bg-green-100 text-green-700 dark:bg-green-800/60 dark:text-green-300",
  watch: "bg-blue-100 text-blue-700 dark:bg-blue-800/60 dark:text-blue-300",
};

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  viewDate,
  matches,
  onDayClick,
}: {
  viewDate: Date;
  matches: Match[];
  onDayClick: (d: Date) => void;
}) {
  const today = new Date();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const gridStart = startOfWeek(firstOfMonth);

  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const byDay = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const d = matchDate(m);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [matches]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-2.5 tracking-wide uppercase"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 dark:divide-gray-800">
        {cells.map((day, i) => {
          const inMonth = day.getMonth() === month;
          const isToday = sameDay(day, today);
          const dayMatches = byDay.get(dayKey(day)) ?? [];
          const hasMatches = dayMatches.length > 0;

          return (
            <div
              key={i}
              onClick={() => hasMatches && onDayClick(day)}
              className={`min-h-[88px] p-1.5 transition-colors group
                ${inMonth ? "bg-white dark:bg-gray-900" : "bg-gray-50/60 dark:bg-gray-900/40"}
                ${hasMatches ? "cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/20" : ""}
              `}
            >
              <div
                className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold mb-1 mx-auto transition-colors
                  ${isToday
                    ? "bg-blue-600 text-white shadow-sm"
                    : inMonth
                    ? "text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                    : "text-gray-300 dark:text-gray-600"
                  }
                `}
              >
                {day.getDate()}
              </div>

              <div className="space-y-0.5">
                {dayMatches.slice(0, 2).map((m) => {
                  const choice = topChoice(m);
                  return (
                    <div
                      key={m.id}
                      className={`text-[10px] leading-tight px-1 py-0.5 rounded border truncate font-medium
                        ${choice ? PILL[choice] : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"}
                      `}
                    >
                      {fmtTime(m.match_datetime)}{" "}
                      {m.home_team.slice(0, 3)} v {m.away_team.slice(0, 3)}
                    </div>
                  );
                })}
                {dayMatches.length > 2 && (
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 px-1 font-medium">
                    +{dayMatches.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
  const today = new Date();
  const monday = startOfWeek(viewDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, i) => {
        const isToday = sameDay(day, today);
        const dayMatches = matches
          .filter((m) => sameDay(matchDate(m), day))
          .sort(
            (a, b) =>
              new Date(a.match_datetime).getTime() -
              new Date(b.match_datetime).getTime()
          );

        return (
          <div
            key={i}
            className={`rounded-xl border overflow-hidden shadow-sm transition-shadow
              ${isToday
                ? "border-blue-300 dark:border-blue-600 shadow-blue-100 dark:shadow-none"
                : "border-gray-200 dark:border-gray-800"
              }
            `}
          >
            {/* Day header */}
            <div
              onClick={() => onDayClick(day)}
              className={`px-2 py-2 text-center border-b cursor-pointer transition-colors
                ${isToday
                  ? "bg-blue-600 border-blue-600 hover:bg-blue-700"
                  : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/60"
                }
              `}
            >
              <div
                className={`text-[10px] font-semibold uppercase tracking-wide
                  ${isToday ? "text-blue-200" : "text-gray-400 dark:text-gray-500"}`}
              >
                {day.toLocaleDateString("en-GB", { weekday: "short" })}
              </div>
              <div
                className={`text-sm font-bold
                  ${isToday ? "text-white" : "text-gray-900 dark:text-gray-100"}`}
              >
                {day.getDate()}
              </div>
            </div>

            {/* Matches */}
            <div className="p-1.5 space-y-1 min-h-[120px] bg-white dark:bg-gray-900">
              {dayMatches.map((m) => {
                const choice = topChoice(m);
                return (
                  <Link
                    key={m.id}
                    to={`/matches/${m.id}`}
                    className={`block text-[11px] p-1.5 rounded-lg border leading-snug hover:opacity-75 transition-opacity
                      ${choice ? PILL[choice] : "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700"}
                    `}
                  >
                    <div className="font-bold">{fmtTime(m.match_datetime)}</div>
                    <div className="font-medium truncate">{m.home_team}</div>
                    <div className="opacity-60 truncate text-[10px]">vs {m.away_team}</div>
                  </Link>
                );
              })}
              {dayMatches.length === 0 && (
                <div className="flex items-center justify-center h-full min-h-[80px]">
                  <span className="text-[10px] text-gray-300 dark:text-gray-700">—</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Day view ──────────────────────────────────────────────────────────────────

function DayView({ viewDate, matches }: { viewDate: Date; matches: Match[] }) {
  const dayMatches = matches
    .filter((m) => sameDay(matchDate(m), viewDate))
    .sort(
      (a, b) =>
        new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime()
    );

  if (dayMatches.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400 dark:text-gray-500 text-sm">
        No watched matches on this day.
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-3">
      {dayMatches.map((m) => {
        const choice = topChoice(m);
        const dt = new Date(m.match_datetime);
        return (
          <Link
            key={m.id}
            to={`/matches/${m.id}`}
            className={`block rounded-xl border p-4 hover:opacity-80 transition-all hover:shadow-md
              ${choice ? CARD[choice] : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"}
            `}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xl">⚽</span>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {m.stage}
                  {m.matchday ? ` · MD${m.matchday}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {choice && (
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${BADGE[choice]}`}>
                    {choice === "watch_together" ? "Together" : "Watching"}
                  </span>
                )}
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>

            <div className="text-center py-2">
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {m.home_team}
                <span className="mx-3 font-light text-gray-400 dark:text-gray-500">vs</span>
                {m.away_team}
              </div>
              {m.venue && (
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{m.venue}</div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("month");
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    api
      .get<Match[]>("/matches", { params: { page_size: 200 } })
      .then((r) => setAllMatches(r.data))
      .finally(() => setLoading(false));
  }, []);

  const watchMatches = useMemo(() => allMatches.filter(isWatching), [allMatches]);

  const navigate = (dir: 1 | -1) => {
    setViewDate((prev) => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() + dir);
      else if (view === "week") d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const handleDayClick = (day: Date) => {
    setViewDate(day);
    setView("day");
  };

  const headerLabel = () => {
    if (view === "month") {
      return viewDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    }
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

  return (
    <div>
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

        {/* View switcher + Download */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors
                  ${view === v
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }
                `}
              >
                {v}
              </button>
            ))}
          </div>

          {!loading && watchMatches.length > 0 && (
            <button
              onClick={() => downloadICal(watchMatches)}
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
      {!loading && watchMatches.length > 0 && (
        <div className="flex items-center gap-3 mb-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-300 dark:bg-green-700 inline-block" />
            Together
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-300 dark:bg-blue-700 inline-block" />
            Watch
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-pulse">
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="py-2.5 px-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mx-auto w-8" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 dark:divide-gray-800">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-[88px] bg-white dark:bg-gray-900 p-1.5">
                <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 mx-auto mb-1" />
              </div>
            ))}
          </div>
        </div>
      ) : watchMatches.length === 0 ? (
        <div className="text-center py-24 text-gray-400 dark:text-gray-500">
          <div className="text-4xl mb-3">📅</div>
          <div className="font-medium">Your watchlist is empty</div>
          <div className="text-sm mt-1">
            Mark matches as <strong>Watch</strong> or <strong>Together</strong> to see them here.
          </div>
        </div>
      ) : (
        <div className="transition-opacity duration-150">
          {view === "month" && (
            <MonthView viewDate={viewDate} matches={watchMatches} onDayClick={handleDayClick} />
          )}
          {view === "week" && (
            <WeekView viewDate={viewDate} matches={watchMatches} onDayClick={handleDayClick} />
          )}
          {view === "day" && (
            <DayView viewDate={viewDate} matches={watchMatches} />
          )}
        </div>
      )}
    </div>
  );
}
