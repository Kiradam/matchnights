import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import type { Match, PreferenceChoice } from "../types";

const CHOICE_LABELS: Record<PreferenceChoice, string> = {
  watch: "Watch",
  watch_together: "Together",
  skip: "Skip",
};

const CHOICE_STYLES: Record<PreferenceChoice, string> = {
  watch: "bg-green-100 text-green-800 border-green-300",
  watch_together: "bg-blue-100 text-blue-800 border-blue-300",
  skip: "bg-gray-100 text-gray-600 border-gray-300",
};

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-gray-100 text-gray-600",
  live: "bg-red-100 text-red-700 font-semibold animate-pulse",
  finished: "bg-slate-100 text-slate-500",
  cancelled: "bg-orange-100 text-orange-600",
};

function MatchCard({ match, onPreferenceChange }: {
  match: Match;
  onPreferenceChange: (matchId: number, choice: PreferenceChoice | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const locked = match.status === "live" || match.status === "finished" || match.status === "cancelled";

  const dt = new Date(match.match_datetime);
  const dateStr = dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const timeStr = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const handleChoice = async (choice: PreferenceChoice) => {
    if (locked || saving) return;
    const isDeselect = match.my_preference === choice;
    setSaving(true);
    try {
      if (isDeselect) {
        await api.delete(`/matches/${match.id}/preference`);
        onPreferenceChange(match.id, null);
      } else {
        await api.put(`/matches/${match.id}/preference`, { choice });
        onPreferenceChange(match.id, choice);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 mb-1">{match.stage}</div>
          <div className="font-semibold text-gray-900 truncate">
            {match.home_team} <span className="text-gray-400 font-normal">vs</span> {match.away_team}
          </div>
          <div className="text-sm text-gray-500 mt-0.5">
            {dateStr} · {timeStr}
            {match.venue && <span className="ml-1">· {match.venue}</span>}
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[match.status] ?? ""}`}>
          {match.status}
        </span>
      </div>

      <div className="flex gap-2">
        {(["watch", "watch_together", "skip"] as PreferenceChoice[]).map((choice) => {
          const active = match.my_preference === choice;
          return (
            <button
              key={choice}
              disabled={locked || saving}
              onClick={() => handleChoice(choice)}
              className={`flex-1 py-1.5 text-xs font-medium rounded border transition-colors
                ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}
                ${active ? CHOICE_STYLES[choice] : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"}`}
            >
              {CHOICE_LABELS[choice]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MatchesPage() {
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState("");
  const fetchRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    const id = ++fetchRef.current;
    try {
      const { data } = await api.get<Match[]>("/matches", { params: { page_size: 200 } });
      if (id !== fetchRef.current) return;
      setAllMatches(data);
    } finally {
      if (id === fetchRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePreferenceChange = (matchId: number, choice: PreferenceChoice | null) => {
    setAllMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, my_preference: choice } : m))
    );
  };

  const stages = Array.from(new Set(allMatches.map((m) => m.stage))).sort();
  const matches = stageFilter ? allMatches.filter((m) => m.stage === stageFilter) : allMatches;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">
          Matches {!loading && <span className="text-sm font-normal text-gray-400">({matches.length})</span>}
        </h1>
        {stages.length > 1 && (
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1.5 text-gray-700 bg-white"
          >
            <option value="">All stages</option>
            {stages.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 h-28 animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-1/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
              <div className="flex gap-2">
                {[0, 1, 2].map(j => <div key={j} className="flex-1 h-7 bg-gray-100 rounded" />)}
              </div>
            </div>
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          No matches found.{allMatches.length === 0 && " An admin can sync match data from the Admin panel."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} onPreferenceChange={handlePreferenceChange} />
          ))}
        </div>
      )}
    </div>
  );
}
