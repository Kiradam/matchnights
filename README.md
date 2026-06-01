# wc2026-planner

A web application for ~100 users to indicate whether they want to **watch**, **watch together**, or **skip** FIFA World Cup 2026 matches. Users are organised into admin-managed groups and can see each other's preferences within their group(s).

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy (async), Alembic, SQLite |
| Frontend | React, Vite, TypeScript |
| Infrastructure | Docker, Docker Compose, Nginx |
| Football data | [api-football.com](https://api-football.com) free tier (100 req/day) |

## Key design decisions

- **Invite-only registration** — admin generates invite links; users register via a one-time token URL (`/register?token=<UUID>`). No self-registration.
- **Groups are admin-managed** — users can belong to multiple groups simultaneously. Users in a shared group see each other's preferences by name.
- **Match data is admin-synced** — the admin triggers a sync from api-football.com; responses are cached to SQLite to stay within the 100 req/day free tier limit.
- **No notifications** — invite links are shared manually (WhatsApp, email, etc.).
- **JWT auth** — short-lived access tokens (in memory) + refresh tokens (HttpOnly cookie) with server-side rotation and revocation.
- **First admin** is seeded on first startup from `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` env vars.

## Project plan

108 issues across 11 milestones. See the [GitHub milestones](../../milestones) for full detail.

| Milestone | Issues | Scope |
|---|---|---|
| M1: Project Setup & Infrastructure | 12 | FastAPI scaffold, Vite/React, Docker, Nginx, CI, health endpoint, logging, CORS, config |
| M2: Data Models & Migrations | 10 | All SQLAlchemy models, Alembic migration, SQLite WAL mode |
| M3: Auth & Invite System | 19 | JWT auth, invite-only registration, admin user management, rate limiting, refresh token rotation, password reset, bootstrap admin |
| M4: Match Schedule Integration | 9 | api-football.com client, match sync, rescheduling/cancellation handling, quota guard, defensive deserialization |
| M5: Preferences API | 5 | Set/update/delete/read preferences, pagination |
| M6: Groups & Visibility API | 12 | Group-visibility logic, admin group CRUD, audit log, tests for preferences and groups |
| M7: Frontend Foundation | 8 | Router, auth context, JWT interceptors, layout, login/register pages |
| M8: Frontend Match & Preferences UI | 9 | Match list, preference toggle, group preference panel, past-match locking, summary counts |
| M9: Frontend Admin Panel | 7 | Dashboard, invite/user/group management, sync UI, confirmation dialogs |
| M10: Docker & Deployment | 11 | Harden Dockerfiles, docker-compose, TLS, backup/restore, secret injection, migration safety |
| M11: Testing & Polish | 7 | Frontend component tests, input validation audit, mobile layout, final README |

## Environment variables

All backend configuration goes through `core/config.py` (Pydantic `BaseSettings`). Copy `.env.example` to `.env` and fill in the values.

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy async DB URL | `sqlite+aiosqlite:///./wc2026.db` |
| `SECRET_KEY` | JWT signing secret (random 32-byte hex) | — |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime | `30` |
| `FOOTBALL_API_KEY` | api-football.com RapidAPI key | — |
| `FOOTBALL_API_HOST` | api-football.com RapidAPI host | `api-football-v3.p.rapidapi.com` |
| `FOOTBALL_WC_LEAGUE_ID` | FIFA World Cup 2026 league ID on api-football.com | — |
| `FOOTBALL_WC_SEASON` | Season year | `2026` |
| `CORS_ORIGINS` | Allowed frontend origin(s), JSON array | `["http://localhost:5173"]` |
| `INVITE_TOKEN_EXPIRE_HOURS` | Default invite token validity | `72` |
| `FIRST_ADMIN_EMAIL` | Email for the bootstrap admin user (first startup only) | — |
| `FIRST_ADMIN_PASSWORD` | Password for the bootstrap admin user (first startup only) | — |
| `LOG_LEVEL` | Logging level | `INFO` |
| `VITE_API_BASE_URL` | Backend URL (frontend build-time arg) | `http://localhost:8000` |

## Getting started

> Setup instructions will be added in M10 (deployment milestone). See issues [#75](../../issues/75) and [#83](../../issues/83).

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Docker Compose             │
│                                             │
│  ┌──────────┐    ┌──────────┐              │
│  │  Nginx   │───▶│ React /  │              │
│  │ :80/:443 │    │  Vite    │              │
│  │          │    │ (static) │              │
│  │  /api/* ─┼──┐ └──────────┘              │
│  └──────────┘  │                           │
│                ▼                           │
│         ┌──────────┐                       │
│         │ FastAPI  │                       │
│         │  :8000   │                       │
│         └────┬─────┘                       │
│              │                             │
│         ┌────▼─────┐   ┌────────────────┐  │
│         │ SQLite   │   │ api-football   │  │
│         │  (file)  │   │ .com (external)│  │
│         └──────────┘   └────────────────┘  │
└─────────────────────────────────────────────┘
```

## License

Private project.
