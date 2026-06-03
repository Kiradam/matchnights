import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { MatchCardSkeleton } from "../components/MatchCardSkeleton";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import type {
  Group,
  GroupMemberPreference,
  GroupPreferenceSummary,
  Match,
  PreferenceChoice,
} from "../types";

const CHOICE_ORDER: PreferenceChoice[] = ["watch_together", "watch", "skip"];

type FilterMode = "all" | "today" | "together" | "planned";

// ── Helpers ──────────────────────────────────────────────────────────────────

function isToday(m: Match): boolean {
  const d = new Date(m.match_datetime);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

function hasMyChoice(m: Match, choices: PreferenceChoice[]): boolean {
  return m.my_preferences.some(
    (p) => p.choice !== null && choices.includes(p.choice as PreferenceChoice)
  );
}

function relativeKick(dt: Date): string {
  const now = new Date();
  const diffMs = dt.getTime() - now.getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < 0) return "Live / done";
  if (diffH < 1) return `in ${Math.round(diffMs / 60_000)} min`;
  if (diffH < 24 && isToday({ match_datetime: dt.toISOString() } as Match))
    return "Today";
  if (diffH < 48) return "Tomorrow";
  return `in ${Math.round(diffH / 24)} days`;
}

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
    { choice: "watch_together" as const, label: "Together", Icon: TogetherIcon },
    { choice: "watch" as const, label: "At home", Icon: WatchIcon },
    { choice: "skip" as const, label: "Skip", Icon: SkipIcon },
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
          {homeTla} vs {awayTla} — pick the group you'll be Together with. The rest see you're watching at home.
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

  const STATUS_LABEL: Record<string, string> = {
    watch_together: "Together",
    watch: "At home",
    skip: "Skip",
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
            together
          </span>
          <span className="chev">
            <ChevronIcon />
          </span>
        </span>
      </button>

      {open && (
        <div className="gpanel-body">
          {summary.members.map((m: GroupMemberPreference) => {
            const color = avatarColor(m.full_name);
            const isMe = m.user_id === currentUserId;
            const statusKey = m.choice ?? "none";
            return (
              <div className="member" key={m.user_id}>
                <span className="av" style={{ background: color }}>
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

// ── Match card ────────────────────────────────────────────────────────────────

function togetherPct(summaries: GroupPreferenceSummary[]): number {
  const responded = summaries.reduce(
    (s, g) => s + g.watch + g.watch_together + g.skip,
    0
  );
  if (responded < 2) return 0;
  const together = summaries.reduce((s, g) => s + g.watch_together, 0);
  return together / responded;
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
  onPreferenceChange: (
    matchId: number,
    groupId: number,
    choice: PreferenceChoice | null,
    prevChoice: PreferenceChoice | null
  ) => void;
}) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<PreferenceChoice | null>(null);

  const locked =
    match.status === "live" ||
    match.status === "finished" ||
    match.status === "cancelled";

  const isHot = groupSummaries ? togetherPct(groupSummaries) >= 0.5 : false;
  const isSkipped =
    hasMyChoice(match, ["skip"]) &&
    !hasMyChoice(match, ["watch", "watch_together"]);

  const dt = new Date(match.match_datetime);
  const dateStr = dt.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeStr = dt.toLocaleTimeString("en-GB", {
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
    watch_together: "Together",
    watch: "At home",
    skip: "Skip",
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

  const odds = [
    { k: "1", v: match.home_odds },
    { k: "X", v: match.draw_odds },
    { k: "2", v: match.away_odds },
  ];
  const hasOdds = odds.some((o) => o.v != null);
  const minOdds = hasOdds
    ? Math.min(...odds.filter((o) => o.v != null).map((o) => o.v!))
    : null;

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

      <article
        className={`card${isHot ? " matchon" : ""}${isSkipped ? " skipped" : ""}`}
      >
        {/* Card head */}
        <div className="card-head">
          <span className="group-chip">
            {match.stage}
            {match.matchday != null &&
              match.stage.toLowerCase().startsWith("group") && (
                <> · MD {match.matchday}</>
              )}
          </span>
          {isHot ? (
            <span className="status-tag matchon-tag">
              <span className="dot" />
              Match on
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
            <div className="score-mid">VS</div>
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
          <span className="ko-rel">{relativeKick(dt)}</span>
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
          <PrefControl
            match={match}
            userGroups={userGroups}
            locked={locked}
            saving={saving}
            onChoice={handleChoice}
          />
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
        <span className="stat-sub">No upcoming games on your watchlist</span>
      </div>
    );
  }

  const dt = new Date(match.match_datetime);
  const dateStr = dt.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeStr = dt.toLocaleTimeString("en-GB", {
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
    <Link to={`/matches/${match.id}`} style={{ textDecoration: "none" }}>
      <div className="stat next-game">
        <div className="ng-label">
          <span className="ng-live" />
          Your next game
        </div>
        <div className="ng-teams">
          {homeTla}
          <span className="vs">vs</span>
          {awayTla}
        </div>
        <div className="ng-meta">
          <span>
            {dateStr} · {timeStr}
          </span>
          <span>·</span>
          <span>{relativeKick(dt)}</span>
          {isTogether && (
            <>
              <span>·</span>
              <span className="ng-badge">
                Together · {togetherCount}/{totalCount}
              </span>
            </>
          )}
          {!isTogether && (
            <>
              <span>·</span>
              <span className="ng-badge">At home</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const FILTERS: { key: FilterMode; label: string; dot?: boolean }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "together", label: "Together", dot: true },
  { key: "planned", label: "At Home" },
];

export function MatchesPage() {
  const { user } = useAuth();
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterMode>("all");
  const [summaries, setSummaries] = useState<
    Record<number, GroupPreferenceSummary[]>
  >({});
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

  // ── Derived data ────────────────────────────────────────────────────────────

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const together = allMatches.filter((m) =>
      hasMyChoice(m, ["watch_together"])
    ).length;
    const atHome = allMatches.filter(
      (m) =>
        hasMyChoice(m, ["watch"]) && !hasMyChoice(m, ["watch_together"])
    ).length;
    const skipped = allMatches.filter(
      (m) =>
        hasMyChoice(m, ["skip"]) &&
        !hasMyChoice(m, ["watch", "watch_together"])
    ).length;
    const notAnswered = allMatches.filter(
      (m) => !hasMyChoice(m, ["watch", "watch_together", "skip"])
    ).length;
    const nextGame = allMatches
      .filter(
        (m) =>
          new Date(m.match_datetime) > now &&
          hasMyChoice(m, ["watch", "watch_together"])
      )
      .sort(
        (a, b) =>
          new Date(a.match_datetime).getTime() -
          new Date(b.match_datetime).getTime()
      )[0];
    const nextGameSummaries = nextGame ? (summaries[nextGame.id] ?? []) : [];
    return { together, atHome, skipped, notAnswered, nextGame, nextGameSummaries };
  }, [allMatches, summaries]);

  const matches = useMemo(() => {
    if (activeFilter === "today") return allMatches.filter(isToday);
    if (activeFilter === "together")
      return allMatches
        .filter((m) => hasMyChoice(m, ["watch_together"]))
        .sort((a, b) => {
          const scoreA = (summaries[a.id] ?? []).reduce(
            (s, g) => s + g.watch_together,
            0
          );
          const scoreB = (summaries[b.id] ?? []).reduce(
            (s, g) => s + g.watch_together,
            0
          );
          return (
            scoreB - scoreA ||
            new Date(a.match_datetime).getTime() -
              new Date(b.match_datetime).getTime()
          );
        });
    if (activeFilter === "planned")
      return allMatches.filter(
        (m) =>
          hasMyChoice(m, ["watch"]) && !hasMyChoice(m, ["watch_together"])
      );
    return allMatches;
  }, [allMatches, activeFilter, summaries]);

  return (
    <div>
      {/* Screen head */}
      <div className="screen-head">
        <div className="screen-title">
          <h1>Matches</h1>
          {!loading && (
            <span className="count-pill">{allMatches.length}</span>
          )}
        </div>
        <div className="filter-pills">
          {FILTERS.map(({ key, label, dot }) => (
            <button
              key={key}
              className={`filter-pill${activeFilter === key ? " active" : ""}`}
              onClick={() => setActiveFilter(key)}
            >
              {dot && activeFilter !== key && (
                <span className="dot" />
              )}
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
            label="Together"
            value={dashboardStats.together}
            sub="watching as a group"
            clickable
            active={activeFilter === "together"}
            onClick={() =>
              setActiveFilter((f) => (f === "together" ? "all" : "together"))
            }
          />
          <StatTile
            kind="watch"
            label="At Home"
            value={dashboardStats.atHome}
            sub="watching solo"
            clickable
            active={activeFilter === "planned"}
            onClick={() =>
              setActiveFilter((f) => (f === "planned" ? "all" : "planned"))
            }
          />
          <StatTile
            kind="skip"
            label="Skip"
            value={dashboardStats.skipped}
            sub="sitting out"
          />
          <StatTile
            kind="none"
            label="Not Answered"
            value={dashboardStats.notAnswered}
            sub="waiting on you"
          />
          <NextGame
            match={dashboardStats.nextGame}
            summaries={dashboardStats.nextGameSummaries}
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
          {activeFilter === "today" && "No matches today."}
          {activeFilter === "together" &&
            "You haven't marked any matches as Together yet."}
          {activeFilter === "planned" &&
            "No matches marked as At Home."}
          {activeFilter === "all" && (
            <>
              No matches found.
              {allMatches.length === 0 &&
                " An admin can sync match data from the Admin panel."}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
