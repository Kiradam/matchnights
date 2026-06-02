import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../contexts/AuthContext";
import type { GroupPreferenceSummary, Match } from "../types";
import type { PreferenceChoice } from "../types";

const CHOICE_LABELS: Record<PreferenceChoice, string> = {
  watch_together: "Together",
  watch: "Watch",
  skip: "Skip",
};

const CHOICE_DOT: Record<PreferenceChoice, string> = {
  watch_together: "bg-green-400",
  watch: "bg-blue-400",
  skip: "bg-gray-300 dark:bg-gray-600",
};

function CrestImg({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      className="w-12 h-12 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [summaries, setSummaries] = useState<GroupPreferenceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<Match>(`/matches/${id}`),
      api.get<GroupPreferenceSummary[]>(`/matches/${id}/preferences`),
    ])
      .then(([matchRes, prefsRes]) => {
        setMatch(matchRes.data);
        setSummaries(prefsRes.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-20 text-gray-400 dark:text-gray-500">
        Match not found.{" "}
        <Link to="/matches" className="text-gray-600 dark:text-gray-300 underline">
          Back to matches
        </Link>
      </div>
    );
  }

  const dt = new Date(match.match_datetime);
  const dateStr = dt.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to="/matches"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
      >
        ← Back to matches
      </Link>

      {/* Match header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-4">
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center mb-4">
          {match.stage}
          {match.matchday != null && match.stage.toLowerCase().startsWith("group") && (
            <span className="ml-1.5">· MD{match.matchday}</span>
          )}
        </div>

        <div className="flex items-center justify-center gap-6 mb-4">
          <div className="flex flex-col items-center gap-2 flex-1">
            <CrestImg src={match.home_team_crest} alt={match.home_team} />
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-center">{match.home_team}</span>
          </div>
          <span className="text-2xl text-gray-300 dark:text-gray-600 font-light">vs</span>
          <div className="flex flex-col items-center gap-2 flex-1">
            <CrestImg src={match.away_team_crest} alt={match.away_team} />
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-center">{match.away_team}</span>
          </div>
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {dateStr} · {timeStr}
          {match.venue && <div className="mt-0.5">{match.venue}</div>}
        </div>

        {(match.home_odds || match.draw_odds || match.away_odds) && (
          <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            {[
              { label: "1", value: match.home_odds, name: match.home_team },
              { label: "X", value: match.draw_odds, name: "Draw" },
              { label: "2", value: match.away_odds, name: match.away_team },
            ].map(({ label, value, name }) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <span className="text-xs text-gray-400 dark:text-gray-500">{name}</span>
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{label}</span>
                <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {value != null ? value.toFixed(2) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Group preferences */}
      {summaries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Group preferences</h2>
          {summaries.map((gs) => (
            <div
              key={gs.group_id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpanded((prev) => (prev === gs.group_id ? null : gs.group_id))}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
              >
                <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{gs.group_name}</span>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {gs.watch_together > 0 && (
                    <span className="text-green-700 dark:text-green-400">{gs.watch_together} together</span>
                  )}
                  {gs.watch > 0 && (
                    <span className="text-blue-700 dark:text-blue-400">{gs.watch} watch</span>
                  )}
                  {gs.skip > 0 && (
                    <span>{gs.skip} skip</span>
                  )}
                  {gs.no_response > 0 && (
                    <span className="text-gray-300 dark:text-gray-600">{gs.no_response}?</span>
                  )}
                  <span className="text-gray-300 dark:text-gray-600">
                    {expanded === gs.group_id ? "▴" : "▾"}
                  </span>
                </div>
              </button>

              {expanded === gs.group_id && (
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                  {gs.members.map((m) => (
                    <div key={m.user_id} className="flex items-center justify-between">
                      <span
                        className={`text-sm truncate max-w-[65%] ${
                          m.user_id === user?.id
                            ? "font-medium text-gray-900 dark:text-gray-100"
                            : m.is_active
                            ? "text-gray-700 dark:text-gray-300"
                            : "text-gray-400 dark:text-gray-600 line-through"
                        }`}
                      >
                        {m.full_name}
                        {m.user_id === user?.id && (
                          <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal text-xs">(you)</span>
                        )}
                      </span>
                      {m.choice ? (
                        <span className="flex items-center gap-1.5 text-sm">
                          <span className={`w-2 h-2 rounded-full ${CHOICE_DOT[m.choice]}`} />
                          <span className="text-gray-600 dark:text-gray-400 text-xs">
                            {CHOICE_LABELS[m.choice]}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
