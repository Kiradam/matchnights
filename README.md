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
- **Calendar view** — month/week/day views of your watchlist; click any day to drill down; download as `.ics` for Google Calendar, Apple Calendar, or Outlook (works on iOS Safari via a backend endpoint)
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

## Production deployment

### HTTPS / TLS setup

WatchMatch ships without TLS termination — expose it behind a reverse proxy that handles certificates.

**Option A — Caddy (recommended, automatic cert renewal)**

```bash
# Caddyfile
watchmatch.example.com {
    reverse_proxy localhost:8015
}
```

```bash
caddy run --config Caddyfile
```

**Option B — Nginx + Certbot**

```bash
# Install certbot and the nginx plugin
sudo apt install certbot python3-certbot-nginx

# Obtain a certificate and auto-configure nginx
sudo certbot --nginx -d watchmatch.example.com

# Certbot adds a server block on :443 and redirects :80 → :443 automatically.
# Certificates auto-renew via a systemd timer or cron job.
```

Once HTTPS is active, enable HSTS in `nginx/nginx.conf` by uncommenting:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### Secrets injection

Never commit secrets to source control. Inject them at runtime:

**Docker Compose (recommended for self-hosted)**

Create `.env` from `.env.example`, fill in real values, and keep it out of git (it is already in `.gitignore`):

```bash
cp .env.example .env
# Edit .env with your real SECRET_KEY, passwords, API keys
docker compose up -d --build
```

**Environment variables only (no .env file)**

Pass secrets directly to the container:

```bash
docker compose run \
  -e SECRET_KEY="$(openssl rand -hex 32)" \
  -e FIRST_ADMIN_EMAIL=admin@example.com \
  -e FIRST_ADMIN_PASSWORD="$(openssl rand -base64 24)" \
  backend
```

**Generate a secure SECRET_KEY**

```bash
openssl rand -hex 32
```

### Database backup strategy

The database (`wc2026.db`) lives in the `db_data` Docker volume. A snapshot is taken automatically before each migration run (see `backend/entrypoint.sh`).

**Manual backup**

```bash
docker exec wc2026-planner-backend-1 sqlite3 /app/wc2026.db ".backup /tmp/backup.db"
docker cp wc2026-planner-backend-1:/tmp/backup.db ./wc2026-$(date +%Y%m%d).db
```

**Scheduled backup (cron)**

```cron
0 3 * * * docker exec wc2026-planner-backend-1 sqlite3 /app/wc2026.db ".backup /tmp/daily.db" && docker cp wc2026-planner-backend-1:/tmp/daily.db /backups/wc2026-$(date +\%Y\%m\%d).db
```

SQLite WAL mode is enabled at startup, so reads and writes can happen concurrently while a backup runs.

### Database restore procedure

1. **Stop the backend** to prevent writes during restore:
   ```bash
   docker compose stop backend
   ```

2. **Copy the backup into the volume**:
   ```bash
   # Replace backup.db with your backup file
   docker cp backup.db wc2026-planner-backend-1:/app/wc2026.db
   ```

3. **Restart**:
   ```bash
   docker compose start backend
   ```

4. **Verify** by checking `/api/health` and reviewing `alembic_version` in the database:
   ```bash
   docker exec wc2026-planner-backend-1 sqlite3 /app/wc2026.db "SELECT * FROM alembic_version;"
   ```

If migrations fail on startup, `entrypoint.sh` automatically restores the pre-migration backup and exits with a non-zero code — check `docker compose logs backend` for details.

### JWT secret rotation runbook

WatchMatch supports zero-downtime secret rotation via `SECRET_KEY_PREVIOUS`.

1. **Generate a new secret**:
   ```bash
   openssl rand -hex 32
   ```

2. **Update `.env`** — move the current `SECRET_KEY` to `SECRET_KEY_PREVIOUS` and set the new value as `SECRET_KEY`:
   ```env
   SECRET_KEY=<new-secret>
   SECRET_KEY_PREVIOUS=<old-secret>
   ```

3. **Redeploy** — the backend will accept tokens signed by either key, so existing sessions stay valid:
   ```bash
   docker compose up -d backend
   ```

4. **Wait one refresh cycle** (default: 30 days, `REFRESH_TOKEN_EXPIRE_DAYS`) for all existing refresh tokens to be replaced with new ones signed by the new key.

5. **Clear `SECRET_KEY_PREVIOUS`** once all old tokens have expired:
   ```env
   SECRET_KEY_PREVIOUS=
   ```

To **force-invalidate all sessions immediately** (e.g., after a suspected compromise), clear both variables simultaneously and redeploy. All users will be logged out.

## License

WatchMatch is free software released under the **GNU General Public License v3.0**.
You may redistribute and/or modify it under the terms of the GPL as published by the Free Software Foundation — either version 3, or (at your option) any later version.

See the [LICENSE](LICENSE) file for the full license text, or visit <https://www.gnu.org/licenses/gpl-3.0.html>.
