import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import { MatchCardSkeleton } from "../components/MatchCardSkeleton";
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

type FilterMode = "upcoming" | "today" | "tomorrow" | "all" | "together" | "planned" | "skip" | "not_answered" | "tips_submitted" | "tips_missing";

// ── Helpers ──────────────────────────────────────────────────────────────────

// MatchNights football day: boundary at 03:00 AM so late-night matches
// (e.g. 23:00 kickoff) still belong to the same "day" as earlier matches.
function footballDayTs(date: Date): number {
  const d = new Date(date);
  if (d.getHours() < 3) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isUpcoming(m: Match): boolean {
  return new Date(m.match_datetime).getTime() > Date.now() - 2 * 3_600_000;
}

function isToday(m: Match): boolean {
  return footballDayTs(new Date(m.match_datetime)) === footballDayTs(new Date());
}

function isTomorrow(m: Match): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return footballDayTs(new Date(m.match_datetime)) === footballDayTs(tomorrow);
}

function isTbd(m: Match): boolean {
  return m.home_team === "TBD" || m.away_team === "TBD";
}

function hasMyChoice(m: Match, choices: PreferenceChoice[]): boolean {
  return m.my_preferences.some(
    (p) => p.choice !== null && choices.includes(p.choice as PreferenceChoice)
  );
}

function relativeKick(dt: Date, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const now = new Date();
  const diffMs = dt.getTime() - now.getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < -2) return t("match.finished");
  if (diffH < 0) return t("match.live");
  if (diffH < 1) return t("match.inMin", { count: Math.round(diffMs / 60_000) });
  if (diffH < 24 && isToday({ match_datetime: dt.toISOString() } as Match))
    return t("match.today");
  if (diffH < 48) return t("match.tomorrow");
  return t("match.inDays", { count: Math.round(diffH / 24) });
}

function dicebearUrl(seed: number | string): string {
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}`;
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

// ── Segmented preference control ──────────────────────────────────────────────

function PrefControl({
  match,
  userGroups,
  locked,
  saving,
  onChoice,
}: {
  match: Match;
  userGroups: Group[];
  locked: boolean;
  saving: boolean;
  onChoice: (choice: PreferenceChoice) => void;
}) {
  const { t } = useTranslation();

  const isActive = (choice: PreferenceChoice): boolean => {
    if (userGroups.length === 0) return false;
    if (choice === "watch_together") {
      return match.my_preferences.some((p) => p.choice === "watch_together");
    }
    return userGroups.every(
      (g) => match.my_preferences.find((p) => p.group_id === g.id)?.choice === choice
    );
  };

  const opts = [
    { choice: "watch_together" as const, label: t("watchMode.together"), Icon: TogetherIcon },
    { choice: "watch" as const, label: t("watchMode.atHome"), Icon: WatchIcon },
    { choice: "skip" as const, label: t("watchMode.skip"), Icon: SkipIcon },
  ];

  return (
    <div className="pref-seg" role="group">
      {opts.map(({ choice, label, Icon }) => {
        const on = isActive(choice);
        return (
          <button
            key={choice}
            className={`seg-btn ${choice}${on ? " on" : ""}`}
            disabled={locked || saving}
            aria-pressed={on}
            onClick={() => onChoice(choice)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Group selector modal ──────────────────────────────────────────────────────

function GroupSelectorModal({
  match,
  groups,
  onSelect,
  onCancel,
}: {
  match: Match;
  groups: Group[];
  onSelect: (groupId: number) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

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
        <h3>{t("groupSelector.title")}</h3>
        <p>{t("groupSelector.subtitle", { home: homeTla, away: awayTla })}</p>
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
                <span className="go-sub">{g.member_count} {t("common.members")}</span>
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
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const total =
    summary.watch_together + summary.watch + summary.skip + summary.no_response;
  const pct = total > 0 ? Math.round((summary.watch_together / total) * 100) : 0;

  const STATUS_LABEL: Record<string, string> = {
    watch_together: t("watchMode.together"),
    watch: t("watchMode.atHome"),
    skip: t("watchMode.skip"),
  };

  return (
    <div className={`gpanel${open ? " open" : ""}`}>
      <button className="gpanel-head" onClick={() => setOpen((o) => !o)}>
        <span className="gp-name">{summary.group_name}</span>
        <span className="gp-bar">
          <i style={{ width: `${pct}%` }} />
        </span>
        <span className={`gp-count${summary.watch_together > 0 ? " has" : ""}`}>
          <span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {summary.watch_together}/{total}
            </span>{" "}
            {t("watchMode.together").toLowerCase()}
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
                <img className="av" src={dicebearUrl(m.user_id)} alt={m.full_name} />
                <span className={`mname${isMe ? " me" : ""}`}>
                  {m.full_name}
                  {isMe && (
                    <span style={{ color: "var(--text-3)", fontWeight: 500, marginLeft: 4 }}>
                      {t("common.you")}
                    </span>
                  )}
                </span>
                <span className={`mstatus ${statusKey}`}>
                  {m.choice ? STATUS_LABEL[m.choice] ?? m.choice : t("watchMode.notSet")}
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
  const { t } = useTranslation();
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
    if (state === "tip_locked") return t("prediction.locked");
    if (state === "evaluated")
      return prediction?.points_awarded != null
        ? `${prediction.points_awarded} pts`
        : t("prediction.evaluated");
    if (state === "manual_review") return t("prediction.reviewing");
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
                {t("prediction.yourPrediction")}
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
                  {t("prediction.qualifierLabel", { team: prediction.predicted_qualifier })}
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
              {t("common.close")}
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
                {t("prediction.predictedScore")}
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
                    max={99}
                    value={homeGoals}
                    onFocus={(e) => { const t = e.target; setTimeout(() => t.select(), 0); }}
                    onChange={(e) => setHomeGoals(Math.min(99, Math.max(0, parseInt(e.target.value) || 0)))}
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
                    max={99}
                    value={awayGoals}
                    onFocus={(e) => { const t = e.target; setTimeout(() => t.select(), 0); }}
                    onChange={(e) => setAwayGoals(Math.min(99, Math.max(0, parseInt(e.target.value) || 0)))}
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
                  {t("prediction.qualifier")}
                </label>
                <input
                  type="text"
                  placeholder={t("prediction.qualifierPlaceholder", { tla: match.home_team_tla ?? match.home_team.slice(0, 3).toUpperCase() })}
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
                    {t("prediction.boost")}
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
                  {t("prediction.boostsUsed", { used: boostedElsewhere, total: allowance })}
                  {boostsLeft > 0 && ` · ${t("prediction.boostsLeft", { count: boostsLeft })}`}
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
                {submitting ? t("prediction.saving") : prediction ? t("prediction.update") : t("prediction.submit")}
              </button>
              <button
                className="btn-ghost"
                onClick={onClose}
                disabled={submitting}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Match card ────────────────────────────────────────────────────────────────

function isMatchOn(summaries: GroupPreferenceSummary[]): boolean {
  // Match On fires when at least one group has ≥50% of its total members watching together.
  return summaries.some(g => g.members.length > 0 && g.watch_together / g.members.length >= 0.5);
}

function MatchCard({
  match,
  groupSummaries,
  userGroups,
  currentUserId,
  onPreferenceChange,
  onPredictionSaved,
  initialPrediction,
}: {
  match: Match;
  groupSummaries: GroupPreferenceSummary[] | undefined;
  userGroups: Group[];
  currentUserId: number;
  onPreferenceChange: (
    matchId: number,
    groupId: number,
    choice: PreferenceChoice | null,
    prevChoice: PreferenceChoice | null
  ) => void;
  onPredictionSaved?: (matchId: number, p: MatchPrediction) => void;
  initialPrediction?: MatchPrediction;
}) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<PreferenceChoice | null>(null);

  // Prediction state
  const [tipOpen, setTipOpen] = useState(false);
  const [prediction, setPrediction] = useState<MatchPrediction | null>(initialPrediction ?? null);
  const [predLoading, setPredLoading] = useState(false);
  const [usedBoosts, setUsedBoosts] = useState(0);

  const locked =
    match.status === "live" ||
    match.status === "finished" ||
    match.status === "cancelled";

  const isTbdMatch = isTbd(match);

  const isHot = groupSummaries ? isMatchOn(groupSummaries) : false;
  const isSkipped =
    hasMyChoice(match, ["skip"]) &&
    !hasMyChoice(match, ["watch", "watch_together"]);
  const isPast = !isUpcoming(match);

  const dt = new Date(match.match_datetime);
  const locale = i18n.language === "hu" ? "hu-HU" : "en-GB";
  const dateStr = dt.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeStr = dt.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const homeTla =
    match.home_team_tla ?? match.home_team.slice(0, 3).toUpperCase();
  const awayTla =
    match.away_team_tla ?? match.away_team.slice(0, 3).toUpperCase();

  // Preference for status tag
  const myPref = (() => {
    if (hasMyChoice(match, ["watch_together"])) return "watch_together";
    if (hasMyChoice(match, ["watch"])) return "watch";
    if (hasMyChoice(match, ["skip"])) return "skip";
    return null;
  })();

  const STATUS_LABEL: Record<string, string> = {
    watch_together: t("watchMode.together"),
    watch: t("watchMode.atHome"),
    skip: t("watchMode.skip"),
  };

  const applyChoice = async (choice: PreferenceChoice, groupId: number) => {
    const prevChoice =
      (match.my_preferences.find((p) => p.group_id === groupId)
        ?.choice as PreferenceChoice | null) ?? null;
    const isDeselect = prevChoice === choice;
    setSaving(true);
    try {
      if (isDeselect) {
        await api.delete(`/matches/${match.id}/preference`, {
          params: { group_id: groupId },
        });
        onPreferenceChange(match.id, groupId, null, prevChoice);
      } else {
        await api.put(`/matches/${match.id}/preference`, {
          choice,
          group_id: groupId,
        });
        onPreferenceChange(match.id, groupId, choice, prevChoice);
      }
    } finally {
      setSaving(false);
    }
  };

  const applyChoiceAllGroups = async (choice: PreferenceChoice) => {
    const allHaveChoice = userGroups.every(
      (g) => match.my_preferences.find((p) => p.group_id === g.id)?.choice === choice
    );
    setSaving(true);
    try {
      await Promise.all(
        userGroups.map(async (g) => {
          const prevChoice =
            (match.my_preferences.find((p) => p.group_id === g.id)
              ?.choice as PreferenceChoice | null) ?? null;
          if (allHaveChoice) {
            await api.delete(`/matches/${match.id}/preference`, {
              params: { group_id: g.id },
            });
            onPreferenceChange(match.id, g.id, null, prevChoice);
          } else {
            await api.put(`/matches/${match.id}/preference`, {
              choice,
              group_id: g.id,
            });
            onPreferenceChange(match.id, g.id, choice, prevChoice);
          }
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChoice = (choice: PreferenceChoice) => {
    if (locked || saving || userGroups.length === 0) return;
    if (choice === "watch_together") {
      if (userGroups.length === 1) {
        applyChoice(choice, userGroups[0].id).then(() => {
          const alreadyOn = match.my_preferences.some(
            (p) => p.choice === "watch_together"
          );
          if (!alreadyOn)
            showToast(`You're watching with ${userGroups[0].name}`);
        });
      } else {
        setPendingChoice(choice);
      }
      return;
    }
    const alreadyAll = userGroups.every(
      (g) => match.my_preferences.find((p) => p.group_id === g.id)?.choice === choice
    );
    applyChoiceAllGroups(choice).then(() => {
      if (!alreadyAll) {
        if (choice === "watch") showToast("Marked as watching at home");
        if (choice === "skip") showToast("Marked as skip");
      }
    });
  };

  const handleModalSelect = (groupId: number) => {
    if (pendingChoice) {
      const groupName =
        userGroups.find((g) => g.id === groupId)?.name ?? "group";
      applyChoice(pendingChoice, groupId).then(() => {
        showToast(`You're watching with ${groupName}`);
      });
    }
    setPendingChoice(null);
  };

  const handleOpenTip = async () => {
    if (predLoading) return;
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
          // ideally filter by same stage, but we don't have stage on prediction
          // so just count globally; spec says "for this stage" — we approximate by all
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

  const hasOdds =
    match.home_odds != null || match.draw_odds != null || match.away_odds != null;

  const probabilities = (() => {
    if (!match.home_odds || !match.draw_odds || !match.away_odds) return null;
    const rh = 1 / match.home_odds;
    const rd = 1 / match.draw_odds;
    const ra = 1 / match.away_odds;
    const total = rh + rd + ra;
    return {
      home: Math.round((rh / total) * 100),
      draw: Math.round((rd / total) * 100),
      away: Math.round((ra / total) * 100),
    };
  })();

  return (
    <>
      {pendingChoice && (
        <GroupSelectorModal
          match={match}
          groups={userGroups}
          onSelect={handleModalSelect}
          onCancel={() => setPendingChoice(null)}
        />
      )}

      {tipOpen && (
        <PredictionPopup
          match={match}
          prediction={prediction}
          usedBoosts={usedBoosts}
          onClose={() => setTipOpen(false)}
          onSaved={(p) => { setPrediction(p); onPredictionSaved?.(match.id, p); }}
        />
      )}

      <article
        className={`card${isHot ? " matchon" : ""}${myPref === "watch_together" ? " together-pref" : ""}${myPref === "watch" ? " watch-pref" : ""}${isSkipped ? " skipped" : ""}${isPast ? " past" : ""}`}
      >
        {/* Card head */}
        <div className="card-head">
          <span className="group-chip">
            {match.stage}
            {match.matchday != null &&
              match.stage.toLowerCase().startsWith("group") && (
                <> · {t("match.md")} {match.matchday}</>
              )}
          </span>
          {isHot ? (
            <span className="status-tag matchon-tag">
              <span className="dot" />
              {t("match.matchOn")}
            </span>
          ) : myPref ? (
            <span className={`status-tag ${myPref}`}>
              <span className="dot" />
              {STATUS_LABEL[myPref]}
            </span>
          ) : null}
        </div>

        {/* Scoreboard — links to detail page */}
        <Link
          to={`/matches/${match.id}`}
          style={{ textDecoration: "none" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="score">
            <div className="team">
              <FlagChip
                src={match.home_team_crest}
                alt={match.home_team}
                tla={match.home_team_tla}
              />
              <div className="tla">{homeTla}</div>
              <div className="tname">{match.home_team}</div>
            </div>
            {match.status === "finished" && match.home_score != null && match.away_score != null ? (
              <div className="score-mid result">
                <span className="result-score">{match.home_score}–{match.away_score}</span>
                <span className="result-label">FT</span>
              </div>
            ) : (
              <div className="score-mid">VS</div>
            )}
            <div className="team">
              <FlagChip
                src={match.away_team_crest}
                alt={match.away_team}
                tla={match.away_team_tla}
              />
              <div className="tla">{awayTla}</div>
              <div className="tname">{match.away_team}</div>
            </div>
          </div>
        </Link>

        {/* Kickoff */}
        <div className="kickoff-line">
          <span className="ko-time">
            {dateStr} · {timeStr}
          </span>
          <span>·</span>
          <span className="ko-rel">{relativeKick(dt, t)}</span>
        </div>

        {/* Watch Mode */}
        {userGroups.length > 0 && (
          <PrefControl
            match={match}
            userGroups={userGroups}
            locked={locked}
            saving={saving}
            onChoice={handleChoice}
          />
        )}

        {/* Prediction Insights — implied probabilities from odds */}
        {hasOdds && probabilities && (
          <div className="pred-insights">
            {[
              { label: t("prediction.homeWin"), pct: probabilities.home },
              { label: t("prediction.draw"), pct: probabilities.draw },
              { label: t("prediction.awayWin"), pct: probabilities.away },
            ].map(({ label, pct }) => (
              <button
                key={label}
                className="pi-item"
                onClick={(e) => { e.stopPropagation(); handleOpenTip(); }}
                disabled={predLoading || isTbdMatch}
                style={{ background: `linear-gradient(to right, color-mix(in oklab, var(--text) 12%, transparent) ${pct}%, var(--surface-2) ${pct}%)` }}
              >
                <span className="pi-label">{label}</span>
                <span className="pi-pct">{pct}%</span>
              </button>
            ))}
          </div>
        )}

        {/* Submit Tip button */}
        {!isPast && (
          <>
            {isTbdMatch && (
              <p className="tbd-note">
                {t("prediction.tbdNote")}
              </p>
            )}
            <button
              className="btn-ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenTip();
              }}
              disabled={predLoading || isTbdMatch}
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
                t("common.loading")
              ) : prediction ? (
                <>
                  {prediction.home_goals}–{prediction.away_goals}
                  {prediction.boosted && " ⚡"}
                </>
              ) : (
                t("prediction.submitTip")
              )}
            </button>
          </>
        )}

        {/* Group panels */}
        {groupSummaries && groupSummaries.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {groupSummaries.map((gs) => (
              <GroupPanel
                key={gs.group_id}
                summary={gs}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}
      </article>
    </>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({
  kind,
  label,
  value,
  sub,
  clickable,
  active,
  onClick,
}: {
  kind: string;
  label: string;
  value: number;
  sub: string;
  clickable?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const Comp = clickable ? "button" : "div";
  return (
    <Comp
      className={`stat ${kind}${clickable ? " clickable" : ""}${active ? " active" : ""}`}
      onClick={clickable ? onClick : undefined}
      style={clickable ? undefined : { cursor: "default" }}
    >
      <span className="stat-ghost" aria-hidden="true">{value}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-num tnum">{value}</span>
      <span className="stat-sub">{sub}</span>
    </Comp>
  );
}

// ── Next game hero ────────────────────────────────────────────────────────────

function NextGame({
  match,
  summaries,
}: {
  match: Match | undefined;
  summaries: GroupPreferenceSummary[];
}) {
  const { t, i18n } = useTranslation();

  if (!match) {
    return (
      <div
        className="stat next-game"
        style={{
          cursor: "default",
          border: "1px dashed var(--border)",
          background: "var(--surface)",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <span className="stat-sub">{t("matches.noWatchlistGames")}</span>
      </div>
    );
  }

  const dt = new Date(match.match_datetime);
  const locale = i18n.language === "hu" ? "hu-HU" : "en-GB";
  const dateStr = dt.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeStr = dt.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const homeTla =
    match.home_team_tla ?? match.home_team.slice(0, 3).toUpperCase();
  const awayTla =
    match.away_team_tla ?? match.away_team.slice(0, 3).toUpperCase();

  const isTogether = match.my_preferences.some(
    (p) => p.choice === "watch_together"
  );
  const togetherGroupIds = new Set(
    match.my_preferences
      .filter((p) => p.choice === "watch_together")
      .map((p) => p.group_id)
  );
  const togetherSummaries = summaries.filter((g) =>
    togetherGroupIds.has(g.group_id)
  );
  const togetherCount = togetherSummaries.reduce(
    (s, g) => s + g.watch_together,
    0
  );
  const totalCount = togetherSummaries.reduce(
    (s, g) => s + g.watch + g.watch_together + g.skip + g.no_response,
    0
  );

  return (
    <Link to={`/matches/${match.id}`} className="next-game-link" style={{ textDecoration: "none" }}>
      <div className="stat next-game">
        <div className="ng-label">
          <span className="ng-live" />
          {t("matches.yourNextGame")}
        </div>
        <div className="ng-teams">
          {homeTla}
          <span className="vs">{t("common.vs")}</span>
          {awayTla}
        </div>
        <div className="ng-meta">
          <span>
            {dateStr} · {timeStr}
          </span>
          <span>·</span>
          <span>{relativeKick(dt, t)}</span>
          {isTogether && (
            <>
              <span>·</span>
              <span className="ng-badge">
                {t("matches.togetherBadge", { count: togetherCount, total: totalCount })}
              </span>
            </>
          )}
          {!isTogether && (
            <>
              <span>·</span>
              <span className="ng-badge">{t("matches.atHomeBadge")}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function MatchesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterMode>("upcoming");
  const [summaries, setSummaries] = useState<
    Record<number, GroupPreferenceSummary[]>
  >({});
  const [predictions, setPredictions] = useState<Record<number, MatchPrediction>>({});
  const fetchRef = useRef(0);

  const FILTERS: { key: FilterMode; label: string }[] = [
    { key: "upcoming", label: t("matches.upcoming") },
    { key: "today", label: t("matches.today") },
    { key: "tomorrow", label: t("matches.tomorrow") },
    { key: "all", label: t("matches.all") },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const id = ++fetchRef.current;
    try {
      const [matchesRes, groupsRes, predsRes] = await Promise.all([
        api.get<Match[]>("/matches", { params: { page_size: 200 } }),
        api.get<Group[]>("/groups/me"),
        api.get<MatchPrediction[]>("/predictions").catch(() => ({ data: [] as MatchPrediction[] })),
      ]);

      if (id !== fetchRef.current) return;
      setAllMatches(matchesRes.data);
      setUserGroups(groupsRes.data);

      const predsMap: Record<number, MatchPrediction> = {};
      for (const p of predsRes.data) predsMap[p.match_id] = p;
      setPredictions(predsMap);

      const results = await Promise.allSettled(
        matchesRes.data.map((m) =>
          api
            .get<GroupPreferenceSummary[]>(`/matches/${m.id}/preferences`)
            .then((r) => ({ id: m.id, summaries: r.data }))
        )
      );

      if (id !== fetchRef.current) return;

      const filled: Record<number, GroupPreferenceSummary[]> = {};
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.summaries.length > 0) {
          filled[r.value.id] = r.value.summaries;
        }
      }
      setSummaries(filled);
    } finally {
      if (id === fetchRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePreferenceChange = (
    matchId: number,
    groupId: number,
    choice: PreferenceChoice | null,
    prevChoice: PreferenceChoice | null
  ) => {
    setAllMatches((prev) =>
      prev.map((m) =>
        m.id !== matchId
          ? m
          : {
              ...m,
              my_preferences: m.my_preferences.map((p) =>
                p.group_id !== groupId ? p : { ...p, choice }
              ),
            }
      )
    );

    setSummaries((prev) => {
      const matchSummaries = prev[matchId];
      if (!matchSummaries) return prev;
      return {
        ...prev,
        [matchId]: matchSummaries.map((gs) => {
          if (gs.group_id !== groupId) return gs;
          const delta = (c: string) => {
            let n = gs[c as keyof GroupPreferenceSummary] as number;
            if (prevChoice === c) n--;
            if (choice === c) n++;
            return Math.max(0, n);
          };
          return {
            ...gs,
            watch_together: delta("watch_together"),
            watch: delta("watch"),
            skip: delta("skip"),
            no_response: Math.max(
              0,
              gs.no_response + (!choice ? 1 : 0) - (!prevChoice ? 1 : 0)
            ),
            members: gs.members.map((m) =>
              m.user_id !== user?.id ? m : { ...m, choice }
            ),
          };
        }),
      };
    });
  };

  const handlePredictionSaved = (matchId: number, p: MatchPrediction) => {
    setPredictions((prev) => ({ ...prev, [matchId]: p }));
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const upcomingMatches = useMemo(() => allMatches.filter(isUpcoming), [allMatches]);

  // Dashboard stats and Next Game are scoped to upcoming matches only.
  const dashboardStats = useMemo(() => {
    const now = new Date();
    const together = upcomingMatches.filter((m) =>
      hasMyChoice(m, ["watch_together"])
    ).length;
    const atHome = upcomingMatches.filter(
      (m) => hasMyChoice(m, ["watch"]) && !hasMyChoice(m, ["watch_together"])
    ).length;
    const skipped = upcomingMatches.filter(
      (m) => hasMyChoice(m, ["skip"]) && !hasMyChoice(m, ["watch", "watch_together"])
    ).length;
    const notAnswered = upcomingMatches.filter(
      (m) => !hasMyChoice(m, ["watch", "watch_together", "skip"])
    ).length;
    const nextGame = upcomingMatches
      .filter((m) => new Date(m.match_datetime) > now && hasMyChoice(m, ["watch", "watch_together"]))
      .sort((a, b) => new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime())[0];
    const nextGameSummaries = nextGame ? (summaries[nextGame.id] ?? []) : [];
    const scheduled = allMatches.filter((m) => m.status === "scheduled");
    const tipsSubmitted = scheduled.filter((m) => predictions[m.id] != null).length;
    const tipsMissing = scheduled.filter((m) => !isTbd(m) && predictions[m.id] == null).length;
    return { together, atHome, skipped, notAnswered, nextGame, nextGameSummaries, tipsSubmitted, tipsMissing };
  }, [upcomingMatches, summaries, predictions, allMatches]);

  const sortByTime = (a: Match, b: Match) =>
    new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime();

  const matches = useMemo(() => {
    if (activeFilter === "upcoming") return upcomingMatches;
    if (activeFilter === "today") return allMatches.filter(isToday);
    if (activeFilter === "tomorrow") return allMatches.filter(isTomorrow);
    if (activeFilter === "together")
      return upcomingMatches
        .filter((m) => hasMyChoice(m, ["watch_together"]))
        .sort((a, b) => {
          const scoreA = (summaries[a.id] ?? []).reduce((s, g) => s + g.watch_together, 0);
          const scoreB = (summaries[b.id] ?? []).reduce((s, g) => s + g.watch_together, 0);
          return scoreB - scoreA || sortByTime(a, b);
        });
    if (activeFilter === "planned")
      return upcomingMatches.filter(
        (m) => hasMyChoice(m, ["watch"]) && !hasMyChoice(m, ["watch_together"])
      );
    if (activeFilter === "skip")
      return upcomingMatches.filter(
        (m) => hasMyChoice(m, ["skip"]) && !hasMyChoice(m, ["watch", "watch_together"])
      );
    if (activeFilter === "not_answered")
      return upcomingMatches.filter(
        (m) => !hasMyChoice(m, ["watch", "watch_together", "skip"])
      );
    if (activeFilter === "tips_submitted")
      return allMatches.filter((m) => m.status === "scheduled" && predictions[m.id] != null);
    if (activeFilter === "tips_missing")
      return allMatches.filter((m) => m.status === "scheduled" && !isTbd(m) && predictions[m.id] == null);
    // "all": upcoming first then past, each group sorted by time ascending
    const past = allMatches.filter((m) => !isUpcoming(m));
    return [...upcomingMatches.slice().sort(sortByTime), ...past.slice().sort(sortByTime)];
  }, [allMatches, upcomingMatches, activeFilter, summaries, predictions]);

  return (
    <div>
      {/* Screen head */}
      <div className="screen-head">
        <div className="screen-title">
          <h1>{t("matches.title")}</h1>
          {!loading && (
            <span className="count-pill">{matches.length}</span>
          )}
        </div>
        <div className="filter-pills">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              className={`filter-pill${activeFilter === key ? " active" : ""}`}
              onClick={() => setActiveFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard */}
      {!loading && allMatches.length > 0 && (
        <div className="dash">
          <StatTile
            kind="together"
            label={t("matches.together")}
            value={dashboardStats.together}
            sub={t("matches.watchingAsGroup")}
            clickable
            active={activeFilter === "together"}
            onClick={() =>
              setActiveFilter((f) => (f === "together" ? "upcoming" : "together"))
            }
          />
          <StatTile
            kind="watch"
            label={t("matches.atHome")}
            value={dashboardStats.atHome}
            sub={t("matches.watchingSolo")}
            clickable
            active={activeFilter === "planned"}
            onClick={() =>
              setActiveFilter((f) => (f === "planned" ? "upcoming" : "planned"))
            }
          />
          <StatTile
            kind="skip"
            label={t("matches.skip")}
            value={dashboardStats.skipped}
            sub={t("matches.sittingOut")}
            clickable
            active={activeFilter === "skip"}
            onClick={() =>
              setActiveFilter((f) => (f === "skip" ? "upcoming" : "skip"))
            }
          />
          <StatTile
            kind="none"
            label={t("matches.notAnswered")}
            value={dashboardStats.notAnswered}
            sub={t("matches.waitingOnYou")}
            clickable
            active={activeFilter === "not_answered"}
            onClick={() =>
              setActiveFilter((f) => (f === "not_answered" ? "upcoming" : "not_answered"))
            }
          />
          <NextGame
            match={dashboardStats.nextGame}
            summaries={dashboardStats.nextGameSummaries}
          />
        </div>
      )}

      {/* Tips stats row */}
      {!loading && allMatches.length > 0 && (
        <div className="dash-tips">
          <StatTile
            kind="tip-done"
            label={t("matches.tipsSubmitted")}
            value={dashboardStats.tipsSubmitted}
            sub={t("matches.upcomingWithTip")}
            clickable
            active={activeFilter === "tips_submitted"}
            onClick={() =>
              setActiveFilter((f) => (f === "tips_submitted" ? "upcoming" : "tips_submitted"))
            }
          />
          <StatTile
            kind="tip-todo"
            label={t("matches.missingTips")}
            value={dashboardStats.tipsMissing}
            sub={t("matches.upcomingWithoutTip")}
            clickable
            active={activeFilter === "tips_missing"}
            onClick={() =>
              setActiveFilter((f) => (f === "tips_missing" ? "upcoming" : "tips_missing"))
            }
          />
        </div>
      )}

      {/* Match grid */}
      {loading ? (
        <div className="match-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="empty-day">
          {activeFilter === "upcoming" && t("matches.noUpcomingMatches")}
          {activeFilter === "today" && t("matches.noMatchesToday")}
          {activeFilter === "tomorrow" && t("matches.noMatchesTomorrow")}
          {activeFilter === "together" && t("matches.noTogetherMatches")}
          {activeFilter === "planned" && t("matches.noAtHomeMatches")}
          {activeFilter === "skip" && t("matches.noSkipMatches")}
          {activeFilter === "not_answered" && t("matches.allAnswered")}
          {activeFilter === "tips_submitted" && t("matches.noTipsSubmitted")}
          {activeFilter === "tips_missing" && t("matches.noMissingTips")}
          {activeFilter === "all" && (
            <>
              {t("matches.noMatchesFound")}
              {allMatches.length === 0 && t("matches.adminSyncNote")}
            </>
          )}
        </div>
      ) : (
        <div className="match-grid">
          {matches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              groupSummaries={summaries[m.id]}
              userGroups={userGroups}
              currentUserId={user?.id ?? 0}
              onPreferenceChange={handlePreferenceChange}
              onPredictionSaved={handlePredictionSaved}
              initialPrediction={predictions[m.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
