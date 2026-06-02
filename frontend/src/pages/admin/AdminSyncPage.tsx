import { useEffect, useState } from "react";
import api from "../../api/axios";
import type { SyncState } from "../../types";

const DAILY_QUOTA = 100;

interface SyncResult {
  synced: number;
  skipped_parse_errors: number;
  rescheduled: number;
  cancelled: number;
  quota_used_today: number;
  last_sync_at: string;
  errors?: string[];
}

export function AdminSyncPage() {
  const [state, setState] = useState<SyncState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingOdds, setSyncingOdds] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [oddsResult, setOddsResult] = useState<{ updated: number; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oddsError, setOddsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadState = async () => {
    try {
      const { data } = await api.get<SyncState>("/admin/matches/sync-state");
      setState(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadState(); }, []);

  const triggerSync = async () => {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const { data } = await api.post<SyncResult>("/admin/matches/sync");
      setSyncResult(data);
      await loadState();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Sync failed";
      setError(msg);
    } finally {
      setSyncing(false);
    }
  };

  const triggerOddsSync = async () => {
    setSyncingOdds(true);
    setOddsError(null);
    setOddsResult(null);
    try {
      const { data } = await api.post<{ updated: number; message?: string }>("/admin/matches/sync-odds");
      setOddsResult(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Odds sync failed";
      setOddsError(msg);
    } finally {
      setSyncingOdds(false);
    }
  };

  const usedToday = state ? DAILY_QUOTA - (state.quota_remaining ?? 0) : 0;
  const quotaExhausted = (state?.quota_remaining ?? 1) <= 0;
  const barColor =
    usedToday >= 90 ? "bg-red-500" : usedToday >= 60 ? "bg-orange-400" : "bg-green-500";

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Match Sync</h2>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 mb-4">
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last sync</div>
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {loading ? "…" : state?.last_sync_at ? new Date(state.last_sync_at).toLocaleString() : "Never"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              API requests today ({DAILY_QUOTA}/day limit)
            </div>
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {loading ? "…" : `${usedToday} / ${DAILY_QUOTA}`}
            </div>
            <div className="mt-1 h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(100, (usedToday / DAILY_QUOTA) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={triggerSync}
            disabled={syncing || quotaExhausted}
            className="px-5 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded hover:bg-gray-700 dark:hover:bg-white disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync matches now"}
          </button>
          <button
            onClick={triggerOddsSync}
            disabled={syncingOdds}
            className="px-5 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {syncingOdds ? "Syncing odds…" : "Sync odds"}
          </button>
        </div>
        {quotaExhausted && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">Daily API quota exhausted. Try again tomorrow.</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-4">
          {error}
        </div>
      )}

      {oddsError && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-4">
          {oddsError}
        </div>
      )}

      {oddsResult && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 mb-4 text-sm text-green-800 dark:text-green-400">
          {oddsResult.message
            ? oddsResult.message
            : `Odds updated for ${oddsResult.updated} match${oddsResult.updated !== 1 ? "es" : ""}.`}
        </div>
      )}

      {syncResult && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 mb-4">
          <div className="text-sm font-medium text-green-800 dark:text-green-400 mb-2">Sync complete</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {([
              ["Synced", syncResult.synced],
              ["Rescheduled", syncResult.rescheduled],
              ["Cancelled", syncResult.cancelled],
              ["Parse errors", syncResult.skipped_parse_errors],
            ] as [string, number][]).map(([label, val]) => (
              <div key={label}>
                <span className="text-gray-500 dark:text-gray-400">{label}: </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{val}</span>
              </div>
            ))}
          </div>
          {syncResult.errors && syncResult.errors.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                {syncResult.errors.length} error(s)
              </summary>
              <ul className="mt-1 text-xs text-red-600 dark:text-red-400 space-y-0.5">
                {syncResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {state?.last_sync_result && !syncResult && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Last sync result</div>
          <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {JSON.stringify(state.last_sync_result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
