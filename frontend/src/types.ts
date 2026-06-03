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
  used: boolean;
}

export interface SyncState {
  last_sync_at: string | null;
  last_sync_result: Record<string, unknown> | null;
  request_count_today: number;
  quota_remaining: number;
}
