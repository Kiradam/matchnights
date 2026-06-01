# Project Plan

108 issues across 11 milestones. Each issue number links to the corresponding GitHub issue.
Milestones are intended to be completed in order; within a milestone, order matters where noted.

---

## M1: Project Setup & Infrastructure (12 issues)

Foundation that all later milestones depend on. Dockerfiles and Nginx config are written
production-ready from day one so CI results are reliable throughout the project.

| # | Issue |
|---|---|
| [#1](../../issues/1) | Initialize FastAPI project structure |
| [#2](../../issues/2) | Set up Alembic with SQLite |
| [#3](../../issues/3) | Initialize React project with Vite + TypeScript |
| [#4](../../issues/4) | Write base docker-compose.yml |
| [#5](../../issues/5) | Write Dockerfile for FastAPI backend |
| [#6](../../issues/6) | Write Dockerfile for React frontend (Nginx) |
| [#7](../../issues/7) | Add Nginx reverse-proxy config (including SPA fallback) |
| [#8](../../issues/8) | Set up GitHub Actions CI workflow |
| [#9](../../issues/9) | Config extraction: Pydantic Settings module + .env.example |
| [#86](../../issues/86) | CORS policy: explicit allow-list in FastAPI middleware |
| [#96](../../issues/96) | GET /health – readiness and liveness endpoint |
| [#97](../../issues/97) | Structured JSON logging with request context |

---

## M2: Data Models & Migrations (10 issues)

All SQLAlchemy models and the initial Alembic migration. No application logic yet.

| # | Issue |
|---|---|
| [#10](../../issues/10) | Create User model |
| [#11](../../issues/11) | Create InviteToken model |
| [#12](../../issues/12) | Create Group model |
| [#13](../../issues/13) | Create UserGroup association table |
| [#14](../../issues/14) | Create Match model |
| [#15](../../issues/15) | Create Preference model |
| [#16](../../issues/16) | Write Alembic initial migration |
| [#17](../../issues/17) | Add DB session dependency and base config |
| [#89](../../issues/89) | SQLite WAL mode and container file permissions |
| [#92](../../issues/92) | Unique constraint on UserGroup (user_id, group_id) |

---

## M3: Auth & Invite System (22 issues)

Complete auth system including invite-only registration, JWT with server-side refresh token
rotation, rate limiting, bootstrap admin seeding, and password reset. Tests are written
alongside the implementation.

| # | Issue |
|---|---|
| [#18](../../issues/18) | Implement password hashing utility |
| [#19](../../issues/19) | Implement JWT access & refresh token logic |
| [#85](../../issues/85) | Refresh token server-side storage and rotation |
| [#20](../../issues/20) | POST /auth/login – email + password → tokens |
| [#21](../../issues/21) | POST /auth/refresh – issue new access token |
| [#22](../../issues/22) | POST /auth/logout – invalidate refresh token |
| [#84](../../issues/84) | Rate limiting on /auth/login and /auth/register |
| [#23](../../issues/23) | POST /admin/invites – generate invite link |
| [#24](../../issues/24) | GET /admin/invites – list all invite tokens |
| [#25](../../issues/25) | DELETE /admin/invites/{token} – revoke invite |
| [#26](../../issues/26) | POST /auth/register – register via invite token |
| [#27](../../issues/27) | Auth dependencies: get_current_user, require_admin |
| [#28](../../issues/28) | GET /users/me – current user profile |
| [#29](../../issues/29) | PATCH /users/me – update own profile |
| [#30](../../issues/30) | GET /admin/users – list all users |
| [#31](../../issues/31) | PATCH /admin/users/{id} – deactivate / reactivate user |
| [#91](../../issues/91) | Deactivated user data visibility in groups |
| [#101](../../issues/101) | Password reset flow (admin-assisted) |
| [#107](../../issues/107) | JWT secret rotation: operational runbook |
| [#108](../../issues/108) | Bootstrap first admin user on startup |
| [#76](../../issues/76) | Backend: pytest setup with test SQLite DB |
| [#77](../../issues/77) | Backend: tests for auth endpoints |

---

## M4: Match Schedule Integration (10 issues)

api-football.com client, match sync with quota guard, rescheduling/cancellation handling,
and defensive deserialization.

| # | Issue |
|---|---|
| [#32](../../issues/32) | Document api-football.com free tier setup and rate-limit strategy |
| [#33](../../issues/33) | Create async HTTP client for football API |
| [#34](../../issues/34) | Map external match data → internal Match model |
| [#95](../../issues/95) | Defensive deserialization of api-football.com API response |
| [#93](../../issues/93) | Define sync caching layer and quota guard |
| [#35](../../issues/35) | POST /admin/matches/sync – trigger schedule sync |
| [#94](../../issues/94) | Partial sync failure: recovery model and admin error surface |
| [#90](../../issues/90) | Handle match rescheduling and cancellation during sync |
| [#36](../../issues/36) | GET /matches – list all matches |
| [#37](../../issues/37) | GET /matches/{id} – single match detail |

---

## M5: Preferences API (4 issues)

Basic preference CRUD. The group-filtered preference endpoint (#40) is in M6 because it
depends on the group-visibility logic built there.

| # | Issue |
|---|---|
| [#38](../../issues/38) | PUT /matches/{id}/preference – set or update preference |
| [#39](../../issues/39) | DELETE /matches/{id}/preference – remove preference |
| [#41](../../issues/41) | GET /users/me/preferences – all preferences of current user |
| [#102](../../issues/102) | Pagination on all list endpoints |

---

## M6: Groups & Visibility API (12 issues)

**#49 must be completed first** — it is the group-visibility logic that #40 depends on.
Tests are co-located with the implementation.

| # | Issue |
|---|---|
| [#49](../../issues/49) | **[FIRST]** Implement group-visibility logic for preferences |
| [#40](../../issues/40) | GET /matches/{id}/preferences – match preference summary (group-filtered) |
| [#42](../../issues/42) | POST /admin/groups – create group |
| [#43](../../issues/43) | GET /admin/groups – list all groups with member counts |
| [#44](../../issues/44) | PATCH /admin/groups/{id} – update group |
| [#45](../../issues/45) | DELETE /admin/groups/{id} – delete group |
| [#46](../../issues/46) | POST /admin/groups/{id}/members – add user to group |
| [#47](../../issues/47) | DELETE /admin/groups/{id}/members/{user_id} – remove user from group |
| [#48](../../issues/48) | GET /groups/me – list own groups |
| [#88](../../issues/88) | Admin action audit log |
| [#78](../../issues/78) | Backend: tests for preference logic |
| [#79](../../issues/79) | Backend: tests for admin group management |

---

## M7: Frontend Foundation (8 issues)

React app shell: routing, auth context, JWT interceptor, protected routes, layout,
login and registration pages.

| # | Issue |
|---|---|
| [#50](../../issues/50) | Set up React Router with route structure |
| [#51](../../issues/51) | Axios instance with JWT interceptors |
| [#52](../../issues/52) | Auth context (login, logout, current user) |
| [#53](../../issues/53) | Protected route component |
| [#54](../../issues/54) | Global layout (navbar, sidebar) |
| [#55](../../issues/55) | Login page |
| [#56](../../issues/56) | Register via invite page |
| [#57](../../issues/57) | 404 and error boundary pages |

---

## M8: Frontend Match & Preferences UI (8 issues)

Match browsing and preference-setting UI. Depends on M5 and M6 backend being complete.

| # | Issue |
|---|---|
| [#58](../../issues/58) | Match list page |
| [#59](../../issues/59) | Match card component |
| [#60](../../issues/60) | Preference selector component (watch / watch together / skip) |
| [#103](../../issues/103) | Disable preference selector for past and live matches |
| [#106](../../issues/106) | Preference summary counts on match list and group panel |
| [#61](../../issues/61) | Group preference panel on match detail |
| [#62](../../issues/62) | Match detail page |
| [#63](../../issues/63) | Loading skeletons and empty states |

---

## M9: Frontend Admin Panel (7 issues)

Admin-only views. Depends on M7 #53 (protected route) being complete.

| # | Issue |
|---|---|
| [#64](../../issues/64) | Admin dashboard overview |
| [#65](../../issues/65) | Invite management page |
| [#66](../../issues/66) | User management page |
| [#67](../../issues/67) | Group management page |
| [#68](../../issues/68) | Group member management UI |
| [#69](../../issues/69) | Match sync UI |
| [#105](../../issues/105) | Confirmation dialogs for irreversible admin actions |

---

## M10: Docker & Deployment (11 issues)

Harden infrastructure, add TLS, backup/restore, and write the deployment guide.
Dockerfiles and Nginx were created in M1; this milestone reviews and hardens them.

| # | Issue |
|---|---|
| [#70](../../issues/70) | Review and harden backend Dockerfile for production |
| [#71](../../issues/71) | Review and harden frontend Dockerfile for production |
| [#72](../../issues/72) | Finalize docker-compose.yml |
| [#73](../../issues/73) | Review and harden Nginx config for production |
| [#87](../../issues/87) | HTTPS / TLS termination: Certbot / Let's Encrypt integration |
| [#74](../../issues/74) | Database persistence and backup strategy |
| [#98](../../issues/98) | Database restore procedure and restore test |
| [#99](../../issues/99) | Production secret injection: no .env file baked into image |
| [#100](../../issues/100) | Migration failure handling on container startup |
| [#104](../../issues/104) | Stale data cleanup: expired invite tokens and cancelled matches |
| [#75](../../issues/75) | Write deployment guide in README |

---

## M11: Testing & Polish (4 issues)

Frontend component tests, final input-validation audit, mobile layout pass, and README.

| # | Issue |
|---|---|
| [#80](../../issues/80) | Frontend: component tests for preference selector |
| [#81](../../issues/81) | Input validation and error messages (audit pass) |
| [#82](../../issues/82) | Mobile-responsive layout pass |
| [#83](../../issues/83) | Final README |

---

## Summary

| Milestone | Issues |
|---|---|
| M1: Project Setup & Infrastructure | 12 |
| M2: Data Models & Migrations | 10 |
| M3: Auth & Invite System | 22 |
| M4: Match Schedule Integration | 10 |
| M5: Preferences API | 4 |
| M6: Groups & Visibility API | 12 |
| M7: Frontend Foundation | 8 |
| M8: Frontend Match & Preferences UI | 8 |
| M9: Frontend Admin Panel | 7 |
| M10: Docker & Deployment | 11 |
| M11: Testing & Polish | 4 |
| **Total** | **108** |
