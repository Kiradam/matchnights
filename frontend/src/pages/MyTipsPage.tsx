import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../contexts/AuthContext";
import type {
  Group,
  LeaderboardEntry,
  Match,
  MatchPrediction,
  MatchPredictionStats,
  PredictionState,
  WinnerPrediction,
} from "../types";

// ── WC 2026 teams ─────────────────────────────────────────────────────────────

const WC2026_TEAMS: { name: string; flag: string }[] = [
  // Hosts
  { name: "Canada", flag: "🇨🇦" },
  { name: "Mexico", flag: "🇲🇽" },
  { name: "United States", flag: "🇺🇸" },
  // South America
  { name: "Argentina", flag: "🇦🇷" },
  { name: "Bolivia", flag: "🇧🇴" },
  { name: "Brazil", flag: "🇧🇷" },
  { name: "Chile", flag: "🇨🇱" },
  { name: "Colombia", flag: "🇨🇴" },
  { name: "Ecuador", flag: "🇪🇨" },
  { name: "Paraguay", flag: "🇵🇾" },
  { name: "Peru", flag: "🇵🇪" },
  { name: "Uruguay", flag: "🇺🇾" },
  { name: "Venezuela", flag: "🇻🇪" },
  // CONCACAF
  { name: "Costa Rica", flag: "🇨🇷" },
  { name: "El Salvador", flag: "🇸🇻" },
  { name: "Honduras", flag: "🇭🇳" },
  { name: "Jamaica", flag: "🇯🇲" },
  { name: "Panama", flag: "🇵🇦" },
  // Europe
  { name: "Albania", flag: "🇦🇱" },
  { name: "Austria", flag: "🇦🇹" },
  { name: "Belgium", flag: "🇧🇪" },
  { name: "Croatia", flag: "🇭🇷" },
  { name: "Czech Republic", flag: "🇨🇿" },
  { name: "Denmark", flag: "🇩🇰" },
  { name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "France", flag: "🇫🇷" },
  { name: "Georgia", flag: "🇬🇪" },
  { name: "Germany", flag: "🇩🇪" },
  { name: "Greece", flag: "🇬🇷" },
  { name: "Hungary", flag: "🇭🇺" },
  { name: "Italy", flag: "🇮🇹" },
  { name: "Netherlands", flag: "🇳🇱" },
  { name: "Norway", flag: "🇳🇴" },
  { name: "Poland", flag: "🇵🇱" },
  { name: "Portugal", flag: "🇵🇹" },
  { name: "Romania", flag: "🇷🇴" },
  { name: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "Serbia", flag: "🇷🇸" },
  { name: "Slovakia", flag: "🇸🇰" },
  { name: "Spain", flag: "🇪🇸" },
  { name: "Switzerland", flag: "🇨🇭" },
  { name: "Turkey", flag: "🇹🇷" },
  { name: "Ukraine", flag: "🇺🇦" },
  // Africa
  { name: "Algeria", flag: "🇩🇿" },
  { name: "Cameroon", flag: "🇨🇲" },
  { name: "DR Congo", flag: "🇨🇩" },
  { name: "Egypt", flag: "🇪🇬" },
  { name: "Ghana", flag: "🇬🇭" },
  { name: "Ivory Coast", flag: "🇨🇮" },
  { name: "Mali", flag: "🇲🇱" },
  { name: "Morocco", flag: "🇲🇦" },
  { name: "Nigeria", flag: "🇳🇬" },
  { name: "Senegal", flag: "🇸🇳" },
  { name: "South Africa", flag: "🇿🇦" },
  { name: "Tanzania", flag: "🇹🇿" },
  { name: "Tunisia", flag: "🇹🇳" },
  // Asia
  { name: "Australia", flag: "🇦🇺" },
  { name: "Bahrain", flag: "🇧🇭" },
  { name: "China", flag: "🇨🇳" },
  { name: "Indonesia", flag: "🇮🇩" },
  { name: "Iran", flag: "🇮🇷" },
  { name: "Iraq", flag: "🇮🇶" },
  { name: "Japan", flag: "🇯🇵" },
  { name: "Jordan", flag: "🇯🇴" },
  { name: "Qatar", flag: "🇶🇦" },
  { name: "Saudi Arabia", flag: "🇸🇦" },
  { name: "South Korea", flag: "🇰🇷" },
  { name: "Uzbekistan", flag: "🇺🇿" },
  // Oceania
  { name: "New Zealand", flag: "🇳🇿" },
];

function teamFlag(name: string): string {
  return WC2026_TEAMS.find((t) => t.name === name)?.flag ?? "🏳️";
}

// ── Trophy SVG ────────────────────────────────────────────────────────────────

function TrophySVG({ size = 80, mirror = false }: { size?: number; mirror?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: mirror ? "scaleX(-1)" : undefined, flexShrink: 0 }}
      aria-hidden="true"
    >
      {/* Cup body */}
      <path d="M22 8 L78 8 L72 58 Q50 72 28 58 Z" fill="#FFD700" />
      {/* Inner shading */}
      <path d="M32 8 L68 8 L64 50 Q50 62 36 50 Z" fill="#FFA500" opacity="0.45" />
      {/* Left handle */}
      <path
        d="M24 16 Q6 16 6 36 Q6 54 25 50"
        stroke="#FFD700"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      {/* Right handle */}
      <path
        d="M76 16 Q94 16 94 36 Q94 54 75 50"
        stroke="#FFD700"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      {/* Stem */}
      <rect x="43" y="60" width="14" height="22" rx="3" fill="#FFD700" />
      {/* Base plate */}
      <rect x="28" y="82" width="44" height="13" rx="5" fill="#FFD700" />
      {/* Base bottom line */}
      <rect x="32" y="92" width="36" height="3" rx="2" fill="#FFA500" opacity="0.5" />
      {/* Shine streak */}
      <path d="M34 14 L38 54" stroke="rgba(255,255,255,0.45)" strokeWidth="4" strokeLinecap="round" />
      {/* Star dot */}
      <circle cx="57" cy="30" r="5" fill="rgba(255,255,255,0.28)" />
      {/* Stars above */}
      <text x="50" y="7" textAnchor="middle" fontSize="6" fill="#FFD700" opacity="0.7">✦ ✦ ✦</text>
    </svg>
  );
}

// ── Country selector combobox ─────────────────────────────────────────────────

function CountrySelector({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = WC2026_TEAMS.find((t) => t.name === value);
  const filtered = query
    ? WC2026_TEAMS.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : WC2026_TEAMS;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "11px 14px",
          borderRadius: "var(--radius-xs)",
          border: `1px solid ${open ? "var(--gold)" : "var(--border)"}`,
          background: "var(--surface-2)",
          color: selected ? "var(--text)" : "var(--text-3)",
          fontSize: 14,
          fontWeight: selected ? 700 : 500,
          cursor: disabled ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
          textAlign: "left" as const,
          transition: "border-color 0.15s",
          boxShadow: open ? "0 0 0 2px color-mix(in oklab, var(--gold) 25%, transparent)" : "none",
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>
          {selected ? selected.flag : "🌍"}
        </span>
        <span style={{ flex: 1 }}>
          {selected ? selected.name : "Select a team…"}
        </span>
        <span
          style={{
            color: "var(--text-3)",
            fontSize: 11,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          ▾
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          {/* Search */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries…"
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box" as const,
              }}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "12px 14px", color: "var(--text-3)", fontSize: 13 }}>
                No team found
              </div>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => {
                    onChange(t.name);
                    setOpen(false);
                    setQuery("");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "9px 14px",
                    border: "none",
                    background: t.name === value
                      ? "color-mix(in oklab, var(--gold) 12%, transparent)"
                      : "transparent",
                    color: t.name === value ? "var(--gold)" : "var(--text)",
                    fontSize: 13,
                    fontWeight: t.name === value ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "left" as const,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (t.name !== value)
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (t.name !== value)
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{t.flag}</span>
                  <span>{t.name}</span>
                  {t.name === value && (
                    <span style={{ marginLeft: "auto", fontSize: 12 }}>✓</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avatarColor(name: string): string {
  const colors = [
    "#6C63FF", "#2FC08A", "#F2B441", "#5B8DEF", "#F2685E",
    "#9DC23B", "#19B5A6", "#C77DFF", "#FF8A00", "#00B4D8",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const STATE_ORDER: Record<PredictionState, number> = {
  tip_available: 0,
  tip_locked: 1,
  manual_review: 2,
  evaluated: 3,
};

// ── State badge ───────────────────────────────────────────────────────────────

const STATE_LABEL: Record<PredictionState, string> = {
  tip_available: "Open",
  tip_locked: "Locked",
  manual_review: "Review",
  evaluated: "Evaluated",
};

const STATE_STYLE: Record<PredictionState, React.CSSProperties> = {
  tip_available: {
    background: "color-mix(in oklab, var(--watch) 15%, transparent)",
    color: "var(--watch)",
  },
  tip_locked: {
    background: "oklch(0.65 0.18 55 / 0.15)",
    color: "oklch(0.62 0.16 55)",
  },
  manual_review: {
    background: "color-mix(in oklab, var(--skip) 15%, transparent)",
    color: "var(--skip)",
  },
  evaluated: {
    background: "color-mix(in oklab, var(--together) 15%, transparent)",
    color: "var(--together)",
  },
};

function StateBadge({ state }: { state: PredictionState }) {
  return (
    <span
      style={{
        ...STATE_STYLE[state],
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.05em",
        textTransform: "uppercase" as const,
        whiteSpace: "nowrap" as const,
      }}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

// ── Points display ────────────────────────────────────────────────────────────

function Points({ points, boosted }: { points: number | null; boosted?: boolean }) {
  if (points === null) return null;
  const positive = points > 0;
  return (
    <span
      style={{
        fontFamily: '"Archivo", sans-serif',
        fontStretch: "125%",
        fontWeight: 900,
        fontSize: 14,
        color: positive ? "var(--together)" : "var(--text-3)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {positive ? "+" : ""}{points} pts{boosted && positive ? " ⚡" : ""}
    </span>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-3)" }}>
      <div
        style={{
          display: "inline-block",
          width: 28,
          height: 28,
          border: "3px solid var(--border)",
          borderTopColor: "var(--text-2)",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Outcome distribution pill ─────────────────────────────────────────────────

function OutcomePill({
  stats,
  myOutcome,
}: {
  stats: MatchPredictionStats;
  myOutcome: string;
}) {
  const { total, outcome_counts } = stats;
  if (total === 0) return null;

  const segments: Array<{ key: string; label: string; count: number; color: string }> = [
    { key: "home_win", label: "H", count: outcome_counts.home_win, color: "var(--watch)" },
    { key: "draw",     label: "D", count: outcome_counts.draw,     color: "var(--text-3)" },
    { key: "away_win", label: "A", count: outcome_counts.away_win, color: "var(--together)" },
  ];

  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-3)",
          marginBottom: 6,
        }}
      >
        Outcome distribution
      </div>
      <div
        style={{
          display: "flex",
          height: 28,
          borderRadius: 14,
          overflow: "hidden",
          gap: 2,
        }}
      >
        {segments.map((seg) => {
          const pct = Math.round((seg.count / total) * 100);
          const isMe = seg.key === myOutcome;
          return (
            <div
              key={seg.key}
              style={{
                flex: pct,
                minWidth: pct === 0 ? 0 : 4,
                background: seg.color,
                opacity: pct === 0 ? 0 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 800,
                color: "white",
                position: "relative",
                outline: isMe ? "2px solid rgba(255,255,255,0.85)" : "none",
                outlineOffset: isMe ? -2 : 0,
                transition: "flex 0.3s ease",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
              title={`${seg.label}: ${pct}%`}
            >
              {pct >= 20 ? `${pct}%` : ""}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
        {segments.map((seg) => {
          const pct = Math.round((seg.count / total) * 100);
          const isMe = seg.key === myOutcome;
          return (
            <div
              key={seg.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                fontWeight: isMe ? 800 : 600,
                color: isMe ? seg.color : "var(--text-3)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: seg.color,
                  flexShrink: 0,
                }}
              />
              {seg.label} {pct}%{isMe ? " ★" : ""}
            </div>
          );
        })}
        <div style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-3)", fontWeight: 600 }}>
          {total} tip{total !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

// ── Top scores bar chart ───────────────────────────────────────────────────────

function TopScoresChart({
  stats,
  myHome,
  myAway,
}: {
  stats: MatchPredictionStats;
  myHome: number;
  myAway: number;
}) {
  const { top_scores, total } = stats;
  if (!top_scores || top_scores.length === 0) return null;

  const top = top_scores.slice(0, 6);
  const maxCount = Math.max(...top.map((s) => s.count));

  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-3)",
          marginBottom: 6,
        }}
      >
        Top predicted scores
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {top.map((score, i) => {
          const isMe = score.home === myHome && score.away === myAway;
          const barPct = maxCount > 0 ? (score.count / maxCount) * 100 : 0;
          const totalPct = total > 0 ? Math.round((score.count / total) * 100) : 0;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11,
              }}
            >
              {/* Score label */}
              <div
                style={{
                  width: 32,
                  fontFamily: '"Archivo", sans-serif',
                  fontStretch: "125%",
                  fontWeight: 900,
                  fontSize: 11,
                  color: isMe ? "var(--accent, var(--gold))" : "var(--text-2)",
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {score.home}–{score.away}
              </div>
              {/* Bar track */}
              <div
                style={{
                  flex: 1,
                  height: 14,
                  background: "var(--surface-2)",
                  borderRadius: 7,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${barPct}%`,
                    minWidth: barPct > 0 ? 4 : 0,
                    background: isMe
                      ? "var(--accent, var(--gold))"
                      : "color-mix(in oklab, var(--watch) 45%, transparent)",
                    borderRadius: 7,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
              {/* Count + pct */}
              <div
                style={{
                  width: 44,
                  textAlign: "right",
                  fontSize: 10,
                  fontWeight: isMe ? 800 : 600,
                  color: isMe ? "var(--accent, var(--gold))" : "var(--text-3)",
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                }}
              >
                {score.count} · {totalPct}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Distribution charts section ───────────────────────────────────────────────

function DistributionCharts({
  stats,
  prediction,
}: {
  stats: MatchPredictionStats;
  prediction: MatchPrediction;
}) {
  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: "1px solid var(--border)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 16,
      }}
    >
      <OutcomePill stats={stats} myOutcome={prediction.predicted_outcome} />
      <TopScoresChart
        stats={stats}
        myHome={prediction.home_goals}
        myAway={prediction.away_goals}
      />
    </div>
  );
}

// ── Leaderboard bar chart ─────────────────────────────────────────────────────

function LeaderboardBarChart({
  entries,
  currentUserId,
}: {
  entries: LeaderboardEntry[];
  currentUserId: number;
}) {
  if (entries.length === 0) {
    return <div className="empty-day">No leaderboard data yet.</div>;
  }

  const maxPoints = Math.max(...entries.map((e) => e.total_points), 1);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}
    >
      {entries.map((entry, idx) => {
        const isMe = entry.user_id === currentUserId;
        const rank = idx + 1;
        const color = avatarColor(entry.full_name);
        const barPct = Math.max((entry.total_points / maxPoints) * 100, 0);
        const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

        return (
          <div
            key={entry.user_id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderBottom: idx < entries.length - 1 ? "1px solid var(--border)" : "none",
              minHeight: 52,
              background: isMe
                ? "color-mix(in oklab, var(--accent, var(--gold)) 8%, transparent)"
                : "transparent",
            }}
          >
            {/* Rank */}
            <div
              style={{
                width: 28,
                flexShrink: 0,
                textAlign: "center",
                fontFamily: '"Archivo", sans-serif',
                fontStretch: "125%",
                fontWeight: 900,
                fontSize: rankEmoji ? 18 : 13,
                color: rank === 1
                  ? "var(--gold)"
                  : rank <= 3
                  ? "var(--text-2)"
                  : "var(--text-3)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {rankEmoji ?? rank}
            </div>

            {/* Avatar */}
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: isMe
                  ? "linear-gradient(135deg, var(--gold) 0%, var(--together) 100%)"
                  : color,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 800,
                flexShrink: 0,
                fontFamily: '"Archivo", sans-serif',
              }}
            >
              {initials(entry.full_name)}
            </div>

            {/* Name + bar column */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Name */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: isMe ? 700 : 600,
                  color: isMe ? "var(--gold)" : "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1,
                }}
              >
                {entry.full_name}
                {isMe && (
                  <span style={{ color: "var(--text-3)", fontWeight: 500, marginLeft: 4, fontSize: 11 }}>
                    (you)
                  </span>
                )}
              </div>
              {/* Bar track */}
              <div
                style={{
                  height: 8,
                  background: "var(--surface-2)",
                  borderRadius: 4,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: barPct > 0 ? `${barPct}%` : "4px",
                    minWidth: 4,
                    background: isMe
                      ? "var(--accent, var(--gold))"
                      : "color-mix(in oklab, var(--watch) 40%, transparent)",
                    borderRadius: 4,
                    transition: "width 0.4s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isMe) {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "color-mix(in oklab, var(--watch) 65%, transparent)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isMe) {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "color-mix(in oklab, var(--watch) 40%, transparent)";
                    }
                  }}
                />
              </div>
            </div>

            {/* Points + exact label */}
            <div
              style={{
                flexShrink: 0,
                textAlign: "right",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <div
                style={{
                  fontFamily: '"Archivo", sans-serif',
                  fontStretch: "125%",
                  fontWeight: 900,
                  fontSize: 14,
                  color: isMe ? "var(--gold)" : "var(--text)",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {entry.total_points} pts
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: entry.exact_score_count > 0 ? "var(--gold)" : "var(--text-3)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {entry.exact_score_count} exact
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Prediction card ───────────────────────────────────────────────────────────

const POST_KICKOFF_STATES: PredictionState[] = ["tip_locked", "evaluated", "manual_review"];

function PredictionCard({
  prediction,
  match,
  stats,
}: {
  prediction: MatchPrediction;
  match: Match | undefined;
  stats: MatchPredictionStats | undefined;
}) {
  const homeTla = match
    ? (match.home_team_tla ?? match.home_team.slice(0, 3).toUpperCase())
    : "???";
  const awayTla = match
    ? (match.away_team_tla ?? match.away_team.slice(0, 3).toUpperCase())
    : "???";

  const dt = match ? new Date(match.match_datetime) : null;
  const dateStr = dt
    ? dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "";

  const showCharts =
    POST_KICKOFF_STATES.includes(prediction.state) && stats !== undefined && stats.total > 0;

  return (
    <div
      style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Main prediction row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Match info */}
        <div style={{ flex: 1, minWidth: 140 }}>
          <div
            style={{
              fontFamily: '"Archivo", sans-serif',
              fontStretch: "125%",
              fontWeight: 800,
              fontSize: 14,
              color: "var(--text)",
              letterSpacing: "0.01em",
            }}
          >
            {homeTla}
            <span style={{ color: "var(--text-3)", fontWeight: 400, margin: "0 4px", fontSize: 12 }}>
              vs
            </span>
            {awayTla}
          </div>
          {match && (
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginTop: 2 }}>
              {match.stage} · {dateStr}
            </div>
          )}
        </div>

        {/* Predicted score */}
        <div
          style={{
            fontFamily: '"Archivo", sans-serif',
            fontStretch: "125%",
            fontWeight: 900,
            fontSize: 18,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
            flexShrink: 0,
          }}
        >
          {prediction.home_goals}
          <span style={{ color: "var(--text-3)", margin: "0 2px" }}>:</span>
          {prediction.away_goals}
        </div>

        {/* Boost indicator */}
        {prediction.boosted && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--gold)",
              background: "var(--gold-tint)",
              border: "1px solid color-mix(in oklab, var(--gold) 30%, transparent)",
              borderRadius: 20,
              padding: "2px 8px",
              flexShrink: 0,
            }}
          >
            ⚡ Boost
          </span>
        )}

        {/* State badge */}
        <StateBadge state={prediction.state} />

        {/* Points */}
        {prediction.points_awarded !== null && (
          <Points points={prediction.points_awarded} boosted={prediction.boosted} />
        )}
      </div>

      {/* Distribution charts — only post-kickoff */}
      {showCharts && (
        <DistributionCharts stats={stats} prediction={prediction} />
      )}
    </div>
  );
}

// ── Tab IDs ───────────────────────────────────────────────────────────────────

type TabId = "predictions" | "winner" | "group" | "global";

const TABS: { id: TabId; label: string }[] = [
  { id: "predictions", label: "My Predictions" },
  { id: "winner", label: "WC Winner" },
  { id: "group", label: "Group Leaderboard" },
  { id: "global", label: "Global Leaderboard" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export function MyTipsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("predictions");

  // ── Tab 1: Predictions ─────────────────────────────────────────────────────
  const [predictions, setPredictions] = useState<MatchPrediction[]>([]);
  const [matchMap, setMatchMap] = useState<Record<number, Match>>({});
  const [predsLoading, setPredsLoading] = useState(true);
  const [predsError, setPredsError] = useState<string | null>(null);

  // ── Stats map ─────────────────────────────────────────────────────────────
  const [statsMap, setStatsMap] = useState<Record<number, MatchPredictionStats>>({});

  // ── Tab 2: Winner ──────────────────────────────────────────────────────────
  const [winner, setWinner] = useState<WinnerPrediction | null>(null);
  const [winnerLoading, setWinnerLoading] = useState(true);
  const [winnerError, setWinnerError] = useState<string | null>(null);
  const [winnerInput, setWinnerInput] = useState("");
  const [winnerSaving, setWinnerSaving] = useState(false);

  // ── Tab 3: Group leaderboard ───────────────────────────────────────────────
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupLeaderboard, setGroupLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [groupLbLoading, setGroupLbLoading] = useState(false);
  const [groupLbError, setGroupLbError] = useState<string | null>(null);

  // ── Tab 4: Global leaderboard ──────────────────────────────────────────────
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [globalLbLoading, setGlobalLbLoading] = useState(true);
  const [globalLbError, setGlobalLbError] = useState<string | null>(null);

  // ── Load predictions + match data ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPredsLoading(true);
    setPredsError(null);

    const fetchAll = async () => {
      try {
        const [predsRes, matchesRes] = await Promise.all([
          api.get<MatchPrediction[]>("/predictions"),
          api.get<Match[]>("/matches", { params: { page_size: 200 } }),
        ]);
        if (cancelled) return;

        const map: Record<number, Match> = {};
        for (const m of matchesRes.data) map[m.id] = m;

        const sorted = [...predsRes.data].sort((a, b) => {
          const orderDiff = STATE_ORDER[a.state] - STATE_ORDER[b.state];
          if (orderDiff !== 0) return orderDiff;
          const dtA = map[a.match_id]?.match_datetime ?? "";
          const dtB = map[b.match_id]?.match_datetime ?? "";
          return dtA.localeCompare(dtB);
        });

        setPredictions(sorted);
        setMatchMap(map);

        // Lazily fetch stats for post-kickoff predictions
        const eligibleMatchIds = sorted
          .filter((p) => POST_KICKOFF_STATES.includes(p.state))
          .map((p) => p.match_id);

        if (eligibleMatchIds.length > 0) {
          const results = await Promise.allSettled(
            eligibleMatchIds.map((mid) =>
              api
                .get<MatchPredictionStats>(`/predictions/match/${mid}/stats`)
                .then((r) => ({ mid, data: r.data }))
            )
          );
          if (cancelled) return;
          const newMap: Record<number, MatchPredictionStats> = {};
          for (const r of results) {
            if (r.status === "fulfilled") {
              newMap[r.value.mid] = r.value.data;
            }
          }
          setStatsMap(newMap);
        }
      } catch {
        if (!cancelled) setPredsError("Failed to load predictions.");
      } finally {
        if (!cancelled) setPredsLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  // ── Load winner prediction ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setWinnerLoading(true);
    setWinnerError(null);

    api
      .get<WinnerPrediction>("/predictions/winner")
      .then(({ data }) => {
        if (cancelled) return;
        setWinner(data);
        setWinnerInput(data.team_name);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 404) {
          setWinner(null);
        } else {
          setWinnerError("Failed to load winner prediction.");
        }
      })
      .finally(() => {
        if (!cancelled) setWinnerLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // ── Load groups + global leaderboard ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.get<Group[]>("/groups/me"),
      api.get<LeaderboardEntry[]>("/leaderboard/global"),
    ])
      .then(([groupsRes, globalRes]) => {
        if (cancelled) return;
        setGroups(groupsRes.data);
        if (groupsRes.data.length > 0) {
          setSelectedGroupId(groupsRes.data[0].id);
        }
        setGlobalLeaderboard(globalRes.data);
      })
      .catch(() => {
        if (!cancelled) setGlobalLbError("Failed to load leaderboard.");
      })
      .finally(() => {
        if (!cancelled) setGlobalLbLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // ── Load group leaderboard when selectedGroupId changes ─────────────────
  useEffect(() => {
    if (selectedGroupId === null) return;

    let cancelled = false;
    setGroupLbLoading(true);
    setGroupLbError(null);

    api
      .get<LeaderboardEntry[]>(`/leaderboard/group/${selectedGroupId}`)
      .then(({ data }) => {
        if (!cancelled) setGroupLeaderboard(data);
      })
      .catch(() => {
        if (!cancelled) setGroupLbError("Failed to load group leaderboard.");
      })
      .finally(() => {
        if (!cancelled) setGroupLbLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedGroupId]);

  // ── Winner form submit ─────────────────────────────────────────────────────
  const handleWinnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = winnerInput.trim();
    if (!name) return;

    setWinnerSaving(true);
    try {
      const { data } = await api.put<WinnerPrediction>("/predictions/winner", {
        team_name: name,
      });
      setWinner(data);
      setWinnerInput(data.team_name);
    } catch {
      setWinnerError("Failed to save winner prediction.");
    } finally {
      setWinnerSaving(false);
    }
  };

  const winnerReadOnly =
    winner !== null && (winner.locked_at !== null || winner.evaluated_at !== null);

  // Derive flag for currently selected/saved pick
  const currentFlag = teamFlag(winnerInput);
  const savedFlag = winner ? teamFlag(winner.team_name) : "";

  return (
    <div>
      {/* Screen head */}
      <div className="screen-head">
        <div className="screen-title">
          <h1>My Tips</h1>
          {!predsLoading && (
            <span className="count-pill">{predictions.length}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="filter-pills" style={{ marginBottom: 24 }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            className={`filter-pill${activeTab === id ? " active" : ""}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab 1: My Predictions */}
      {activeTab === "predictions" && (
        <div>
          {predsLoading ? (
            <Spinner />
          ) : predsError ? (
            <div className="empty-day" style={{ color: "var(--skip)" }}>{predsError}</div>
          ) : predictions.length === 0 ? (
            <div className="empty-day">No predictions submitted yet.</div>
          ) : (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                overflow: "hidden",
              }}
            >
              {/* Header row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  background: "var(--surface-2)",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.07em",
                  color: "var(--text-3)",
                }}
              >
                <span style={{ flex: 1 }}>Match</span>
                <span>Tip</span>
                <span style={{ minWidth: 60 }}> </span>
                <span style={{ minWidth: 70 }}>Status</span>
                <span style={{ minWidth: 60 }}>Points</span>
              </div>

              {predictions.map((pred) => (
                <PredictionCard
                  key={pred.id}
                  prediction={pred}
                  match={matchMap[pred.match_id]}
                  stats={statsMap[pred.match_id]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: WC Winner ── spectacular redesign */}
      {activeTab === "winner" && (
        <div style={{ maxWidth: 520 }}>
          {winnerLoading ? (
            <Spinner />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ── Hero banner ── */}
              <div
                style={{
                  borderRadius: "var(--radius)",
                  border: "1px solid color-mix(in oklab, var(--gold) 30%, transparent)",
                  background:
                    "radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklab, var(--gold) 18%, transparent), transparent 70%), var(--surface)",
                  overflow: "hidden",
                  position: "relative",
                  padding: "28px 20px 24px",
                }}
              >
                {/* Shimmer line */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background:
                      "linear-gradient(90deg, transparent 0%, var(--gold) 50%, transparent 100%)",
                    opacity: 0.6,
                  }}
                />

                {/* Title */}
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--gold)",
                    opacity: 0.75,
                    marginBottom: 20,
                  }}
                >
                  World Cup 2026 · Winner Prediction
                </div>

                {/* Trophies + flag row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                  }}
                >
                  {/* Left trophy */}
                  <div
                    style={{
                      filter: "drop-shadow(0 4px 16px rgba(255,215,0,0.45))",
                      flexShrink: 0,
                    }}
                  >
                    <TrophySVG size={72} />
                  </div>

                  {/* Center: flag + country */}
                  <div
                    style={{
                      textAlign: "center",
                      flex: 1,
                      minWidth: 120,
                    }}
                  >
                    {winnerInput ? (
                      <>
                        <div
                          style={{
                            fontSize: 72,
                            lineHeight: 1,
                            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.25))",
                            marginBottom: 10,
                          }}
                        >
                          {currentFlag}
                        </div>
                        <div
                          style={{
                            fontFamily: '"Archivo", sans-serif',
                            fontStretch: "125%",
                            fontWeight: 900,
                            fontSize: 22,
                            color: "var(--gold)",
                            letterSpacing: "0.01em",
                            lineHeight: 1.1,
                          }}
                        >
                          {winnerInput}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--text-3)",
                            marginTop: 6,
                            letterSpacing: "0.06em",
                          }}
                        >
                          {winnerReadOnly ? "🔒 Pick locked in" : "★ Your current pick ★"}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 10, opacity: 0.3 }}>
                          🌍
                        </div>
                        <div
                          style={{
                            fontFamily: '"Archivo", sans-serif',
                            fontStretch: "125%",
                            fontWeight: 800,
                            fontSize: 16,
                            color: "var(--text-3)",
                          }}
                        >
                          No pick yet
                        </div>
                        <div
                          style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}
                        >
                          Who will lift the trophy?
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right trophy (mirrored) */}
                  <div
                    style={{
                      filter: "drop-shadow(0 4px 16px rgba(255,215,0,0.45))",
                      flexShrink: 0,
                    }}
                  >
                    <TrophySVG size={72} mirror />
                  </div>
                </div>

                {/* Points badge — when evaluated */}
                {winner?.points_awarded !== null && winner?.points_awarded !== undefined && (
                  <div style={{ textAlign: "center", marginTop: 16 }}>
                    <Points points={winner.points_awarded} />
                  </div>
                )}
              </div>

              {/* ── Error ── */}
              {winnerError && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "color-mix(in oklab, var(--skip) 12%, transparent)",
                    border: "1px solid color-mix(in oklab, var(--skip) 30%, transparent)",
                    borderRadius: "var(--radius-xs)",
                    fontSize: 13,
                    color: "var(--skip)",
                    fontWeight: 600,
                  }}
                >
                  {winnerError}
                </div>
              )}

              {/* ── Form or lock info ── */}
              {winnerReadOnly ? (
                /* Locked state */
                <div
                  className="card"
                  style={{ gap: 12 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{savedFlag}</span>
                    <div>
                      <div
                        style={{
                          fontFamily: '"Archivo", sans-serif',
                          fontStretch: "125%",
                          fontWeight: 900,
                          fontSize: 18,
                          color: "var(--gold)",
                        }}
                      >
                        {winner!.team_name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                        {winner!.evaluated_at
                          ? "Prediction evaluated — final result recorded."
                          : "Your pick is locked. Good luck!"}
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "oklch(0.62 0.16 55)",
                          background: "oklch(0.65 0.18 55 / 0.15)",
                          borderRadius: 20,
                          padding: "3px 10px",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        🔒 Locked
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Editable form */
                <form onSubmit={handleWinnerSubmit} className="card" style={{ gap: 14 }}>
                  <div>
                    <div
                      style={{
                        fontFamily: '"Archivo", sans-serif',
                        fontStretch: "125%",
                        fontWeight: 800,
                        fontSize: 13,
                        color: "var(--text)",
                        marginBottom: 8,
                      }}
                    >
                      {winner ? "Change your pick" : "Choose a team"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>
                      Select the country you think will win the 2026 World Cup.
                      Locked when the knockout stage begins.
                    </div>
                    <CountrySelector
                      value={winnerInput}
                      onChange={setWinnerInput}
                      disabled={winnerSaving}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={winnerSaving || !winnerInput.trim()}
                    className="btn-gold"
                    style={{ alignSelf: "flex-end" }}
                  >
                    {winnerSaving ? "Saving…" : winner ? "Update pick" : "Submit pick"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Group Leaderboard */}
      {activeTab === "group" && (
        <div>
          {groups.length === 0 && !groupLbLoading ? (
            <div className="empty-day">You are not a member of any group yet.</div>
          ) : (
            <>
              {/* Group selector — shown when user is in multiple groups */}
              {groups.length > 1 && (
                <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div className="filter-pills">
                    {groups.map((g) => (
                      <button
                        key={g.id}
                        className={`filter-pill${selectedGroupId === g.id ? " active" : ""}`}
                        onClick={() => setSelectedGroupId(g.id)}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected group heading */}
              {selectedGroupId !== null && groups.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--text-3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}
                  >
                    {groups.find((g) => g.id === selectedGroupId)?.name ?? ""}
                  </div>
                </div>
              )}

              {groupLbLoading ? (
                <Spinner />
              ) : groupLbError ? (
                <div className="empty-day" style={{ color: "var(--skip)" }}>{groupLbError}</div>
              ) : (
                <LeaderboardBarChart
                  entries={groupLeaderboard}
                  currentUserId={user?.id ?? 0}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Tab 4: Global Leaderboard */}
      {activeTab === "global" && (
        <div>
          {globalLbLoading ? (
            <Spinner />
          ) : globalLbError ? (
            <div className="empty-day" style={{ color: "var(--skip)" }}>{globalLbError}</div>
          ) : (
            <LeaderboardBarChart
              entries={globalLeaderboard}
              currentUserId={user?.id ?? 0}
            />
          )}
        </div>
      )}
    </div>
  );
}
