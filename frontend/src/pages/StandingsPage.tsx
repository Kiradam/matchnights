import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import type { BestThirdRow, GroupMatch, GroupStanding, StandingsData, TeamRow } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function FlagImg({ src, alt, tla }: { src: string | null; alt: string; tla: string | null }) {
  const [failed, setFailed] = useState(false);
  const label = tla ?? alt.slice(0, 3).toUpperCase();
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        style={{ width: 20, height: 20, objectFit: "contain", flexShrink: 0 }}
      />
    );
  }
  return (
    <span style={{
      width: 20, height: 20, display: "inline-flex", alignItems: "center",
      justifyContent: "center", fontSize: 9, fontWeight: 800,
      color: "var(--text-3)", flexShrink: 0,
      fontFamily: "'Archivo', sans-serif", fontStretch: "125%",
    }}>
      {label}
    </span>
  );
}

function statusColor(s: TeamRow["status"]): string {
  if (s === "qualified") return "var(--together)";
  if (s === "eliminated" || s === "out") return "var(--skip)";
  return "transparent";
}

function statusBg(s: TeamRow["status"]): string {
  if (s === "qualified") return "color-mix(in oklab, var(--together) 8%, transparent)";
  if (s === "eliminated" || s === "out") return "color-mix(in oklab, var(--skip) 6%, transparent)";
  return "transparent";
}

function gd(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function fmtTime(dt: string, locale: string): string {
  return new Date(dt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(dt: string, locale: string): string {
  return new Date(dt).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

// ── Group match list ──────────────────────────────────────────────────────────

function GroupMatchList({ matches, locale }: { matches: GroupMatch[]; locale: string }) {
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
      {matches.map((m) => {
        const finished = m.status === "finished" && m.home_score != null && m.away_score != null;
        return (
          <Link
            key={m.id}
            to={`/matches/${m.id}`}
            style={{ textDecoration: "none" }}
          >
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: 6,
              padding: "5px 8px",
              borderRadius: 6,
              background: "var(--surface-2)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.12s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "color-mix(in oklab, var(--border) 40%, var(--surface-2))")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--surface-2)")}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                <span style={{ color: "var(--text-2)" }}>{m.home_team_tla ?? m.home_team.slice(0, 3).toUpperCase()}</span>
                <FlagImg src={m.home_team_crest} alt={m.home_team} tla={m.home_team_tla} />
              </span>
              <span style={{
                fontFamily: "'Archivo', sans-serif", fontStretch: "125%", fontWeight: 900,
                fontSize: finished ? 13 : 10,
                color: finished ? "var(--text)" : "var(--text-3)",
                minWidth: 44, textAlign: "center",
              }}>
                {finished ? `${m.home_score}–${m.away_score}` : `${fmtDate(m.match_datetime, locale)} ${fmtTime(m.match_datetime, locale)}`}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <FlagImg src={m.away_team_crest} alt={m.away_team} tla={m.away_team_tla} />
                <span style={{ color: "var(--text-2)" }}>{m.away_team_tla ?? m.away_team.slice(0, 3).toUpperCase()}</span>
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Group card ────────────────────────────────────────────────────────────────

function GroupCard({ group }: { group: GroupStanding }) {
  const { i18n, t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const locale = i18n.language === "hu" ? "hu-HU" : "en-GB";
  const letter = group.name.replace("Group ", "");

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: "'Archivo', sans-serif", fontStretch: "125%", fontWeight: 900,
            fontSize: 15, color: "var(--text)",
          }}>
            {t("standings.group")} {letter}
          </span>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-3)", fontSize: 11, fontWeight: 700,
            padding: "2px 6px", borderRadius: 4,
          }}
        >
          {expanded ? t("standings.hideMatches") : t("standings.showMatches")}
        </button>
      </div>

      {/* Table */}
      <div style={{ padding: "0 0 4px" }}>
        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "20px 1fr 24px 24px 24px 24px 34px 30px",
          gap: 2,
          padding: "6px 10px 4px",
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-3)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}>
          <span></span>
          <span></span>
          <span style={{ textAlign: "center" }}>P</span>
          <span style={{ textAlign: "center" }}>W</span>
          <span style={{ textAlign: "center" }}>D</span>
          <span style={{ textAlign: "center" }}>L</span>
          <span style={{ textAlign: "center" }}>GD</span>
          <span style={{ textAlign: "center" }}>Pts</span>
        </div>

        {group.table.map((row) => (
          <div
            key={row.team}
            style={{
              display: "grid",
              gridTemplateColumns: "20px 1fr 24px 24px 24px 24px 34px 30px",
              gap: 2,
              alignItems: "center",
              padding: "5px 10px",
              background: statusBg(row.status),
              borderLeft: `3px solid ${statusColor(row.status)}`,
              marginLeft: 0,
              transition: "background 0.15s",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textAlign: "center" }}>
              {row.position}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <FlagImg src={row.crest} alt={row.team} tla={row.tla} />
              <span style={{
                fontSize: 12, fontWeight: 700, color: "var(--text)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {row.tla ?? row.team.slice(0, 3).toUpperCase()}
              </span>
            </span>
            {[row.played, row.won, row.drawn, row.lost].map((n, i) => (
              <span key={i} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", textAlign: "center" }}>{n}</span>
            ))}
            <span style={{
              fontSize: 12, fontWeight: 700, textAlign: "center",
              color: row.gd > 0 ? "var(--together)" : row.gd < 0 ? "var(--skip)" : "var(--text-3)",
            }}>
              {gd(row.gd)}
            </span>
            <span style={{
              fontSize: 13, fontWeight: 900, textAlign: "center",
              fontFamily: "'Archivo', sans-serif", fontStretch: "125%",
              color: "var(--text)",
            }}>
              {row.points}
            </span>
          </div>
        ))}

        {expanded && <GroupMatchList matches={group.matches} locale={locale} />}
      </div>
    </div>
  );
}

// ── Best third section ────────────────────────────────────────────────────────

function BestThird({ rows }: { rows: BestThirdRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;

  const cutoffIdx = rows.findIndex(r => !r.advances);
  const cutoff = cutoffIdx === -1 ? null : cutoffIdx;

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", overflow: "hidden", marginTop: 24,
    }}>
      <div style={{
        padding: "10px 14px", borderBottom: "1px solid var(--border)",
        background: "var(--surface-2)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          fontFamily: "'Archivo', sans-serif", fontStretch: "125%",
          fontWeight: 900, fontSize: 15, color: "var(--text)",
        }}>
          {t("standings.bestThird")}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>
          {t("standings.bestThirdNote")}
        </span>
      </div>

      <div style={{ padding: "0 0 4px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "24px 1fr 24px 34px 30px",
          gap: 2,
          padding: "6px 10px 4px",
          fontSize: 10, fontWeight: 700, color: "var(--text-3)",
          letterSpacing: "0.05em", textTransform: "uppercase",
        }}>
          <span></span><span></span>
          <span style={{ textAlign: "center" }}>P</span>
          <span style={{ textAlign: "center" }}>GD</span>
          <span style={{ textAlign: "center" }}>Pts</span>
        </div>

        {rows.map((row, i) => (
          <div key={row.group}>
            {cutoff !== null && i === cutoff && (
              <div style={{
                height: 2, margin: "2px 10px",
                background: "color-mix(in oklab, var(--gold) 50%, transparent)",
                borderRadius: 1,
              }} />
            )}
            <div style={{
              display: "grid",
              gridTemplateColumns: "24px 1fr 24px 34px 30px",
              gap: 2, alignItems: "center",
              padding: "5px 10px",
              background: row.advances
                ? "color-mix(in oklab, var(--gold) 8%, transparent)"
                : "transparent",
              borderLeft: `3px solid ${row.advances ? "var(--gold)" : "transparent"}`,
              opacity: row.advances ? 1 : 0.55,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textAlign: "center" }}>
                {row.group.replace("Group ", "")}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FlagImg src={row.crest} alt={row.team} tla={row.tla} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  {row.tla ?? row.team.slice(0, 3).toUpperCase()}
                </span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", textAlign: "center" }}>{row.played}</span>
              <span style={{
                fontSize: 12, fontWeight: 700, textAlign: "center",
                color: row.gd > 0 ? "var(--together)" : row.gd < 0 ? "var(--skip)" : "var(--text-3)",
              }}>
                {gd(row.gd)}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 900, textAlign: "center",
                fontFamily: "'Archivo', sans-serif", fontStretch: "125%",
                color: "var(--text)",
              }}>
                {row.points}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function StandingsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<StandingsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get<StandingsData>("/standings")
      .then(r => setData(r.data))
      .catch(() => setError(true));
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 48px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: "'Archivo', sans-serif", fontStretch: "125%",
          fontWeight: 900, fontSize: 26, color: "var(--text)", margin: 0,
        }}>
          {t("standings.title")}
        </h1>
        <div style={{ display: "flex", gap: 20, marginTop: 10, flexWrap: "wrap" }}>
          {(["qualified", "in_play", "eliminated"] as const).map(s => (
            <span key={s} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
              <span style={{
                width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                background: s === "qualified" ? "var(--together)" : s === "eliminated" ? "var(--skip)" : "var(--border-strong)",
              }} />
              {t(`standings.legend.${s}`)}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ color: "var(--skip)", fontWeight: 600, fontSize: 14 }}>
          {t("standings.error")}
        </div>
      )}

      {!data && !error && (
        <div style={{ color: "var(--text-3)", fontWeight: 600, fontSize: 14 }}>
          {t("common.loading")}
        </div>
      )}

      {data && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}>
            {data.groups.map(g => <GroupCard key={g.name} group={g} />)}
          </div>
          <BestThird rows={data.best_third} />
        </>
      )}
    </div>
  );
}
