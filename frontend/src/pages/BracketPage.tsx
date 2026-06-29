import { useEffect, useMemo, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import type { BracketData, BracketMatch, BracketTeam } from "../types";

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_W = 156;
const NODE_H = 58;
const PITCH = 74;          // vertical slot pitch for the Round of 32
const COL_GAP = 64;
const COL_STEP = NODE_W + COL_GAP;
const TOP_PAD = 48;        // room for round headers

const COLUMNS = ["r32", "r16", "qf", "sf", "final"] as const;
const ROUND_INDEX: Record<string, number> = { r32: 0, r16: 1, qf: 2, sf: 3, final: 4, third: 4 };

interface Node {
  match: BracketMatch;
  x: number;
  y: number;
  col: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function teamLabel(t: BracketTeam): string {
  if (t.is_tbd) return "TBD";
  return t.tla ?? t.name.slice(0, 3).toUpperCase();
}

function Crest({ src, name, dim }: { src: string | null; name: string; dim: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span style={{
        width: 18, height: 18, flexShrink: 0, borderRadius: 3,
        background: "var(--surface-3)", display: "inline-flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 8, fontWeight: 800, color: "var(--text-3)",
        opacity: dim ? 0.5 : 1,
      }}>
        {name === "TBD" ? "" : name.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <img src={src} alt={name} onError={() => setFailed(true)}
      style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0, opacity: dim ? 0.5 : 1 }} />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function BracketPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<BracketData | null>(null);
  const [error, setError] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [initialScale, setInitialScale] = useState(0.5);

  useEffect(() => {
    api.get<BracketData>("/bracket").then(r => setData(r.data)).catch(() => setError(true));
  }, []);

  const roundByKey = useMemo(() => {
    const map: Record<string, BracketMatch[]> = {};
    for (const r of data?.rounds ?? []) map[r.key] = r.matches;
    return map;
  }, [data]);

  // Positional binary-tree layout: each parent sits centred between its two children.
  const { nodes, nodeById, width, height } = useMemo(() => {
    const nodeById: Record<number, Node> = {};
    const nodes: Node[] = [];

    const r32 = roundByKey.r32 ?? [];
    r32.forEach((m, i) => {
      const n: Node = { match: m, x: 0, y: TOP_PAD + i * PITCH, col: 0 };
      nodes.push(n);
      nodeById[m.id] = n;
    });

    const layoutRound = (key: string, col: number, prevKey: string) => {
      const matches = roundByKey[key] ?? [];
      const prev = roundByKey[prevKey] ?? [];
      matches.forEach((m, i) => {
        const c1 = prev[2 * i] ? nodeById[prev[2 * i].id] : undefined;
        const c2 = prev[2 * i + 1] ? nodeById[prev[2 * i + 1].id] : undefined;
        const y = c1 && c2 ? (c1.y + c2.y) / 2 : TOP_PAD + i * PITCH;
        const n: Node = { match: m, x: col * COL_STEP, y, col };
        nodes.push(n);
        nodeById[m.id] = n;
      });
    };

    layoutRound("r16", 1, "r32");
    layoutRound("qf", 2, "r16");
    layoutRound("sf", 3, "qf");
    layoutRound("final", 4, "sf");

    // Third-place match sits below the final, same column.
    const third = (roundByKey.third ?? [])[0];
    const finalNode = (roundByKey.final ?? [])[0] ? nodeById[(roundByKey.final ?? [])[0].id] : undefined;
    if (third && finalNode) {
      const n: Node = { match: third, x: 4 * COL_STEP, y: finalNode.y + PITCH * 2.4, col: 4 };
      nodes.push(n);
      nodeById[third.id] = n;
    }

    const maxY = nodes.reduce((mx, n) => Math.max(mx, n.y), 0);
    return {
      nodes,
      nodeById,
      width: 5 * COL_STEP - COL_GAP,
      height: maxY + NODE_H + 24,
    };
  }, [roundByKey]);

  // Skeleton connectors by positional adjacency (parent ← two children).
  const edges = useMemo(() => {
    const out: { from: Node; to: Node; dashed: boolean }[] = [];
    const connect = (key: string, prevKey: string, dashed = false) => {
      const matches = roundByKey[key] ?? [];
      const prev = roundByKey[prevKey] ?? [];
      matches.forEach((m, i) => {
        const to = nodeById[m.id];
        for (const child of [prev[2 * i], prev[2 * i + 1]]) {
          if (child && nodeById[child.id] && to) out.push({ from: nodeById[child.id], to, dashed });
        }
      });
    };
    connect("r16", "r32");
    connect("qf", "r16");
    connect("sf", "qf");
    connect("final", "sf");
    // Third place is fed by the two semi-final losers.
    const third = (roundByKey.third ?? [])[0];
    const sf = roundByKey.sf ?? [];
    if (third && nodeById[third.id]) {
      for (const s of sf) if (nodeById[s.id]) out.push({ from: nodeById[s.id], to: nodeById[third.id], dashed: true });
    }
    return out;
  }, [roundByKey, nodeById]);

  const allTeams = useMemo(() => {
    const set = new Set<string>();
    for (const m of roundByKey.r32 ?? []) {
      if (!m.home.is_tbd) set.add(m.home.name);
      if (!m.away.is_tbd) set.add(m.away.name);
    }
    return [...set].sort();
  }, [roundByKey]);

  // A team "advanced" from a match if it shows up in a later round.
  const maxRoundByTeam = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of data?.rounds ?? []) {
      const ri = ROUND_INDEX[r.key] ?? 0;
      for (const m of r.matches) {
        for (const team of [m.home, m.away]) {
          if (team.is_tbd) continue;
          map[team.name] = Math.max(map[team.name] ?? 0, ri);
        }
      }
    }
    return map;
  }, [data]);

  const matchHasTeam = (m: BracketMatch, team: string) =>
    (!m.home.is_tbd && m.home.name === team) || (!m.away.is_tbd && m.away.name === team);

  // Fit the bracket to the container on first load.
  useEffect(() => {
    if (!data || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    setInitialScale(Math.min(1, Math.max(0.32, cw / (width + 40))));
  }, [data, width]);

  const pickTeam = (name: string) => setSelectedTeam(prev => (prev === name ? null : name));

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 16px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h1 style={{ fontFamily: "'Archivo', sans-serif", fontStretch: "125%", fontWeight: 900, fontSize: 26, color: "var(--text)", margin: 0 }}>
          {t("bracket.title")}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={selectedTeam ?? ""}
            onChange={(e) => setSelectedTeam(e.target.value || null)}
            style={{
              padding: "8px 12px", borderRadius: "var(--radius-xs)",
              border: `1px solid ${selectedTeam ? "var(--gold)" : "var(--border)"}`,
              background: "var(--surface-2)", color: "var(--text)",
              fontSize: 13, fontWeight: 600, cursor: "pointer", maxWidth: 200,
            }}
          >
            <option value="">{t("bracket.highlightTeam")}</option>
            {allTeams.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          {selectedTeam && (
            <button
              onClick={() => setSelectedTeam(null)}
              style={{
                padding: "8px 12px", borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--text-2)", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              {t("bracket.clear")}
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ color: "var(--skip)", fontWeight: 600 }}>{t("bracket.error")}</div>}
      {!data && !error && <div style={{ color: "var(--text-3)", fontWeight: 600 }}>{t("common.loading")}</div>}

      {data && (
        <div
          ref={containerRef}
          style={{
            position: "relative",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            background: "var(--surface)",
            overflow: "hidden",
            height: "min(72vh, 760px)",
          }}
        >
          <TransformWrapper
            key={initialScale}
            initialScale={initialScale}
            minScale={0.25}
            maxScale={2.5}
            centerOnInit
            wheel={{ step: 0.08 }}
            doubleClick={{ disabled: true }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { label: "+", fn: () => zoomIn() },
                    { label: "−", fn: () => zoomOut() },
                    { label: "⤢", fn: () => resetTransform() },
                  ].map((b) => (
                    <button
                      key={b.label}
                      onClick={b.fn}
                      style={{
                        width: 34, height: 34, borderRadius: 9,
                        border: "1px solid var(--border)", background: "var(--surface-2)",
                        color: "var(--text-2)", fontSize: 17, fontWeight: 800, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                      }}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                <TransformComponent
                  wrapperStyle={{ width: "100%", height: "100%", cursor: "grab" }}
                  contentStyle={{ width, height }}
                >
                  <div style={{ position: "relative", width, height }}>
                    {/* Round headers */}
                    {COLUMNS.map((key, col) => (
                      <div key={key} style={{
                        position: "absolute", left: col * COL_STEP, top: 0, width: NODE_W,
                        textAlign: "center", fontSize: 11, fontWeight: 800,
                        letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)",
                      }}>
                        {t(`bracket.round.${key}`)}
                      </div>
                    ))}

                    {/* Edges */}
                    <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                      {edges.map((e, i) => {
                        const sx = e.from.x + NODE_W;
                        const sy = e.from.y + NODE_H / 2;
                        const ex = e.to.x;
                        const ey = e.to.y + NODE_H / 2;
                        const mx = (sx + ex) / 2;
                        const lit = selectedTeam != null
                          && matchHasTeam(e.from.match, selectedTeam)
                          && matchHasTeam(e.to.match, selectedTeam);
                        return (
                          <path
                            key={i}
                            d={`M ${sx} ${sy} H ${mx} V ${ey} H ${ex} ${ey}`}
                            fill="none"
                            stroke={lit ? "var(--gold)" : "var(--border-strong)"}
                            strokeWidth={lit ? 3 : 1.5}
                            strokeDasharray={e.dashed && !lit ? "4 4" : undefined}
                            opacity={selectedTeam && !lit ? 0.35 : 1}
                          />
                        );
                      })}
                    </svg>

                    {/* Nodes */}
                    {nodes.map((n) => {
                      const inPath = selectedTeam != null && matchHasTeam(n.match, selectedTeam);
                      return (
                        <div
                          key={n.match.id}
                          style={{
                            position: "absolute", left: n.x, top: n.y, width: NODE_W, height: NODE_H,
                            background: "var(--surface-2)",
                            border: `1.5px solid ${inPath ? "var(--gold)" : "var(--border)"}`,
                            borderRadius: 10, overflow: "hidden",
                            boxShadow: inPath ? "0 0 12px color-mix(in oklab, var(--gold) 40%, transparent)" : "none",
                            opacity: selectedTeam && !inPath ? 0.55 : 1,
                            transition: "opacity 0.15s, border-color 0.15s, box-shadow 0.15s",
                          }}
                        >
                          {[n.match.home, n.match.away].map((team, idx) => {
                            const advanced = !team.is_tbd && (maxRoundByTeam[team.name] ?? 0) > (ROUND_INDEX[
                              n.col === 4 && n.match.stage === "Third place" ? "third" : COLUMNS[n.col]
                            ] ?? 0);
                            const isSel = selectedTeam != null && !team.is_tbd && team.name === selectedTeam;
                            return (
                              <button
                                key={idx}
                                onClick={() => !team.is_tbd && pickTeam(team.name)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 7, width: "100%",
                                  height: NODE_H / 2, padding: "0 9px", border: "none",
                                  borderTop: idx === 1 ? "1px solid var(--border)" : "none",
                                  background: isSel ? "color-mix(in oklab, var(--gold) 16%, transparent)" : "transparent",
                                  cursor: team.is_tbd ? "default" : "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <Crest src={team.crest} name={teamLabel(team)} dim={team.is_tbd} />
                                <span style={{
                                  flex: 1, fontSize: 12.5,
                                  fontWeight: advanced ? 800 : 600,
                                  color: team.is_tbd ? "var(--text-3)" : advanced ? "var(--text)" : "var(--text-2)",
                                  fontFamily: "'Archivo', sans-serif", fontStretch: "110%",
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                  {teamLabel(team)}
                                </span>
                                {team.score != null && (
                                  <span style={{
                                    fontSize: 13, fontWeight: 900, color: "var(--text)",
                                    fontVariantNumeric: "tabular-nums",
                                  }}>
                                    {team.score}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}

                    {/* Third-place label */}
                    {(roundByKey.third ?? [])[0] && nodeById[(roundByKey.third ?? [])[0].id] && (
                      <div style={{
                        position: "absolute",
                        left: nodeById[(roundByKey.third ?? [])[0].id].x,
                        top: nodeById[(roundByKey.third ?? [])[0].id].y - 18,
                        width: NODE_W, textAlign: "center",
                        fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
                        textTransform: "uppercase", color: "var(--text-3)",
                      }}>
                        {t("bracket.round.third")}
                      </div>
                    )}
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-3)", fontWeight: 600, textAlign: "center" }}>
        {t("bracket.hint")}
      </div>
    </div>
  );
}
