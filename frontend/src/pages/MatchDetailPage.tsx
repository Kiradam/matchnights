import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../contexts/AuthContext";
import type { Group, GroupPreferenceSummary, Match, PreferenceChoice } from "../types";
import { CHOICE_DOT, CHOICE_LABELS } from "../utils/choices";

const CHOICE_ORDER: PreferenceChoice[] = ["watch_together", "watch", "skip"];

const CHOICE_STYLES: Record<PreferenceChoice, string> = {
  watch_together: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
  watch: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  skip: "bg-slate-200 text-slate-700 border-slate-400 dark:bg-slate-600 dark:text-slate-100 dark:border-slate-500",
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

function GroupSelectorModal({
  groups,
  onSelect,
  onCancel,
}: {
  groups: Group[];
  onSelect: (groupId: number) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl w-full max-w-xs p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Set "Together" for…
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Which group should this preference apply to?
        </div>
        <div className="space-y-2">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelect(g.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              {g.name}
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="mt-3 w-full text-center text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [summaries, setSummaries] = useState<GroupPreferenceSummary[]>([]);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<PreferenceChoice | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

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
    const currentChoice = match.my_preferences.find((p) => p.group_id === groupId)?.choice;
    const isDeselect = currentChoice === choice;
    setSaving(true);
    try {
      if (isDeselect) {
        await api.delete(`/matches/${match.id}/preference`, { params: { group_id: groupId } });
        updatePreference(groupId, null);
      } else {
        await api.put(`/matches/${match.id}/preference`, { choice, group_id: groupId });
        updatePreference(groupId, choice);
      }
    } finally {
      setSaving(false);
    }
  };

  const applyChoiceAllGroups = async (choice: PreferenceChoice) => {
    if (!match) return;
    const allHaveChoice = userGroups.every(
      (g) => match.my_preferences.find((p) => p.group_id === g.id)?.choice === choice
    );
    setSaving(true);
    try {
      await Promise.all(
        userGroups.map(async (g) => {
          if (allHaveChoice) {
            await api.delete(`/matches/${match.id}/preference`, { params: { group_id: g.id } });
            updatePreference(g.id, null);
          } else {
            await api.put(`/matches/${match.id}/preference`, { choice, group_id: g.id });
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
    if (userGroups.length === 1) {
      applyChoice(choice, userGroups[0].id);
    } else if (choice === "watch_together") {
      setPendingChoice(choice);
    } else {
      applyChoiceAllGroups(choice);
    }
  };

  const isButtonActive = (choice: PreferenceChoice): boolean => {
    if (!match || userGroups.length === 0) return false;
    if (choice === "watch_together" && userGroups.length > 1) return false;
    return userGroups.every(
      (g) => match.my_preferences.find((p) => p.group_id === g.id)?.choice === choice
    );
  };

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

  const locked = match.status === "live" || match.status === "finished" || match.status === "cancelled";

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
      {pendingChoice && (
        <GroupSelectorModal
          groups={userGroups}
          onSelect={(groupId) => { applyChoice(pendingChoice, groupId); setPendingChoice(null); }}
          onCancel={() => setPendingChoice(null)}
        />
      )}

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

        {/* Preference buttons */}
        {userGroups.length > 0 && (
          <div className="flex gap-2 mt-5 pt-5 border-t border-gray-100 dark:border-gray-700">
            {CHOICE_ORDER.map((choice) => {
              const active = isButtonActive(choice);
              return (
                <button
                  key={choice}
                  disabled={locked || saving}
                  onClick={() => handleChoice(choice)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors
                    ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}
                    ${active
                      ? CHOICE_STYLES[choice]
                      : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                >
                  {CHOICE_LABELS[choice]}
                </button>
              );
            })}
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
