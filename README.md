# WatchMatch

A web application for small groups (~100 users) to coordinate which FIFA World Cup 2026 matches they want to watch — solo, together, or skip. Users belong to admin-managed groups and see each other's preferences within their group(s).

## Features

- **Invite-only** — admin generates one-time invite links; no self-registration
- **Per-group preferences** — Watch and Skip apply across all your groups at once; Together is group-specific (pick which group you're watching with)
- **Group visibility** — members of a shared group see each other's choices by name, with expandable per-group panels on each match card
- **Match highlighting** — cards where ≥50% of group responses are "Together" are highlighted green
- **Sort & filter** — sort by date or popularity (total watch+together votes); filter by stage
- **Dark mode** — system-preference-aware, persisted in localStorage, toggled via navbar button
- **Mobile-friendly** — hamburger nav, bottom-sheet modals, card layout on narrow screens, horizontal admin tabs
- **Admin panel** — invite management, user activation/deactivation, group CRUD with member management, one-click match sync
- **JWT auth** — short-lived access tokens (memory) + refresh tokens (HttpOnly cookie) with rotation and revocation

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic, SQLite |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Infrastructure | Docker, Docker Compose, Nginx |
| Football data | [football-data.org](https://www.football-data.org) free tier (default) |

## Getting started

### Prerequisites

- Docker and Docker Compose
- A [football-data.org](https://www.football-data.org) free API key

### 1. Clone and configure

```bash
git clone https://github.com/Kiradam/wc2026-planner.git
cd wc2026-planner
cp .env.example .env   # then edit .env with your values
```

Minimum required values in `.env`:

```env
SECRET_KEY=<random 64-char hex>
FIRST_ADMIN_EMAIL=admin@example.com
FIRST_ADMIN_PASSWORD=<strong password>
FOOTBALL_DATA_ORG_KEY=<your football-data.org key>
```

### 2. Build and run

```bash
docker compose up -d --build
```

The app is served on **port 8015** by default (`http://localhost:8015`).

The first admin account is created automatically on startup from `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD`.

### 3. Invite users

1. Log in as admin and go to **Admin → Invites**
2. Generate an invite link and share it (WhatsApp, email, etc.)
3. Recipients register at `/register?token=<token>`

### 4. Sync match data

Go to **Admin → Match Sync** and click **Sync matches now**. This fetches all WC 2026 fixtures from football-data.org and stores them locally. Re-sync periodically to pick up reschedules and live status updates (free tier: 100 requests/day).

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy async DB URL | `sqlite+aiosqlite:///./wc2026.db` |
| `SECRET_KEY` | JWT signing secret | — |
| `SECRET_KEY_PREVIOUS` | Previous signing secret (key rotation) | `""` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime | `30` |
| `FIRST_ADMIN_EMAIL` | Bootstrap admin email (first startup only) | — |
| `FIRST_ADMIN_PASSWORD` | Bootstrap admin password (first startup only) | — |
| `FOOTBALL_DATA_SOURCE` | Data source: `football_data` / `openfootball` / `api_sports` | `football_data` |
| `FOOTBALL_DATA_ORG_KEY` | football-data.org API key | — |
| `FOOTBALL_API_KEY` | api-sports.io API key (if using `api_sports`) | — |
| `FOOTBALL_API_HOST` | api-sports.io host | `v3.football.api-sports.io` |
| `FOOTBALL_WC_LEAGUE_ID` | League ID (api-sports source) | `1` |
| `FOOTBALL_WC_SEASON` | Season year (api-sports source) | `2026` |
| `CORS_ORIGINS` | Allowed origins, JSON array | `["http://localhost"]` |
| `INVITE_TOKEN_EXPIRE_HOURS` | Default invite validity | `72` |
| `LOG_LEVEL` | Logging level | `INFO` |

The `VITE_API_BASE_URL` build arg in `docker-compose.yml` controls where the frontend sends API requests (default: `/api`).

## Architecture

```
┌─────────────────────────────────────────────┐
│               Docker Compose                │
│                                             │
│  ┌──────────┐    ┌──────────┐              │
│  │  Nginx   │───▶│  React   │              │
│  │  :8015   │    │ (static) │              │
│  │          │    └──────────┘              │
│  │  /api/* ─┼──┐                           │
│  └──────────┘  │                           │
│                ▼                           │
│         ┌──────────┐                       │
│         │ FastAPI  │                       │
│         │  :8000   │                       │
│         └────┬─────┘                       │
│              │                             │
│       ┌──────┴───────┐  ┌───────────────┐  │
│       │  SQLite      │  │football-data  │  │
│       │  (volume)    │  │  .org (ext.)  │  │
│       └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────┘
```

Database migrations run automatically on container startup via `alembic upgrade head`.
A backup of the database is taken before each migration.

## Preference model

Each preference is scoped to a `(user, match, group)` triple:

- **Together** — group-specific; clicking it asks which group you want to watch with
- **Watch** — registers for all your groups simultaneously (you want to watch regardless of group)
- **Skip** — registers for all your groups simultaneously

The match list endpoint (`GET /matches`) returns each match with `my_preferences` — your choice per group — in a single efficient query.

## License

Private project.
