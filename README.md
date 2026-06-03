# MatchNights

A web application for small groups (~100 users) to coordinate which FIFA World Cup 2026 matches they want to watch — solo, together, or skip. Users belong to admin-managed groups and see each other's preferences within their group(s).

## Features

- **Invite-only** — admin generates one-time invite links; no self-registration
- **Per-group preferences** — Watch and Skip apply across all your groups at once; Together is group-specific (pick which group you're watching with)
- **Group visibility** — members of a shared group see each other's choices by name, with expandable per-group panels on each match card showing "X/Y together"
- **Match highlighting** — cards where ≥50% of group responses are "Together" are highlighted green
- **Mini dashboard** — stat cards (Together, At Home, Skip, Not Answered) above the match grid; Together and At Home are clickable to filter the list; skipped cards are visually dimmed
- **Match detail page** — full preference controls (Together / Watch / Skip) accessible from both the matches list and the calendar
- **Filter pills** — quickly switch between All, Today, Together, and Planned views
- **Dark mode** — system-preference-aware, persisted in localStorage, toggled via navbar button
- **Mobile-friendly** — hamburger nav, bottom-sheet modals, card layout on narrow screens, horizontal admin tabs
- **Calendar view** — full-height week/day views with evening and late-night sections that adjust to content; week view shows official 3-letter country codes (TLA); match times displayed in each viewer's local timezone; download as `.ics` for Google Calendar, Apple Calendar, or Outlook (works on iOS Safari via a backend endpoint)
- **Admin panel** — invite management, user activation/deactivation, role promotion (make/revoke admin), group CRUD with member management, one-click match sync
- **JWT auth** — short-lived access tokens (memory) + refresh tokens (HttpOnly cookie) with rotation and revocation

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic, SQLite |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Infrastructure | Docker, Docker Compose, Nginx |
| Football data | [football-data.org](https://www.football-data.org) free tier (default) |

## Getting started

> **No coding experience needed.** Follow these steps top to bottom and you'll have a running app in about 10 minutes.

### Step 1 — Install Docker

Docker is the only thing you need to install. Everything else (Python, Node.js, the database) runs inside containers.

- **Windows / Mac:** download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Linux:** follow the [official install guide](https://docs.docker.com/engine/install/) for your distro

Verify it works by opening a terminal and running:

```bash
docker --version
```

You should see something like `Docker version 27.x.x`. If you get "command not found", Docker isn't installed yet.

### Step 2 — Get a free football data API key

1. Go to [football-data.org](https://www.football-data.org) and click **Get API Key**
2. Register with your email — it's free, no credit card needed
3. Check your inbox and copy the API key (a string of letters and numbers)

### Step 3 — Download the app

Open a terminal, navigate to wherever you keep your projects, and run:

```bash
git clone https://github.com/Kiradam/matchnights.git
cd matchnights
```

> **Don't have git?** Download [Git for Windows](https://git-scm.com/download/win) (Mac/Linux usually have it already).

### Step 4 — Configure the app

Copy the example config file and open it in any text editor (Notepad is fine):

```bash
cp .env.example .env
```

Fill in these four values — everything else can stay as the defaults:

```env
# Paste your football-data.org key here
FOOTBALL_DATA_ORG_KEY=your_key_here

# The email address you'll use to log in as admin
FIRST_ADMIN_EMAIL=you@example.com

# A strong password for the admin account
FIRST_ADMIN_PASSWORD=PickSomethingStrong123!

# A random secret — copy the output of this command:
# python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=paste_64_char_hex_here
```

To generate the `SECRET_KEY` quickly, run this in your terminal:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output and paste it as the value of `SECRET_KEY` in your `.env` file.

### Step 5 — Start the app

```bash
docker compose up -d --build
```

This will download all dependencies and start the app. The first run takes 2–5 minutes. When it's done, open your browser and go to:

```
http://localhost:8015
```

Log in with the email and password you set in Step 4.

> If you see a "connection refused" error, wait 30 seconds and refresh — the app may still be starting up.

### Step 6 — Sync match fixtures

1. Click **Admin** in the top navigation bar
2. Go to the **Match Sync** tab
3. Click **Sync matches now**

This pulls all fixtures from football-data.org and saves them to the local database. It takes a few seconds. Re-sync periodically to pick up kick-off time changes and live scores (free tier allows 100 requests/day).

### Step 7 — Invite your friends

1. Go to **Admin → Invites**
2. Click **Generate invite link** and copy the link
3. Send it via WhatsApp, email, or however you like
4. Your friends open the link, pick a username and password, and they're in

That's it — everyone can now mark matches as **Watch**, **Together**, or **Skip** and see each other's choices.

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy async DB URL | `sqlite+aiosqlite:///./matchnights.db` |
| `SECRET_KEY` | JWT signing secret | — |
| `SECRET_KEY_PREVIOUS` | Previous signing secret (key rotation) | `""` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime | `30` |
| `COOKIE_SECURE` | Set `False` only for local HTTP dev; must be `True` behind HTTPS | `True` |
| `FIRST_ADMIN_EMAIL` | Bootstrap admin email (first startup only) | — |
| `FIRST_ADMIN_PASSWORD` | Bootstrap admin password (first startup only) | — |
| `FOOTBALL_DATA_SOURCE` | Data source: `football_data` / `openfootball` / `api_sports` | `football_data` |
| `FOOTBALL_DATA_ORG_KEY` | football-data.org API key | — |
| `FOOTBALL_API_KEY` | api-sports.io API key (if using `api_sports`) | — |
| `FOOTBALL_API_HOST` | api-sports.io host | `v3.football.api-sports.io` |
| `FOOTBALL_WC_LEAGUE_ID` | League ID for the competition to sync | `1` |
| `FOOTBALL_WC_SEASON` | Season year for the competition to sync | `2026` |
| `LEAGUE_NAME` | Display name shown in downloaded .ics calendars | `WC 2026` |
| `CORS_ORIGINS` | Allowed origins, JSON array | `["http://localhost"]` |
| `INVITE_TOKEN_EXPIRE_HOURS` | Default invite validity | `72` |
| `LOG_LEVEL` | Logging level | `INFO` |

The `VITE_API_BASE_URL` build arg in `docker-compose.yml` controls where the frontend sends API requests (default: `/api`).

## Using with another football league

MatchNights works with any competition available through your chosen data source. To switch from WC 2026 to, for example, the Champions League 2025/26:

1. Look up the competition's **league ID** and **season year** in your data source dashboard (e.g. football-data.org or api-sports.io).

2. Update `.env`:

```env
FOOTBALL_WC_LEAGUE_ID=2001   # UEFA Champions League on football-data.org
FOOTBALL_WC_SEASON=2025
LEAGUE_NAME=Champions League 2025/26
DATABASE_URL=sqlite+aiosqlite:///./cl2526.db   # optional: separate DB per league
```

3. Rebuild and restart:

```bash
docker compose up -d --build
```

4. Go to **Admin → Match Sync** and click **Sync matches now** to fetch the fixtures.

The `LEAGUE_NAME` value appears in the `.ics` calendar name when users download their watchlist. `FOOTBALL_WC_LEAGUE_ID` and `FOOTBALL_WC_SEASON` control which competition's fixtures are synced from the API.

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

MatchNights ships without TLS termination — expose it behind a reverse proxy that handles certificates.

**Option A — Caddy (recommended, automatic cert renewal)**

```bash
# Caddyfile
matchnights.example.com {
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
sudo certbot --nginx -d matchnights.example.com

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
docker exec matchnights-backend-1 sqlite3 /app/wc2026.db ".backup /tmp/backup.db"
docker cp matchnights-backend-1:/tmp/backup.db ./wc2026-$(date +%Y%m%d).db
```

**Scheduled backup (cron)**

```cron
0 3 * * * docker exec matchnights-backend-1 sqlite3 /app/wc2026.db ".backup /tmp/daily.db" && docker cp matchnights-backend-1:/tmp/daily.db /backups/wc2026-$(date +\%Y\%m\%d).db
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
   docker cp backup.db matchnights-backend-1:/app/wc2026.db
   ```

3. **Restart**:
   ```bash
   docker compose start backend
   ```

4. **Verify** by checking `/api/health` and reviewing `alembic_version` in the database:
   ```bash
   docker exec matchnights-backend-1 sqlite3 /app/wc2026.db "SELECT * FROM alembic_version;"
   ```

If migrations fail on startup, `entrypoint.sh` automatically restores the pre-migration backup and exits with a non-zero code — check `docker compose logs backend` for details.

### JWT secret rotation runbook

MatchNights supports zero-downtime secret rotation via `SECRET_KEY_PREVIOUS`.

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

MatchNights is free software released under the **GNU General Public License v3.0**.
You may redistribute and/or modify it under the terms of the GPL as published by the Free Software Foundation — either version 3, or (at your option) any later version.

See the [LICENSE](LICENSE) file for the full license text, or visit <https://www.gnu.org/licenses/gpl-3.0.html>.
