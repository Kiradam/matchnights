import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import type { ManualReviewMatch } from "../../types";

interface ResolveForm {
  home_score: string;
  away_score: string;
  qualifier_team_name: string;
}

function MatchReviewCard({
  item,
  onResolved,
}: {
  item: ManualReviewMatch;
  onResolved: (matchId: number) => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [form, setForm] = useState<ResolveForm>({
    home_score: "",
    away_score: "",
    qualifier_team_name: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dt = new Date(item.match_datetime);
  const dateStr = dt.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = dt.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleResolve = async () => {
    const homeScore = parseInt(form.home_score);
    const awayScore = parseInt(form.away_score);

    if (isNaN(homeScore) || homeScore < 0) {
      setError("Please enter a valid home score (0 or more).");
      return;
    }
    if (isNaN(awayScore) || awayScore < 0) {
      setError("Please enter a valid away score (0 or more).");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/admin/predictions/${item.match_id}/resolve`, {
        home_score: homeScore,
        away_score: awayScore,
        qualifier_team_name: form.qualifier_team_name.trim() || null,
      });
      showToast(`${item.home_team} vs ${item.away_team} resolved`);
      onResolved(item.match_id);
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
          : "Failed to resolve match.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Match info */}
      <div>
        <div
          style={{
            fontFamily: "'Archivo', sans-serif",
            fontStretch: "125%",
            fontWeight: 800,
            fontSize: 16,
            color: "var(--text)",
            marginBottom: 4,
          }}
        >
          {item.home_team} vs {item.away_team}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-3)",
            flexWrap: "wrap",
          }}
        >
          <span>{item.stage}</span>
          <span>·</span>
          <span>
            {dateStr} · {timeStr}
          </span>
          <span>·</span>
          <span
            style={{
              background: "color-mix(in oklab, var(--gold) 15%, transparent)",
              color: "var(--gold)",
              border: "1px solid color-mix(in oklab, var(--gold) 30%, transparent)",
              borderRadius: 20,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {item.pending_predictions} {t("admin.predictionsPage.pending")}
          </span>
        </div>
      </div>

      {/* Resolve form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-3)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                textAlign: "center",
              }}
            >
              {t("admin.predictionsPage.home")}
            </label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={form.home_score}
              onChange={(e) =>
                setForm((f) => ({ ...f, home_score: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "8px 6px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: 20,
                fontWeight: 800,
                fontFamily: "'Archivo', sans-serif",
                fontVariantNumeric: "tabular-nums",
                textAlign: "center",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div
            style={{
              fontFamily: "'Archivo', sans-serif",
              fontWeight: 900,
              fontSize: 16,
              color: "var(--text-3)",
            }}
          >
            –
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-3)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                textAlign: "center",
              }}
            >
              {t("admin.predictionsPage.away")}
            </label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={form.away_score}
              onChange={(e) =>
                setForm((f) => ({ ...f, away_score: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "8px 6px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: 20,
                fontWeight: 800,
                fontFamily: "'Archivo', sans-serif",
                fontVariantNumeric: "tabular-nums",
                textAlign: "center",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <input
          type="text"
          placeholder={t("admin.predictionsPage.qualifier")}
          value={form.qualifier_team_name}
          onChange={(e) =>
            setForm((f) => ({ ...f, qualifier_team_name: e.target.value }))
          }
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--text)",
            fontSize: 13,
            fontWeight: 600,
            boxSizing: "border-box",
          }}
        />

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

        <button
          onClick={handleResolve}
          disabled={submitting}
          style={{
            padding: "9px 16px",
            borderRadius: 8,
            border: "none",
            background: "var(--text)",
            color: "var(--bg)",
            fontSize: 13,
            fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.6 : 1,
            transition: "opacity 0.15s",
            alignSelf: "flex-start",
          }}
        >
          {submitting ? t("admin.predictionsPage.resolving") : t("admin.predictionsPage.resolve")}
        </button>
      </div>
    </div>
  );
}

export function AdminPredictionsPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ManualReviewMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<ManualReviewMatch[]>("/admin/predictions/manual-review")
      .then((res) => {
        setItems(res.data);
        setFetchError(null);
      })
      .catch(() => {
        setFetchError(t("admin.predictionsPage.failedLoad"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  const handleResolved = (matchId: number) => {
    setItems((prev) => prev.filter((i) => i.match_id !== matchId));
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontFamily: "'Archivo', sans-serif",
            fontStretch: "125%",
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: "-0.02em",
            color: "var(--text)",
            textTransform: "uppercase",
          }}
        >
          {t("admin.predictionsPage.title")}
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4, fontWeight: 600 }}>
          {t("admin.predictionsPage.subtitle")}
        </p>
      </div>

      {loading ? (
        <div style={{ color: "var(--text-3)", fontSize: 14, fontWeight: 600 }}>
          {t("admin.predictionsPage.loading")}
        </div>
      ) : fetchError ? (
        <div
          style={{
            fontSize: 13,
            color: "var(--skip)",
            fontWeight: 600,
            background: "color-mix(in oklab, var(--skip) 10%, transparent)",
            borderRadius: 8,
            padding: "12px 16px",
          }}
        >
          {fetchError}
        </div>
      ) : items.length === 0 ? (
        <div style={{ color: "var(--text-3)", fontSize: 14, fontWeight: 600 }}>
          {t("admin.predictionsPage.noPending")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => (
            <MatchReviewCard
              key={item.match_id}
              item={item}
              onResolved={handleResolved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
