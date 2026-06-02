import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { MatchCardSkeleton } from "../components/MatchCardSkeleton";
import { useAuth } from "../contexts/AuthContext";
import type {
  Group,
  GroupPreferenceSummary,
  Match,
  PreferenceChoice,
} from "../types";
import { CHOICE_DOT, CHOICE_LABELS } from "../utils/choices";

const CHOICE_ORDER: PreferenceChoice[] = ["watch_together", "watch", "skip"];

const CHOICE_STYLES: Record<PreferenceChoice, string> = {
  watch_together: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
  watch: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  skip: "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
};

type FilterMode = "all" | "today" | "together" | "planned";

// ── Helpers ──────────────────────────────────────────────────────────────────

function isToday(m: Match): boolean {
  const d = new Date(m.match_datetime);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function hasMyChoice(m: Match, choices: PreferenceChoice[]): boolean {
  return m.my_preferences.some((p) => p.choice !== null && choices.includes(p.choice as PreferenceChoice));
}

// ── Group selector modal ──────────────────────────────────────────────────────

function GroupSelectorModal({
  groups,
  pendingChoice,
  onSelect,
  onCancel,
}: {
  groups: Group[];
  pendingChoice: PreferenceChoice;
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
          Set "{CHOICE_LABELS[pendingChoice]}" for…
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

// ── Per-group collapsible panel ───────────────────────────────────────────────

function GroupPanel({
  summary,
  currentUserId,
  expanded,
  onToggle,
}: {
  summary: GroupPreferenceSummary;
  currentUserId: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  // Only members who said Together, plus the current user (regardless of choice)
  const visibleMembers = summary.members.filter(
    (m) => m.user_id === currentUserId || m.choice === "watch_together"
  );

  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors text-left"
      >
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate max-w-[55%]">
          {summary.group_name}
        </span>
        <div className="flex items-center gap-2 text-xs shrink-0">
          {summary.watch_together > 0 && (
            <span className="flex items-center gap-0.5 text-green-700 dark:text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              {summary.watch_together}
            </span>
          )}
          {summary.no_response > 0 && (
            <span className="text-gray-300 dark:text-gray-600">{summary.no_response}?</span>
          )}
          <span className="text-gray-300 dark:text-gray-600 ml-1">{expanded ? "▴" : "▾"}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 py-2 space-y-1.5 bg-white dark:bg-gray-800">
          {visibleMembers.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 py-1">No one has said Together yet.</p>
          ) : (
            visibleMembers.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between">
                <span
                  className={`text-xs truncate max-w-[65%] ${
                    m.user_id === currentUserId
                      ? "font-medium text-gray-800 dark:text-gray-200"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {m.full_name}
                  {m.user_id === currentUserId && (
                    <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">(you)</span>
                  )}
                </span>
                {m.choice ? (
                  <span className="flex items-center gap-1 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full ${CHOICE_DOT[m.choice]}`} />
                    <span className="text-gray-600 dark:text-gray-400">{CHOICE_LABELS[m.choice]}</span>
                  </span>
                ) : (
                  <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Crest image ───────────────────────────────────────────────────────────────

function CrestImg({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      className="w-7 h-7 object-contain shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

// ── Match card ────────────────────────────────────────────────────────────────

function togetherPct(summaries: GroupPreferenceSummary[]): number {
  const total = summaries.reduce((s, g) => s + g.watch + g.watch_together + g.skip, 0);
  if (total < 2) return 0;
  const together = summaries.reduce((s, g) => s + g.watch_together, 0);
  return together / total;
}

function MatchCard({
  match,
  groupSummaries,
  userGroups,
  currentUserId,
  onPreferenceChange,
}: {
  match: Match;
  groupSummaries: GroupPreferenceSummary[] | undefined;
  userGroups: Group[];
  currentUserId: number;
  onPreferenceChange: (matchId: number, groupId: number, choice: PreferenceChoice | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [pendingChoice, setPendingChoice] = useState<PreferenceChoice | null>(null);

  const locked =
    match.status === "live" ||
    match.status === "finished" ||
    match.status === "cancelled";

  const isHot = groupSummaries ? togetherPct(groupSummaries) >= 0.5 : false;

  const dt = new Date(match.match_datetime);
  const dateStr = dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const timeStr = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const applyChoice = async (choice: PreferenceChoice, groupId: number) => {
    if (locked || saving) return;
    const currentChoice = match.my_preferences.find((p) => p.group_id === groupId)?.choice;
    const isDeselect = currentChoice === choice;
    setSaving(true);
    try {
      if (isDeselect) {
        await api.delete(`/matches/${match.id}/preference`, { params: { group_id: groupId } });
        onPreferenceChange(match.id, groupId, null);
      } else {
        await api.put(`/matches/${match.id}/preference`, { choice, group_id: groupId });
        onPreferenceChange(match.id, groupId, choice);
      }
    } finally {
      setSaving(false);
    }
  };

  const applyChoiceAllGroups = async (choice: PreferenceChoice) => {
    if (locked || saving) return;
    const allHaveChoice = userGroups.every(
      (g) => match.my_preferences.find((p) => p.group_id === g.id)?.choice === choice
    );
    setSaving(true);
    try {
      await Promise.all(
        userGroups.map(async (g) => {
          if (allHaveChoice) {
            await api.delete(`/matches/${match.id}/preference`, { params: { group_id: g.id } });
            onPreferenceChange(match.id, g.id, null);
          } else {
            await api.put(`/matches/${match.id}/preference`, { choice, group_id: g.id });
            onPreferenceChange(match.id, g.id, choice);
          }
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChoice = (choice: PreferenceChoice) => {
    if (locked || saving) return;
    if (userGroups.length === 0) return;
    if (userGroups.length === 1) {
      applyChoice(choice, userGroups[0].id);
    } else if (choice === "watch_together") {
      setPendingChoice(choice);
    } else {
      applyChoiceAllGroups(choice);
    }
  };

  const handleModalSelect = (groupId: number) => {
    if (pendingChoice) applyChoice(pendingChoice, groupId);
    setPendingChoice(null);
  };

  const isButtonActive = (choice: PreferenceChoice): boolean => {
    if (userGroups.length === 0) return false;
    if (choice === "watch_together" && userGroups.length > 1) return false;
    return userGroups.every(
      (g) => match.my_preferences.find((p) => p.group_id === g.id)?.choice === choice
    );
  };

  const cardCls = isHot
    ? "bg-white dark:bg-gray-800 rounded-lg border border-green-300 dark:border-green-700 p-4 shadow-sm shadow-green-100 dark:shadow-none hover:border-green-400 dark:hover:border-green-500 hover:shadow-md transition-all duration-150"
    : "bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-md transition-all duration-150";

  return (
    <>
      {pendingChoice && (
        <GroupSelectorModal
          groups={userGroups}
          pendingChoice={pendingChoice}
          onSelect={handleModalSelect}
          onCancel={() => setPendingChoice(null)}
        />
      )}

      <div className={cardCls}>
        <Link to={`/matches/${match.id}`} className="block mb-3 hover:opacity-80 transition-opacity">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-center gap-1.5">
            {match.stage}
            {match.matchday != null && match.stage.toLowerCase().startsWith("group") && (
              <span className="text-gray-400 dark:text-gray-500">· MD{match.matchday}</span>
            )}
            {isHot && (
              <span className="text-green-600 dark:text-green-500 font-medium">· Together</span>
            )}
          </div>
          <div className="flex items-center justify-center gap-3 font-semibold text-gray-900 dark:text-gray-100 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <CrestImg src={match.home_team_crest} alt={match.home_team} />
              <span className="truncate">{match.home_team}</span>
            </div>
            <span className="text-gray-400 dark:text-gray-500 font-normal shrink-0">vs</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate">{match.away_team}</span>
              <CrestImg src={match.away_team_crest} alt={match.away_team} />
            </div>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
            {dateStr} · {timeStr}
            {match.venue && <span className="ml-1">· {match.venue}</span>}
          </div>
          {(match.home_odds || match.draw_odds || match.away_odds) && (
            <div className="flex justify-center gap-3 mt-2">
              {[
                { label: "1", value: match.home_odds },
                { label: "X", value: match.draw_odds },
                { label: "2", value: match.away_odds },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {value != null ? value.toFixed(2) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Link>

        {userGroups.length > 0 && (
          <div className="flex gap-2 mb-3">
            {CHOICE_ORDER.map((choice) => {
              const active = isButtonActive(choice);
              return (
                <button
                  key={choice}
                  disabled={locked || saving}
                  onClick={() => handleChoice(choice)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded border transition-colors
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

        {groupSummaries && groupSummaries.length > 0 && (
          <div className="space-y-1.5 mt-1">
            {groupSummaries.map((gs) => (
              <GroupPanel
                key={gs.group_id}
                summary={gs}
                currentUserId={currentUserId}
                expanded={expandedGroup === gs.group_id}
                onToggle={() =>
                  setExpandedGroup((prev) => (prev === gs.group_id ? null : gs.group_id))
                }
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Mini dashboard ────────────────────────────────────────────────────────────

function Dashboard({
  total,
  interested,
  undecided,
  potentiallyTogether,
  nextGame,
  onFilterChange,
}: {
  total: number;
  interested: number;
  undecided: number;
  potentiallyTogether: number;
  nextGame: Match | undefined;
  onFilterChange: (f: FilterMode) => void;
}) {
  type StatCardDef = {
    label: string;
    value: number;
    gradient: string;
    border: string;
    valueColor: string;
    tagLabel?: string;
    tagColor?: string;
    onClick?: () => void;
  };

  const statCards: StatCardDef[] = [
    {
      label: "Total matches",
      value: total,
      gradient: "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-800/20",
      border: "border-slate-200 dark:border-slate-700",
      valueColor: "text-slate-800 dark:text-slate-100",
    },
    {
      label: "I'm watching",
      value: interested,
      gradient: "bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/60 dark:to-indigo-900/30",
      border: "border-blue-200 dark:border-blue-800",
      valueColor: "text-blue-700 dark:text-blue-300",
      tagLabel: "PLANNED",
      tagColor: "text-blue-500 dark:text-blue-400",
      onClick: () => onFilterChange("planned"),
    },
    {
      label: "Potentially together",
      value: potentiallyTogether,
      gradient: "bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/60 dark:to-emerald-900/30",
      border: "border-green-200 dark:border-green-800",
      valueColor: "text-green-700 dark:text-green-300",
      tagLabel: "TOGETHER",
      tagColor: "text-green-600 dark:text-green-400",
      onClick: () => onFilterChange("together"),
    },
    {
      label: "Not decided yet",
      value: undecided,
      gradient: "bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/60 dark:to-orange-900/30",
      border: "border-amber-200 dark:border-amber-800",
      valueColor: "text-amber-600 dark:text-amber-400",
    },
  ];

  const nextDt = nextGame ? new Date(nextGame.match_datetime) : null;
  const nextDateStr = nextDt?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const nextTimeStr = nextDt?.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
      {statCards.map((card) => {
        const Comp = card.onClick ? "button" : "div";
        return (
          <Comp
            key={card.label}
            onClick={card.onClick}
            className={[
              card.gradient,
              "border",
              card.border,
              "rounded-xl p-3.5 relative overflow-hidden shadow-sm text-left transition-all duration-150",
              card.onClick
                ? "cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.99]"
                : "",
            ].join(" ")}
          >
            {/* ghost watermark */}
            <span className="absolute right-1 -bottom-2 text-7xl font-black opacity-[0.06] select-none pointer-events-none leading-none tabIndex={-1}">
              {card.value}
            </span>
            {card.tagLabel && (
              <span className={`text-[9px] font-bold uppercase tracking-widest ${card.tagColor} mb-1 block`}>
                {card.tagLabel}
              </span>
            )}
            <span className={`text-3xl font-bold ${card.valueColor} relative z-10 leading-none`}>
              {card.value}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 relative z-10 mt-1 block leading-snug">
              {card.label}
            </span>
          </Comp>
        );
      })}

      {nextGame ? (
        <Link
          to={`/matches/${nextGame.id}`}
          className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all col-span-2 sm:col-span-1"
        >
          <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-400 mb-1">
            Your next game
          </div>
          <div className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
            {nextGame.home_team} <span className="font-normal text-gray-400">vs</span> {nextGame.away_team}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {nextDateStr} · {nextTimeStr}
          </div>
        </Link>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-3.5 col-span-2 sm:col-span-1 flex items-center justify-center">
          <span className="text-xs text-gray-400 dark:text-gray-500 text-center">No upcoming games on your watchlist</span>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const FILTERS: { key: FilterMode; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "together", label: "Together" },
  { key: "planned", label: "Planned" },
];

export function MatchesPage() {
  const { user } = useAuth();
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterMode>("all");
  const [summaries, setSummaries] = useState<Record<number, GroupPreferenceSummary[]>>({});
  const fetchRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    const id = ++fetchRef.current;
    try {
      const [matchesRes, groupsRes] = await Promise.all([
        api.get<Match[]>("/matches", { params: { page_size: 200 } }),
        api.get<Group[]>("/groups/me"),
      ]);

      if (id !== fetchRef.current) return;
      setAllMatches(matchesRes.data);
      setUserGroups(groupsRes.data);

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

  useEffect(() => { load(); }, [load]);

  const handlePreferenceChange = (
    matchId: number,
    groupId: number,
    choice: PreferenceChoice | null
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
          const prevChoice = gs.members.find((m) => m.user_id === user?.id)?.choice ?? null;
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
            no_response: Math.max(0, gs.no_response + (!choice ? 1 : 0) - (!prevChoice ? 1 : 0)),
            members: gs.members.map((m) =>
              m.user_id !== user?.id ? m : { ...m, choice }
            ),
          };
        }),
      };
    });
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const interested = allMatches.filter((m) => hasMyChoice(m, ["watch", "watch_together"])).length;
    const potentiallyTogether = allMatches.filter((m) =>
      (summaries[m.id] ?? []).some((g) => g.watch_together > 0)
    ).length;
    const nextGame = allMatches
      .filter((m) => new Date(m.match_datetime) > now && hasMyChoice(m, ["watch", "watch_together"]))
      .sort((a, b) => new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime())[0];
    const undecided = allMatches.length - interested;
    return { interested, potentiallyTogether, nextGame, undecided };
  }, [allMatches, summaries]);

  const matches = useMemo(() => {
    if (activeFilter === "today") {
      return allMatches.filter(isToday);
    }
    if (activeFilter === "together") {
      return allMatches
        .filter((m) => hasMyChoice(m, ["watch_together"]))
        .sort((a, b) => {
          const scoreA = (summaries[a.id] ?? []).reduce((s, g) => s + g.watch_together, 0);
          const scoreB = (summaries[b.id] ?? []).reduce((s, g) => s + g.watch_together, 0);
          return scoreB - scoreA || new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime();
        });
    }
    if (activeFilter === "planned") {
      return allMatches.filter(
        (m) => hasMyChoice(m, ["watch"]) && !hasMyChoice(m, ["watch_together"])
      );
    }
    return allMatches;
  }, [allMatches, activeFilter, summaries]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Matches{" "}
          {!loading && (
            <span className="text-sm font-normal text-gray-400 dark:text-gray-500">
              ({matches.length})
            </span>
          )}
        </h1>

        {/* Filter pills */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors
                ${activeFilter === key
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Mini dashboard */}
      {!loading && allMatches.length > 0 && (
        <Dashboard
          total={allMatches.length}
          interested={dashboardStats.interested}
          undecided={dashboardStats.undecided}
          potentiallyTogether={dashboardStats.potentiallyTogether}
          nextGame={dashboardStats.nextGame}
          onFilterChange={setActiveFilter}
        />
      )}

      {/* Match grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          {activeFilter === "today" && "No matches today."}
          {activeFilter === "together" && "You haven't marked any matches as Together yet."}
          {activeFilter === "planned" && "No matches marked as Watch (without Together)."}
          {activeFilter === "all" && (
            <>
              No matches found.
              {allMatches.length === 0 && " An admin can sync match data from the Admin panel."}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {matches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              groupSummaries={summaries[m.id]}
              userGroups={userGroups}
              currentUserId={user?.id ?? 0}
              onPreferenceChange={handlePreferenceChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
