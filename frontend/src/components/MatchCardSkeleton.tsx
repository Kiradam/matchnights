export function MatchCardSkeleton() {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "var(--card-pad)",
        animation: "skeleton-pulse 2s ease-in-out infinite",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Head */}
      <div style={{ height: 12, background: "var(--surface-2)", borderRadius: 6, width: "40%" }} />
      {/* Scoreboard */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "var(--surface-2)" }} />
          <div style={{ height: 22, width: 40, background: "var(--surface-2)", borderRadius: 4 }} />
          <div style={{ height: 10, width: 60, background: "var(--surface-2)", borderRadius: 4 }} />
        </div>
        <div style={{ height: 16, width: 24, background: "var(--surface-2)", borderRadius: 4 }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "var(--surface-2)" }} />
          <div style={{ height: 22, width: 40, background: "var(--surface-2)", borderRadius: 4 }} />
          <div style={{ height: 10, width: 60, background: "var(--surface-2)", borderRadius: 4 }} />
        </div>
      </div>
      {/* Kickoff */}
      <div style={{ height: 12, background: "var(--surface-2)", borderRadius: 6, width: "60%", margin: "0 auto" }} />
      {/* Odds */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 40, background: "var(--surface-2)", borderRadius: "var(--radius-xs)" }} />
        ))}
      </div>
      {/* Pref control */}
      <div style={{ height: 48, background: "var(--surface-2)", borderRadius: "var(--radius-xs)" }} />
    </div>
  );
}
