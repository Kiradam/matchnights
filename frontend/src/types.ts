export type UserRole = "user" | "admin";
export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";
export type PreferenceChoice = "watch" | "watch_together" | "skip";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface MyGroupPreference {
  group_id: number;
  group_name: string;
  choice: PreferenceChoice | null;
}

export interface Match {
  id: number;
  external_id: string;
  home_team: string;
  away_team: string;
  home_team_crest: string | null;
  away_team_crest: string | null;
  home_team_tla: string | null;
  away_team_tla: string | null;
  stage: string;
  matchday: number | null;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  match_datetime: string;
  venue: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  my_preferences: MyGroupPreference[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface GroupMemberPreference {
  user_id: number;
  full_name: string;
  is_active: boolean;
  choice: PreferenceChoice | null;
}

export interface GroupPreferenceSummary {
  group_id: number;
  group_name: string;
  watch: number;
  watch_together: number;
  skip: number;
  no_response: number;
  members: GroupMemberPreference[];
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  member_count: number;
}

export interface GroupMember {
  user_id: number;
  full_name: string;
  email: string;
  is_active: boolean;
  added_at: string;
}

export interface Invite {
  id: number;
  token: string;
  registration_url: string;
  expires_at: string;
  created_at: string;
  use_count: number;
  max_uses: number;
}

export interface SyncState {
  last_sync_at: string | null;
  last_sync_result: Record<string, unknown> | null;
  request_count_today: number;
  quota_remaining: number;
}

// ── Predictions ───────────────────────────────────────────────────────────────

export type PredictedOutcome = "home_win" | "away_win" | "draw";
export type PointsReason = "exact_score" | "correct_outcome" | "wrong";
export type PredictionState = "tip_available" | "tip_locked" | "evaluated" | "manual_review";

export interface MatchPrediction {
  id: number;
  user_id: number;
  match_id: number;
  home_goals: number;
  away_goals: number;
  predicted_outcome: PredictedOutcome;
  predicted_qualifier: string | null;
  boosted: boolean;
  submitted_at: string;
  locked_at: string | null;
  points_awarded: number | null;
  base_points: number | null;
  evaluated_at: string | null;
  points_reason: PointsReason | null;
  state: PredictionState;
}

export interface WinnerPrediction {
  id: number;
  user_id: number;
  team_name: string;
  submitted_at: string;
  locked_at: string | null;
  points_awarded: number | null;
  evaluated_at: string | null;
}

export interface LeaderboardEntry {
  user_id: number;
  full_name: string;
  total_points: number;
  exact_score_count: number;
  base_points: number;
}

export interface PredictedScore {
  home: number;
  away: number;
  count: number;
}

export interface OutcomeCounts {
  home_win: number;
  draw: number;
  away_win: number;
}

export interface GoalDistEntry {
  goals: number;
  count: number;
}

export interface MatchPredictionStats {
  match_id: number;
  total: number;
  outcome_counts: OutcomeCounts;
  top_scores: PredictedScore[];
  home_goal_dist: GoalDistEntry[];
  away_goal_dist: GoalDistEntry[];
}

export interface ManualReviewMatch {
  match_id: number;
  external_id: string;
  home_team: string;
  away_team: string;
  stage: string;
  match_datetime: string;
  pending_predictions: number;
}
