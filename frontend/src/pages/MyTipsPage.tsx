import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
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

const WC2026_TEAMS: string[] = [
  // Hosts
  "Canada", "Mexico", "United States",
  // South America
  "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador",
  "Paraguay", "Peru", "Uruguay", "Venezuela",
  // CONCACAF
  "Costa Rica", "El Salvador", "Honduras", "Jamaica", "Panama",
  // Europe
  "Albania", "Austria", "Belgium", "Croatia", "Czech Republic", "Denmark",
  "England", "France", "Georgia", "Germany", "Greece", "Hungary", "Italy",
  "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Scotland",
  "Serbia", "Slovakia", "Spain", "Switzerland", "Turkey", "Ukraine",
  // Africa
  "Algeria", "Cameroon", "DR Congo", "Egypt", "Ghana", "Ivory Coast",
  "Mali", "Morocco", "Nigeria", "Senegal", "South Africa", "Tanzania", "Tunisia",
  // Asia
  "Australia", "Bahrain", "China", "Indonesia", "Iran", "Iraq", "Japan",
  "Jordan", "Qatar", "Saudi Arabia", "South Korea", "Uzbekistan",
  // Oceania
  "New Zealand",
];

// ── Crest image component — reuses the same URLs as the match cards ───────────

function CrestImg({
  src,
  name,
  size = 40,
  style,
}: {
  src: string | null | undefined;
  name?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          fontSize: Math.round(size * 0.3),
          fontWeight: 700,
          color: "var(--text-3)",
          ...style,
        }}
      >
        {name ? name.slice(0, 2).toUpperCase() : "?"}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{
        objectFit: "contain",
        borderRadius: 4,
        display: "block",
        ...style,
      }}
    />
  );
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
  crestMap,
}: {
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  crestMap: Record<string, string>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = WC2026_TEAMS.includes(value) ? value : null;
  const filtered = query
    ? WC2026_TEAMS.filter((tm) => tm.toLowerCase().includes(query.toLowerCase()))
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
        {selected ? (
          <CrestImg src={crestMap[selected]} name={selected} size={28} style={{ flexShrink: 0 }} />
        ) : (
          <span style={{ fontSize: 20, lineHeight: 1 }}>🌍</span>
        )}
        <span style={{ flex: 1 }}>
          {selected ?? t("tips.wcDescription")}
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
              placeholder={t("tips.wcSearch")}
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
                {t("tips.wcNoTeam")}
              </div>
            ) : (
              filtered.map((tm) => (
                <button
                  key={tm}
                  type="button"
                  onClick={() => {
                    onChange(tm);
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
                    background: tm === value
                      ? "color-mix(in oklab, var(--gold) 12%, transparent)"
                      : "transparent",
                    color: tm === value ? "var(--gold)" : "var(--text)",
                    fontSize: 13,
                    fontWeight: tm === value ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "left" as const,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (tm !== value)
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (tm !== value)
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <CrestImg src={crestMap[tm]} name={tm} size={24} style={{ flexShrink: 0 }} />
                  <span>{tm}</span>
                  {tm === value && (
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

function dicebearUrl(seed: number | string): string {
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}`;
}

const STATE_ORDER: Record<PredictionState, number> = {
  tip_available: 0,
  tip_locked: 1,
  manual_review: 2,
  evaluated: 3,
};

// ── State badge ───────────────────────────────────────────────────────────────

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
  const { t } = useTranslation();

  const STATE_LABEL: Record<PredictionState, string> = {
    tip_available: t("tips.open"),
    tip_locked: t("tips.locked"),
    manual_review: t("tips.review"),
    evaluated: t("tips.evaluated"),
  };

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

// ── Outcome distribution widget ───────────────────────────────────────────────

function DistributionCharts({
  stats,
  prediction,
}: {
  stats: MatchPredictionStats;
  prediction: MatchPrediction;
}) {
  const { t } = useTranslation();
  const { outcome_counts, total } = stats;
  if (total === 0) return null;

  const myOutcome = prediction.predicted_outcome;
  const outcomes = [
    { key: "home_win" as const, label: t("prediction.homeWin"), count: outcome_counts.home_win },
    { key: "draw" as const, label: t("prediction.draw"), count: outcome_counts.draw },
    { key: "away_win" as const, label: t("prediction.awayWin"), count: outcome_counts.away_win },
  ];
  const maxCount = Math.max(...outcomes.map((o) => o.count), 1);

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          color: "var(--text-3)",
          marginBottom: 10,
        }}
      >
        {t("tips.othersPicks")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {outcomes.map(({ key, label, count }) => {
          const isMe = key === myOutcome;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const barW = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 64,
                  fontSize: 10,
                  fontWeight: isMe ? 800 : 600,
                  color: isMe ? "var(--gold)" : "var(--text-3)",
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  flex: 1,
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
                    width: `${barW}%`,
                    minWidth: count > 0 ? 4 : 0,
                    background: isMe
                      ? "var(--gold)"
                      : "color-mix(in oklab, var(--watch) 50%, transparent)",
                    borderRadius: 4,
                    transition: "width 0.35s ease",
                    boxShadow: isMe
                      ? "0 0 8px color-mix(in oklab, var(--gold) 45%, transparent)"
                      : "none",
                  }}
                />
              </div>
              <div
                style={{
                  width: 30,
                  fontSize: 10,
                  fontWeight: isMe ? 800 : 500,
                  color: isMe ? "var(--gold)" : "var(--text-3)",
                  textAlign: "right",
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {pct}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stadium Trophy Stage ──────────────────────────────────────────────────────

const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SEAT_HEIGHTS = { 1: 224, 2: 162, 3: 132 } as const;
const SEAT_ACCENT = {
  1: { fg: "#FFD700", dim: "#b8860b", glow: "rgba(255,215,0,0.4)",    topBg: "linear-gradient(180deg,#ffe066 0%,#cc9900 100%)",  frontBg: "linear-gradient(180deg,#1a1400 0%,#0d0a00 100%)" },
  2: { fg: "#C8C8C8", dim: "#888888", glow: "rgba(200,200,200,0.25)", topBg: "linear-gradient(180deg,#e0e0e0 0%,#909090 100%)",  frontBg: "linear-gradient(180deg,#1a1a1a 0%,#0d0d0d 100%)" },
  3: { fg: "#CD7F32", dim: "#7a4a1e", glow: "rgba(205,127,50,0.25)",  topBg: "linear-gradient(180deg,#d4924a 0%,#7a4a1e 100%)",  frontBg: "linear-gradient(180deg,#1a0e05 0%,#0d0700 100%)" },
} as const;
const MEDALLION_GRAD = {
  1: "conic-gradient(from 0deg,#8b6914 0deg,#ffd700 45deg,#fff3a0 90deg,#ffd700 135deg,#8b6914 180deg,#ffd700 225deg,#fff3a0 270deg,#ffd700 315deg,#8b6914 360deg)",
  2: "conic-gradient(from 0deg,#666 0deg,#ccc 45deg,#fff 90deg,#ccc 135deg,#666 180deg,#ccc 225deg,#fff 270deg,#ccc 315deg,#666 360deg)",
  3: "conic-gradient(from 0deg,#5a3010 0deg,#cd7f32 45deg,#eaac70 90deg,#cd7f32 135deg,#5a3010 180deg,#cd7f32 225deg,#eaac70 270deg,#cd7f32 315deg,#5a3010 360deg)",
} as const;
const RANK_MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" } as const;

const PODIUM_CSS = `
@keyframes pdm-rise {
  from { transform: translateY(56px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes pdm-pop {
  0%   { transform: scale(0.4); opacity: 0; }
  65%  { transform: scale(1.1); }
  100% { transform: scale(1);   opacity: 1; }
}
@keyframes pdm-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}
@keyframes pdm-halo {
  0%, 100% { opacity: 0.5;  transform: scale(1); }
  50%      { opacity: 0.85; transform: scale(1.1); }
}
@keyframes pdm-confetti {
  0%   { transform: translateY(0) rotate(0deg);       opacity: 1; }
  100% { transform: translateY(220px) rotate(720deg); opacity: 0; }
}
@media (max-width: 719px) {
  .pdm-stage { transform: scale(0.86); transform-origin: bottom center; }
}
`;

const CONFETTI_PAL = ["#FFD700","#FF6347","#4FC3F7","#81C784","#CE93D8","#FFB74D","#F48FB1","#80DEEA"];
const CONFETTI_PIECES = Array.from({ length: 44 }, (_, i) => ({
  id: i,
  left: 3 + (i / 43) * 94,
  delay: Math.abs(Math.sin(i * 1.7)) * 0.5,
  dur:   0.7 + Math.abs(Math.cos(i * 2.3)) * 0.6,
  color: CONFETTI_PAL[i % CONFETTI_PAL.length],
  w: 5 + (i % 5),
  h: 3 + (i % 3),
}));

function ConfettiBurst() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 10 }}>
      {CONFETTI_PIECES.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: 2,
            opacity: 0,
            animation: `pdm-confetti ${p.dur}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

function PodiumSeat({
  entry,
  rank,
  isMe,
}: {
  entry: LeaderboardEntry;
  rank: 1 | 2 | 3;
  isMe: boolean;
}) {
  const { t } = useTranslation();
  const acc = SEAT_ACCENT[rank];
  const h = SEAT_HEIGHTS[rank];
  const riseDelay = rank === 1 ? 0.55 : rank === 2 ? 0.30 : 0.10;
  const popDelay  = rank === 1 ? 0.95 : rank === 2 ? 0.72 : 0.52;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: rank === 1 ? "0 0 38%" : "0 0 31%",
        minWidth: 0,
      }}
    >
      {/* Person */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 5,
          paddingBottom: 10,
          animation: reducedMotion ? undefined : `pdm-pop 0.45s cubic-bezier(.22,.9,.36,1) ${popDelay}s both`,
        }}
      >
        <div style={{ position: "relative" }}>
          {rank === 1 && (
            <div
              style={{
                position: "absolute",
                inset: -10,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${acc.glow} 0%, transparent 70%)`,
                animation: reducedMotion ? undefined : "pdm-halo 1.8s ease-in-out 1.4s infinite",
                pointerEvents: "none",
              }}
            />
          )}
          <div
            style={{
              borderRadius: "50%",
              padding: rank === 1 ? 3 : 2,
              background: `linear-gradient(135deg, ${acc.fg}, ${acc.dim})`,
              boxShadow: `0 0 ${rank === 1 ? 18 : 8}px ${acc.glow}`,
              animation: rank === 1 && !reducedMotion ? "pdm-bob 2.4s ease-in-out 1.4s infinite" : undefined,
            }}
          >
            <img
              src={dicebearUrl(entry.user_id)}
              alt={entry.full_name}
              style={{
                width: rank === 1 ? 64 : 48,
                height: rank === 1 ? 64 : 48,
                borderRadius: "50%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
          {rank === 1 && (
            <div
              style={{
                position: "absolute",
                top: -20,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 18,
                filter: "drop-shadow(0 0 8px #FFD700)",
                lineHeight: 1,
                pointerEvents: "none",
              }}
            >
              👑
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: rank === 1 ? 12 : 11,
            fontWeight: 700,
            color: isMe ? "var(--gold)" : "#c8d4e8",
            textAlign: "center",
            maxWidth: rank === 1 ? 104 : 84,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.2,
          }}
        >
          {entry.full_name}
          {isMe && (
            <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 500, marginLeft: 3, fontSize: 10 }}>
              {t("common.you")}
            </span>
          )}
        </div>

        <div
          style={{
            fontFamily: '"Archivo", sans-serif',
            fontStretch: "125%",
            fontWeight: 900,
            fontSize: rank === 1 ? 16 : 13,
            color: acc.fg,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {entry.total_points} pts
        </div>

        {entry.exact_score_count > 0 && (
          <div style={{ fontSize: 9, fontWeight: 700, color: "#FFD700", fontVariantNumeric: "tabular-nums" }}>
            {entry.exact_score_count} {t("tips.exact")}
          </div>
        )}
      </div>

      {/* Pedestal */}
      <div
        style={{
          width: "100%",
          animation: reducedMotion ? undefined : `pdm-rise 0.55s cubic-bezier(.22,.9,.36,1) ${riseDelay}s both`,
        }}
      >
        {/* Top face — 3D lid */}
        <div
          style={{
            height: 18,
            background: acc.topBg,
            borderRadius: "4px 4px 0 0",
            transform: "perspective(220px) rotateX(64deg)",
            transformOrigin: "bottom center",
            marginBottom: -2,
          }}
        />
        {/* Front face */}
        <div
          style={{
            height: h,
            background: acc.frontBg,
            border: `1px solid color-mix(in oklab, ${acc.fg} 18%, transparent)`,
            borderTop: "none",
            borderRadius: "0 0 4px 4px",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Ghost numeral */}
          <div
            style={{
              position: "absolute",
              fontSize: Math.round(h * 0.65),
              fontFamily: '"Archivo", sans-serif',
              fontStretch: "125%",
              fontWeight: 900,
              color: "white",
              opacity: 0.05,
              lineHeight: 1,
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            {rank}
          </div>
          {/* Medallion */}
          <div
            style={{
              width: rank === 1 ? 52 : 40,
              height: rank === 1 ? 52 : 40,
              borderRadius: "50%",
              background: MEDALLION_GRAD[rank],
              boxShadow: `0 0 16px ${acc.glow}, inset 0 1px 2px rgba(255,255,255,0.2)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: rank === 1 ? 22 : 18,
              flexShrink: 0,
            }}
          >
            {RANK_MEDAL[rank]}
          </div>
        </div>
      </div>
    </div>
  );
}

function StadiumPodium({
  top3,
  currentUserId,
  hasBelow,
}: {
  top3: LeaderboardEntry[];
  currentUserId: number;
  hasBelow: boolean;
}) {
  const [replayKey, setReplayKey] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowConfetti(true), 1400);
    const t2 = setTimeout(() => setShowConfetti(false), 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [replayKey]);

  if (top3.length === 0) return null;

  const slots: { entry: LeaderboardEntry; rank: 1 | 2 | 3 }[] = [];
  if (top3[1]) slots.push({ entry: top3[1], rank: 2 });
  slots.push({ entry: top3[0], rank: 1 });
  if (top3[2]) slots.push({ entry: top3[2], rank: 3 });

  return (
    <>
      <style>{PODIUM_CSS}</style>
      <div
        key={replayKey}
        className="pdm-stage"
        style={{
          position: "relative",
          background: "linear-gradient(180deg,#111820 0%,#0d131c 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderBottom: hasBelow ? "none" : undefined,
          borderRadius: hasBelow ? "var(--radius) var(--radius) 0 0" : "var(--radius)",
          overflow: "hidden",
          padding: "24px 12px 0",
        }}
      >
        {/* Light beams */}
        {([
          { left: "18%", opacity: 0.10 },
          { left: "50%", opacity: 0.16 },
          { left: "82%", opacity: 0.10 },
        ] as const).map((beam, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: beam.left,
              transform: "translateX(-50%)",
              width: 120,
              height: "100%",
              background: `linear-gradient(180deg,rgba(255,255,255,${beam.opacity}) 0%,transparent 75%)`,
              filter: "blur(28px)",
              pointerEvents: "none",
            }}
          />
        ))}

        {/* Replay button */}
        <button
          onClick={() => setReplayKey((k) => k + 1)}
          title="Replay"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.5)",
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.13)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)")}
        >
          ↺
        </button>

        {showConfetti && !reducedMotion && <ConfettiBurst />}

        {/* Podium row */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, perspective: "1300px" }}>
          {slots.map(({ entry, rank }) => (
            <PodiumSeat
              key={entry.user_id}
              entry={entry}
              rank={rank}
              isMe={entry.user_id === currentUserId}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function LeaderboardBarChart({
  entries,
  currentUserId,
}: {
  entries: LeaderboardEntry[];
  currentUserId: number;
}) {
  const { t } = useTranslation();

  if (entries.length === 0) {
    return <div className="empty-day">{t("tips.noLeaderboardData")}</div>;
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const maxPoints = Math.max(...entries.map((e) => e.total_points), 1);

  return (
    <div>
      <StadiumPodium top3={top3} currentUserId={currentUserId} hasBelow={rest.length > 0} />

      {/* 4th place and below */}
      {rest.length > 0 && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderTop: "none",
            borderRadius: "0 0 var(--radius) var(--radius)",
            overflow: "hidden",
          }}
        >
          {rest.map((entry, idx) => {
            const isMe = entry.user_id === currentUserId;
            const rank = idx + 4;
            const barPct = Math.max((entry.total_points / maxPoints) * 100, 0);

            return (
              <div
                key={entry.user_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderBottom: idx < rest.length - 1 ? "1px solid var(--border)" : "none",
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
                    fontSize: 13,
                    color: "var(--text-3)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {rank}
                </div>

                {/* Avatar */}
                <img
                  src={dicebearUrl(entry.user_id)}
                  alt={entry.full_name}
                  style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }}
                />

                {/* Name + bar */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
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
                        {t("common.you")}
                      </span>
                    )}
                  </div>
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
                    />
                  </div>
                </div>

                {/* Points */}
                <div style={{ flexShrink: 0, textAlign: "right", display: "flex", flexDirection: "column", gap: 1 }}>
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
                    {entry.exact_score_count} {t("tips.exact")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const COL = {
  score:  56,  // "Tip / Result" — wide enough to stack two scores
  boost:  76,
  status: 88,
  points: 68,
} as const;

// ── Prediction card ───────────────────────────────────────────────────────────

function PredictionCard({
  prediction,
  match,
  stats,
}: {
  prediction: MatchPrediction;
  match: Match | undefined;
  stats: MatchPredictionStats | undefined;
}) {
  const { t } = useTranslation();

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

  const showCharts = stats !== undefined && stats.total > 0;

  const hasResult = match && match.home_score !== null && match.away_score !== null;

  return (
    <div
      style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Main prediction row */}
      <div className="pred-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Match info */}
        <Link
          className="pred-match-col"
          to={match ? `/matches/${match.id}` : "#"}
          style={{ flex: 1, minWidth: 0, textDecoration: "none" }}
        >
          <div
            style={{
              fontFamily: '"Archivo", sans-serif',
              fontStretch: "125%",
              fontWeight: 800,
              fontSize: 14,
              color: "var(--text)",
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {homeTla}
            <span style={{ color: "var(--text-3)", fontWeight: 400, margin: "0 4px", fontSize: 12 }}>
              vs
            </span>
            {awayTla}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {match ? `${match.stage} · ${dateStr}` : ""}
            {hasResult && (
              <span style={{ color: "var(--text-2)", marginLeft: 6 }}>
                · FT {match!.home_score}–{match!.away_score}
              </span>
            )}
          </div>
        </Link>

        {/* Predicted score + actual result stacked */}
        <div
          className="pred-score-col"
          style={{
            width: COL.score,
            flexShrink: 0,
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <div
            style={{
              fontFamily: '"Archivo", sans-serif',
              fontStretch: "125%",
              fontWeight: 900,
              fontSize: 18,
              color: "var(--text)",
              letterSpacing: "-0.01em",
            }}
          >
            {prediction.home_goals}
            <span style={{ color: "var(--text-3)", margin: "0 1px" }}>:</span>
            {prediction.away_goals}
          </div>
          {hasResult && (
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginTop: 1, letterSpacing: "0.02em" }}>
              {match!.home_score}–{match!.away_score}
            </div>
          )}
        </div>

        {/* Boost indicator */}
        <div className="pred-boost-col" style={{ width: COL.boost, flexShrink: 0, display: "flex", alignItems: "center" }}>
          <span
            style={{
              visibility: prediction.boosted ? "visible" : "hidden",
              fontSize: 11,
              fontWeight: 800,
              color: "var(--gold)",
              background: "var(--gold-tint)",
              border: "1px solid color-mix(in oklab, var(--gold) 30%, transparent)",
              borderRadius: 20,
              padding: "2px 8px",
              whiteSpace: "nowrap",
            }}
          >
            {t("tips.boost")}
          </span>
        </div>

        {/* State badge */}
        <div className="pred-status-col" style={{ width: COL.status, flexShrink: 0 }}>
          <StateBadge state={prediction.state} />
        </div>

        {/* Points */}
        <div className="pred-points-col" style={{ width: COL.points, flexShrink: 0, textAlign: "right" }}>
          {prediction.points_awarded !== null && (
            <Points points={prediction.points_awarded} boosted={prediction.boosted} />
          )}
        </div>
      </div>

      {/* Distribution charts — visible as soon as any prediction exists for this match */}
      {showCharts && (
        <DistributionCharts
          stats={stats}
          prediction={prediction}
        />
      )}
    </div>
  );
}

// ── Tab IDs ───────────────────────────────────────────────────────────────────

type TabId = "predictions" | "winner" | "group" | "global";

// ── Page ──────────────────────────────────────────────────────────────────────

export function MyTipsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
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

        // Fetch stats for all predictions (aggregate only, no user names exposed)
        const eligibleMatchIds = sorted.map((p) => p.match_id);

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
        if (!cancelled) setPredsError(t("tips.failedPredictions"));
      } finally {
        if (!cancelled) setPredsLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          setWinnerError(t("tips.failedPredictions"));
        }
      })
      .finally(() => {
        if (!cancelled) setWinnerLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (!cancelled) setGlobalLbError(t("tips.failedLeaderboard"));
      })
      .finally(() => {
        if (!cancelled) setGlobalLbLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (!cancelled) setGroupLbError(t("tips.failedGroupLeaderboard"));
      })
      .finally(() => {
        if (!cancelled) setGroupLbLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  // ── Winner form submit ─────────────────────────────────────────────────────
  const handleWinnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = winnerInput.trim();
    if (!name) return;

    setWinnerError(null);
    setWinnerSaving(true);
    try {
      const { data } = await api.put<WinnerPrediction>("/predictions/winner", {
        team_name: name,
      });
      setWinner(data);
      setWinnerInput(data.team_name);
      showToast(`Pick saved: ${data.team_name} 🏆`);
    } catch {
      setWinnerError(t("tips.failedPredictions"));
    } finally {
      setWinnerSaving(false);
    }
  };

  const winnerReadOnly =
    winner !== null && (winner.locked_at !== null || winner.evaluated_at !== null);

  // Build crestMap from all loaded match data (same source as match cards)
  const crestMap: Record<string, string> = {};
  for (const m of Object.values(matchMap)) {
    if (m.home_team_crest) crestMap[m.home_team] = m.home_team_crest;
    if (m.away_team_crest) crestMap[m.away_team] = m.away_team_crest;
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: "predictions", label: t("tips.tabMyPredictions") },
    { id: "winner", label: t("tips.tabWCWinner") },
    { id: "group", label: t("tips.tabGroupLeaderboard") },
    { id: "global", label: t("tips.tabGlobalLeaderboard") },
  ];

  return (
    <div>
      {/* Screen head */}
      <div className="screen-head">
        <div className="screen-title">
          <h1>{t("tips.pageTitle")}</h1>
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
            <div className="empty-day">{t("tips.noPredictions")}</div>
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
                className="pred-header"
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
                <span style={{ flex: 1 }}>{t("tips.colMatch")}</span>
                <span style={{ width: COL.score, flexShrink: 0, textAlign: "center" }}>{t("tips.colTip")}</span>
                <span style={{ width: COL.boost, flexShrink: 0 }}></span>
                <span style={{ width: COL.status, flexShrink: 0 }}>{t("tips.colStatus")}</span>
                <span style={{ width: COL.points, flexShrink: 0, textAlign: "right" }}>{t("tips.colPoints")}</span>
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
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
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
                  {t("tips.wcTitle")}
                </div>

                {/* Trophies + flag row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  {/* Left trophy */}
                  <div
                    style={{
                      filter: "drop-shadow(0 4px 16px rgba(255,215,0,0.45))",
                      flexShrink: 0,
                    }}
                  >
                    <TrophySVG size={60} />
                  </div>

                  {/* Center: flag + country */}
                  <div
                    style={{
                      textAlign: "center",
                      flex: "1 1 100px",
                      minWidth: 0,
                    }}
                  >
                    {winnerInput ? (
                      <>
                        <div
                          style={{
                            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.25))",
                            marginBottom: 10,
                            display: "flex",
                            justifyContent: "center",
                          }}
                        >
                          <CrestImg src={crestMap[winnerInput]} name={winnerInput} size={80} />
                        </div>
                        <div
                          style={{
                            fontFamily: '"Archivo", sans-serif',
                            fontStretch: "125%",
                            fontWeight: 900,
                            fontSize: 18,
                            color: "var(--gold)",
                            letterSpacing: "0.01em",
                            lineHeight: 1.1,
                            wordBreak: "break-word",
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
                          {winnerReadOnly ? t("tips.wcPickLocked") : t("tips.wcCurrentPick")}
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
                          {t("tips.wcNoPick")}
                        </div>
                        <div
                          style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}
                        >
                          {t("tips.wcWhoWins")}
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
                    <TrophySVG size={60} mirror />
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
                    <CrestImg src={winner?.team_name ? crestMap[winner.team_name] : null} name={winner?.team_name} size={42} />
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
                          ? t("tips.wcEvaluated")
                          : t("tips.wcPickLockedMsg")}
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
                        {t("tips.wcLocked")}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Editable form */
                <form onSubmit={handleWinnerSubmit} className="card" style={{ gap: 14, overflow: "visible" }}>
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
                      {winner ? t("tips.wcChange") : t("tips.wcChoose")}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>
                      {t("tips.wcDescription")}
                    </div>
                    <CountrySelector
                      value={winnerInput}
                      onChange={setWinnerInput}
                      disabled={winnerSaving}
                      crestMap={crestMap}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={winnerSaving || !winnerInput.trim()}
                    className="btn-gold"
                    style={{ alignSelf: "flex-end" }}
                  >
                    {winnerSaving
                      ? t("common.saving")
                      : winner
                      ? t("tips.wcUpdate")
                      : t("tips.wcSubmit")}
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
            <div className="empty-day">{t("tips.notInGroup")}</div>
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
