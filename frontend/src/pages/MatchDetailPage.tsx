import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import type {
  Group,
  GroupMemberPreference,
  GroupPreferenceSummary,
  Match,
  MatchPrediction,
  PreferenceChoice,
} from "../types";

const STATUS_LABEL: Record<string, string> = {
  watch_together: "Together",
  watch: "At home",
  skip: "Skip",
};

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

// ── Icons ─────────────────────────────────────────────────────────────────────

function TogetherIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="9.5" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 19c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.5 19c0-1.9 1-3.3 2.6-3.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WatchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <rect x="3" y="5.5" width="18" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 20.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.3 9.6l4 2.4-4 2.4z" fill="currentColor" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <path d="M6 5.5v13M18 5.5v13M16.5 6.5L9 12l7.5 5.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Flag chip ─────────────────────────────────────────────────────────────────

function FlagChip({ src, alt, tla }: { src: string | null; alt: string; tla: string | null }) {
  const [failed, setFailed] = useState(false);
  const label = tla ?? alt.slice(0, 3).toUpperCase();
  return (
    <div className="flag-chip">
      {src && !failed ? (
        <img src={src} alt={alt} onError={() => setFailed(true)} />
      ) : (
        <span className="flag-initials">{label}</span>
      )}
    </div>
  );
}

// ── Group selector modal ──────────────────────────────────────────────────────

function GroupSelectorModal({
  groups,
  match,
  onSelect,
  onCancel,
}: {
  groups: Group[];
  match: Match;
  onSelect: (groupId: number) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const homeTla = match.home_team_tla ?? match.home_team.slice(0, 3).toUpperCase();
  const awayTla = match.away_team_tla ?? match.away_team.slice(0, 3).toUpperCase();

  return (
    <div className="popover-scrim" onClick={onCancel}>
      <div className="popover" onClick={(e) => e.stopPropagation()}>
        <h3>Who are you watching with?</h3>
        <p>
          {homeTla} vs {awayTla} — pick the group you'll be Together with.
        </p>
        {groups.map((g) => {
          const sel = match.my_preferences.some(
            (p) => p.group_id === g.id && p.choice === "watch_together"
          );
          return (
            <button
              key={g.id}
              className="gopt"
              style={sel ? { borderColor: "var(--together)" } : undefined}
              onClick={() => onSelect(g.id)}
            >
              <span className="go-ic">{g.name.slice(0, 2).toUpperCase()}</span>
              <span style={{ flex: 1 }}>
                <span className="go-name">{g.name}</span>
                <span className="go-sub">{g.member_count} members</span>
              </span>
              {sel && (
                <span style={{ color: "var(--together)", fontWeight: 800, fontSize: 13 }}>
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Group panel ───────────────────────────────────────────────────────────────

function GroupPanel({
  summary,
  currentUserId,
}: {
  summary: GroupPreferenceSummary;
  currentUserId: number;
}) {
  const [open, setOpen] = useState(false);
  const total =
    summary.watch_together + summary.watch + summary.skip + summary.no_response;
  const pct = total > 0 ? Math.round((summary.watch_together / total) * 100) : 0;

  return (
    <div className={`gpanel${open ? " open" : ""}`}>
      <button className="gpanel-head" onClick={() => setOpen((o) => !o)}>
        <span className="gp-name">{summary.group_name}</span>
        <span className="gp-bar">
          <i style={{ width: `${pct}%` }} />
        </span>
        <span className={`gp-count${summary.watch_together > 0 ? " has" : ""}`}>
          <span>
            {summary.watch_together}/{total} together
          </span>
          <span className="chev">
            <ChevronIcon />
          </span>
        </span>
      </button>

      {open && (
        <div className="gpanel-body">
          {summary.members.map((m: GroupMemberPreference) => {
            const isMe = m.user_id === currentUserId;
            const statusKey = m.choice ?? "none";
            return (
              <div className="member" key={m.user_id}>
                <span className="av" style={{ background: avatarColor(m.full_name) }}>
                  {initials(m.full_name)}
                </span>
                <span className={`mname${isMe ? " me" : ""}`}>
                  {m.full_name}
                  {isMe && (
                    <span style={{ color: "var(--text-3)", fontWeight: 500, marginLeft: 4 }}>
                      (you)
                    </span>
                  )}
                </span>
                <span className={`mstatus ${statusKey}`}>
                  {m.choice ? STATUS_LABEL[m.choice] ?? m.choice : "Not set"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Prediction helpers ────────────────────────────────────────────────────────

function isKnockout(stage: string): boolean {
  return !stage.toLowerCase().includes("group");
}

function boostAllowance(stage: string): number {
  const s = stage.toLowerCase();
  if (s.includes("group")) return 4;
  if (s.includes("r32") || s.includes("round of 32")) return 3;
  if (s.includes("r16") || s.includes("round of 16")) return 2;
  if (s.includes("qf") || s.includes("quarter")) return 1;
  return 0; // semi, final, etc.
}

// ── Prediction popup ──────────────────────────────────────────────────────────

function PredictionPopup({
  match,
  prediction,
  usedBoosts,
  onClose,
  onSaved,
}: {
  match: Match;
  prediction: MatchPrediction | null;
  usedBoosts: number;
  onClose: () => void;
  onSaved: (p: MatchPrediction) => void;
}) {
  const { showToast } = useToast();
  const [homeGoals, setHomeGoals] = useState<number>(prediction?.home_goals ?? 0);
  const [awayGoals, setAwayGoals] = useState<number>(prediction?.away_goals ?? 0);
  const [qualifier, setQualifier] = useState<string>(prediction?.predicted_qualifier ?? "");
  const [boosted, setBoosted] = useState<boolean>(prediction?.boosted ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const knockout = isKnockout(match.stage);
  const allowance = boostAllowance(match.stage);
  const isDraw = homeGoals === awayGoals;
  const showQualifier = knockout && isDraw;

  // Boosts already used for this stage (excluding current prediction if already boosted)
  const boostedElsewhere = prediction?.boosted ? usedBoosts - 1 : usedBoosts;
  const canBoost = allowance > 0 && (boosted || boostedElsewhere < allowance);
  const boostsLeft = allowance - boostedElsewhere;

  const readOnly =
    prediction !== null && prediction.state !== "tip_available";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        home_goals: homeGoals,
        away_goals: awayGoals,
        predicted_qualifier: showQualifier && qualifier.trim() ? qualifier.trim() : null,
        boosted,
      };
      const res = await api.put<MatchPrediction>(`/predictions/${match.id}`, body);
      onSaved(res.data);
      showToast("Prediction saved");
      onClose();
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data &&
        typeof err.response.data === "object" &&
        "detail" in err.response.data
          ? String((err.response.data as { detail: unknown }).detail)
          : "Failed to save prediction.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const stateLabel = (state: MatchPrediction["state"]): string => {
    if (state === "tip_locked") return "Locked";
    if (state === "evaluated")
      return prediction?.points_awarded != null
        ? `${prediction.points_awarded} pts`
        : "Evaluated";
    if (state === "manual_review") return "Reviewing...";
    return state;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 400,
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 60px -20px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: "'Archivo', sans-serif",
              fontStretch: "125%",
              fontWeight: 800,
              fontSize: 17,
              color: "var(--text)",
              marginBottom: 4,
            }}
          >
            {match.home_team} vs {match.away_team}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
            {match.stage}
          </div>
        </div>

        {readOnly && prediction ? (
          /* Read-only view */
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                background: "var(--surface-2)",
                borderRadius: 10,
                padding: "14px 16px",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: "var(--text-3)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontSize: 11,
                }}
              >
                Your prediction
              </div>
              <div
                style={{
                  fontFamily: "'Archivo', sans-serif",
                  fontStretch: "125%",
                  fontWeight: 900,
                  fontSize: 32,
                  color: "var(--text)",
                  letterSpacing: "-0.01em",
                }}
              >
                {prediction.home_goals} – {prediction.away_goals}
                {prediction.boosted && (
                  <span style={{ fontSize: 20, marginLeft: 8 }}>⚡</span>
                )}
              </div>
              {prediction.predicted_qualifier && (
                <div
                  style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}
                >
                  Qualifier: {prediction.predicted_qualifier}
                </div>
              )}
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    prediction.state === "evaluated"
                      ? "var(--together)"
                      : "var(--text-3)",
                }}
              >
                {stateLabel(prediction.state)}
              </div>
            </div>
            <button
              className="btn-ghost"
              onClick={onClose}
              style={{ width: "100%", textAlign: "center" }}
            >
              Close
            </button>
          </div>
        ) : (
          /* Editable form */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Score inputs */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 10,
                }}
              >
                Predicted score
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-3)",
                      textAlign: "center",
                    }}
                  >
                    {match.home_team_tla ?? match.home_team.slice(0, 3).toUpperCase()}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={homeGoals}
                    onChange={(e) => setHomeGoals(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{
                      width: "100%",
                      padding: "10px 8px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--text)",
                      fontSize: 22,
                      fontWeight: 800,
                      fontFamily: "'Archivo', sans-serif",
                      fontVariantNumeric: "tabular-nums",
                      textAlign: "center",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: "'Archivo', sans-serif",
                    fontWeight: 900,
                    fontSize: 18,
                    color: "var(--text-3)",
                  }}
                >
                  –
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-3)",
                      textAlign: "center",
                    }}
                  >
                    {match.away_team_tla ?? match.away_team.slice(0, 3).toUpperCase()}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={awayGoals}
                    onChange={(e) => setAwayGoals(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{
                      width: "100%",
                      padding: "10px 8px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--text)",
                      fontSize: 22,
                      fontWeight: 800,
                      fontFamily: "'Archivo', sans-serif",
                      fontVariantNumeric: "tabular-nums",
                      textAlign: "center",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Qualifier input — knockout + draw only */}
            {showQualifier && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 6,
                  }}
                >
                  Qualifier (after extra time / penalties)
                </label>
                <input
                  type="text"
                  placeholder={`e.g. ${match.home_team_tla ?? match.home_team.slice(0, 3).toUpperCase()}`}
                  value={qualifier}
                  onChange={(e) => setQualifier(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontSize: 14,
                    fontWeight: 600,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {/* Boost */}
            {allowance > 0 && (
              <div
                style={{
                  background: "var(--surface-2)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  border: "1px solid var(--border)",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: canBoost ? "pointer" : "not-allowed",
                    opacity: canBoost ? 1 : 0.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={boosted}
                    disabled={!canBoost}
                    onChange={(e) => setBoosted(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: canBoost ? "pointer" : "not-allowed" }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                    ⚡ Double points (Boost)
                  </span>
                </label>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-3)",
                    marginTop: 6,
                    marginLeft: 26,
                    fontWeight: 600,
                  }}
                >
                  {boostedElsewhere} of {allowance} boosts used for this stage
                  {boostsLeft > 0 && ` · ${boostsLeft} left`}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--skip)",
                  fontWeight: 600,
                  background: "color-mix(in oklab, var(--skip) 10%, transparent)",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--text)",
                  color: "var(--bg)",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {submitting ? "Saving..." : prediction ? "Update" : "Submit"}
              </button>
              <button
                className="btn-ghost"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [match, setMatch] = useState<Match | null>(null);
  const [summaries, setSummaries] = useState<GroupPreferenceSummary[]>([]);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<PreferenceChoice | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [prediction, setPrediction] = useState<MatchPrediction | null>(null);
  const [predLoading, setPredLoading] = useState(false);
  const [usedBoosts, setUsedBoosts] = useState(0);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<Match>(`/matches/${id}`),
      api.get<GroupPreferenceSummary[]>(`/matches/${id}/preferences`),
      api.get<Group[]>("/groups/me"),
    ])
      .then(([matchRes, prefsRes, groupsRes]) => {
        setMatch(matchRes.data);
        setSummaries(prefsRes.data);
        setUserGroups(groupsRes.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const updatePreference = (groupId: number, choice: PreferenceChoice | null) => {
    setMatch((prev) =>
      prev
        ? {
            ...prev,
            my_preferences: prev.my_preferences.map((p) =>
              p.group_id === groupId ? { ...p, choice } : p
            ),
          }
        : prev
    );
  };

  const applyChoice = async (choice: PreferenceChoice, groupId: number) => {
    if (!match) return;
    const currentChoice = match.my_preferences.find(
      (p) => p.group_id === groupId
    )?.choice;
    const isDeselect = currentChoice === choice;
    setSaving(true);
    try {
      if (isDeselect) {
        await api.delete(`/matches/${match.id}/preference`, {
          params: { group_id: groupId },
        });
        updatePreference(groupId, null);
      } else {
        await api.put(`/matches/${match.id}/preference`, {
          choice,
          group_id: groupId,
        });
        updatePreference(groupId, choice);
      }
    } finally {
      setSaving(false);
    }
  };

  const applyChoiceAllGroups = async (choice: PreferenceChoice) => {
    if (!match) return;
    const allHaveChoice = userGroups.every(
      (g) =>
        match.my_preferences.find((p) => p.group_id === g.id)?.choice === choice
    );
    setSaving(true);
    try {
      await Promise.all(
        userGroups.map(async (g) => {
          if (allHaveChoice) {
            await api.delete(`/matches/${match.id}/preference`, {
              params: { group_id: g.id },
            });
            updatePreference(g.id, null);
          } else {
            await api.put(`/matches/${match.id}/preference`, {
              choice,
              group_id: g.id,
            });
            updatePreference(g.id, choice);
          }
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChoice = (choice: PreferenceChoice) => {
    if (!match || locked || saving || userGroups.length === 0) return;
    if (choice === "watch_together") {
      if (userGroups.length === 1) {
        const alreadyOn = match.my_preferences.some(
          (p) => p.choice === "watch_together"
        );
        applyChoice(choice, userGroups[0].id).then(() => {
          if (!alreadyOn) showToast(`You're watching with ${userGroups[0].name}`);
        });
      } else {
        setPendingChoice(choice);
      }
      return;
    }
    const alreadyAll = userGroups.every(
      (g) =>
        match.my_preferences.find((p) => p.group_id === g.id)?.choice === choice
    );
    applyChoiceAllGroups(choice).then(() => {
      if (!alreadyAll) {
        if (choice === "watch") showToast("Marked as watching at home");
        if (choice === "skip") showToast("Marked as skip");
      }
    });
  };

  const isButtonActive = (choice: PreferenceChoice): boolean => {
    if (!match || userGroups.length === 0) return false;
    if (choice === "watch_together") {
      return match.my_preferences.some((p) => p.choice === "watch_together");
    }
    return userGroups.every(
      (g) =>
        match.my_preferences.find((p) => p.group_id === g.id)?.choice === choice
    );
  };

  const handleOpenTip = async () => {
    if (!match || predLoading) return;
    setPredLoading(true);
    try {
      // Load prediction (404 = none yet)
      try {
        const res = await api.get<MatchPrediction>(`/predictions/${match.id}`);
        setPrediction(res.data);
      } catch (err: unknown) {
        const status =
          err &&
          typeof err === "object" &&
          "response" in err &&
          err.response &&
          typeof err.response === "object" &&
          "status" in err.response
            ? (err.response as { status: number }).status
            : null;
        if (status === 404) {
          setPrediction(null);
        } else {
          throw err;
        }
      }
      // Count used boosts for this stage
      try {
        const allPreds = await api.get<MatchPrediction[]>("/predictions");
        const count = allPreds.data.filter(
          (p) => p.match_id !== match.id && p.boosted
        ).length;
        setUsedBoosts(count);
      } catch {
        setUsedBoosts(0);
      }
    } finally {
      setPredLoading(false);
      setTipOpen(true);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div
          style={{
            height: 200,
            borderRadius: "var(--radius)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="empty-day">
        Match not found.{" "}
        <Link to="/matches" style={{ color: "var(--text-2)", textDecoration: "underline" }}>
          Back to matches
        </Link>
      </div>
    );
  }

  const locked =
    match.status === "live" ||
    match.status === "finished" ||
    match.status === "cancelled";

  const isPast = new Date(match.match_datetime).getTime() <= Date.now() - 2 * 3_600_000;

  const dt = new Date(match.match_datetime);
  const dateStr = dt.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = dt.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const homeTla =
    match.home_team_tla ?? match.home_team.slice(0, 3).toUpperCase();
  const awayTla =
    match.away_team_tla ?? match.away_team.slice(0, 3).toUpperCase();

  const odds = [
    { k: "1", v: match.home_odds },
    { k: "X", v: match.draw_odds },
    { k: "2", v: match.away_odds },
  ];
  const hasOdds = odds.some((o) => o.v != null);
  const minOdds = hasOdds
    ? Math.min(...odds.filter((o) => o.v != null).map((o) => o.v!))
    : null;

  const opts = [
    { choice: "watch_together" as const, label: "Together", Icon: TogetherIcon },
    { choice: "watch" as const, label: "At home", Icon: WatchIcon },
    { choice: "skip" as const, label: "Skip", Icon: SkipIcon },
  ];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {pendingChoice && match && (
        <GroupSelectorModal
          groups={userGroups}
          match={match}
          onSelect={(groupId) => {
            const groupName =
              userGroups.find((g) => g.id === groupId)?.name ?? "group";
            applyChoice(pendingChoice, groupId).then(() =>
              showToast(`You're watching with ${groupName}`)
            );
            setPendingChoice(null);
          }}
          onCancel={() => setPendingChoice(null)}
        />
      )}

      <Link
        to="/matches"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-3)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        ← Back to matches
      </Link>

      {/* Match card */}
      <div
        className="card"
        style={{ gap: 18, marginBottom: 16 }}
      >
        {/* Stage */}
        <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {match.stage}
          {match.matchday != null && match.stage.toLowerCase().startsWith("group") && (
            <span> · MD {match.matchday}</span>
          )}
        </div>

        {/* Scoreboard */}
        <div className="score">
          <div className="team">
            <FlagChip src={match.home_team_crest} alt={match.home_team} tla={match.home_team_tla} />
            <div className="tla">{homeTla}</div>
            <div className="tname">{match.home_team}</div>
          </div>
          <div className="score-mid">VS</div>
          <div className="team">
            <FlagChip src={match.away_team_crest} alt={match.away_team} tla={match.away_team_tla} />
            <div className="tla">{awayTla}</div>
            <div className="tname">{match.away_team}</div>
          </div>
        </div>

        {/* Date & time */}
        <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--text-3)" }}>
          {dateStr} · <strong style={{ color: "var(--text-2)" }}>{timeStr}</strong>
          {match.venue && (
            <div style={{ marginTop: 2, fontSize: 12 }}>{match.venue}</div>
          )}
        </div>

        {/* Odds */}
        {hasOdds && (
          <div className="odds">
            {odds.map(({ k, v }) => (
              <div key={k} className={`odd${v === minOdds && v != null ? " fav" : ""}`}>
                <span className="ok">{k}</span>
                <span className="ov">{v != null ? v.toFixed(2) : "—"}</span>
              </div>
            ))}
          </div>
        )}

        {/* Preference control */}
        {userGroups.length > 0 && (
          <div className="pref-seg" role="group">
            {opts.map(({ choice, label, Icon }) => {
              const on = isButtonActive(choice);
              return (
                <button
                  key={choice}
                  className={`seg-btn ${choice}${on ? " on" : ""}`}
                  disabled={locked || saving}
                  aria-pressed={on}
                  onClick={() => handleChoice(choice)}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Submit Tip button */}
        {!isPast && match.status !== "finished" && match.status !== "cancelled" && (
          <button
            className="btn-ghost"
            onClick={handleOpenTip}
            disabled={predLoading}
            style={{
              width: "100%",
              textAlign: "center",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {predLoading ? (
              "Loading..."
            ) : prediction ? (
              <>
                {prediction.home_goals}–{prediction.away_goals}
                {prediction.boosted && " ⚡"}
              </>
            ) : (
              "Submit Tip"
            )}
          </button>
        )}
      </div>

      {/* Group panels */}
      {summaries.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", marginBottom: 10 }}>
            Group preferences
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {summaries.map((gs) => (
              <GroupPanel
                key={gs.group_id}
                summary={gs}
                currentUserId={user?.id ?? 0}
              />
            ))}
          </div>
        </div>
      )}

      {tipOpen && (
        <PredictionPopup
          match={match}
          prediction={prediction}
          usedBoosts={usedBoosts}
          onClose={() => setTipOpen(false)}
          onSaved={(p) => setPrediction(p)}
        />
      )}
    </div>
  );
}
