#!/usr/bin/env bash
# MatchNights — interactive setup wizard
# Supports: Linux, macOS, WSL2 (Windows users: run in Git Bash or WSL)
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

info()    { echo -e "  ${CYAN}•${NC} $*"; }
success() { echo -e "  ${GREEN}✓${NC} $*"; }
warn()    { echo -e "  ${YELLOW}!${NC} $*"; }
err()     { echo -e "  ${RED}✗${NC} $*" >&2; }
step()    { echo -e "\n${BOLD}${BLUE}──────────────────────────────────────${NC}\n${BOLD} $*${NC}\n"; }
banner()  {
  echo ""
  echo -e "${BOLD}${BLUE}  ███╗   ███╗ █████╗ ████████╗ ██████╗██╗  ██╗${NC}"
  echo -e "${BOLD}${BLUE}  ████╗ ████║██╔══██╗╚══██╔══╝██╔════╝██║  ██║${NC}"
  echo -e "${BOLD}${BLUE}  ██╔████╔██║███████║   ██║   ██║     ███████║${NC}"
  echo -e "${BOLD}${BLUE}  ██║╚██╔╝██║██╔══██║   ██║   ██║     ██╔══██║${NC}"
  echo -e "${BOLD}${BLUE}  ██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╗██║  ██║${NC}"
  echo -e "${BOLD}${BLUE}  ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝${NC}"
  echo -e "${DIM}  Nights${NC}\n"
  echo -e "${BOLD}  Setup Wizard${NC}  —  get up and running in ~5 minutes"
  echo ""
}

ask() {
  # ask VAR "prompt" ["default"]
  local var="$1" prompt="$2" default="${3:-}"
  if [[ -n "$default" ]]; then
    echo -en "  ${BOLD}$prompt${NC} ${DIM}[$default]${NC}: "
  else
    echo -en "  ${BOLD}$prompt${NC}: "
  fi
  read -r "$var"
  # If empty and a default was supplied, use the default
  if [[ -z "${!var}" && -n "$default" ]]; then
    printf -v "$var" '%s' "$default"
  fi
}

ask_secret() {
  local var="$1" prompt="$2"
  echo -en "  ${BOLD}$prompt${NC}: "
  read -rs "$var"
  echo ""
}

ask_yn() {
  # ask_yn "prompt" "y"|"n" -> returns 0 for yes, 1 for no
  local prompt="$1" default="${2:-y}"
  local label
  [[ "$default" == "y" ]] && label="Y/n" || label="y/N"
  echo -en "  ${BOLD}$prompt${NC} ${DIM}[$label]${NC}: "
  read -r _yn
  _yn="${_yn:-$default}"
  [[ "${_yn,,}" == "y" ]]
}

require_cmd() {
  if ! command -v "$1" &>/dev/null; then
    err "Required command not found: ${BOLD}$1${NC}"
    echo -e "  $2"
    exit 1
  fi
}

python_json() {
  # Run a Python3 one-liner safely
  python3 -c "$1" 2>/dev/null
}

# ── Preflight ─────────────────────────────────────────────────────────────────
banner

step "Checking prerequisites"

# Docker
if ! command -v docker &>/dev/null; then
  err "Docker is not installed."
  echo ""
  echo -e "  Install Docker Desktop from: ${BOLD}https://www.docker.com/products/docker-desktop/${NC}"
  echo -e "  Linux users:                 ${BOLD}https://docs.docker.com/engine/install/${NC}"
  echo ""
  echo -e "  After installing, re-run this script."
  exit 1
fi
success "Docker found: $(docker --version | head -1)"

# Docker daemon running?
if ! docker info &>/dev/null 2>&1; then
  err "Docker daemon is not running."
  echo ""
  echo -e "  ${YELLOW}→${NC} Start Docker Desktop (Mac/Windows), or run: ${BOLD}sudo systemctl start docker${NC} (Linux)"
  exit 1
fi
success "Docker daemon is running"

# Docker Compose (v2 plugin preferred)
if docker compose version &>/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
  warn "Using legacy docker-compose. Consider upgrading to Docker Compose v2."
else
  err "Docker Compose not found. It ships with Docker Desktop — try reinstalling."
  exit 1
fi
success "Docker Compose found"

# Python3 (for JSON parsing + key generation)
require_cmd python3 "Install Python 3 from ${BOLD}https://python.org${NC} or via your package manager."
success "Python 3 found"

# curl
require_cmd curl "Install curl: ${BOLD}sudo apt install curl${NC}  /  ${BOLD}brew install curl${NC}"
success "curl found"

# ── Existing .env ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  warn ".env already exists."
  if ! ask_yn "Reconfigure and overwrite it?"; then
    step "Skipping configuration — using existing .env"
    SKIP_CONFIG=true
  else
    SKIP_CONFIG=false
    cp "$ENV_FILE" "${ENV_FILE}.bak"
    success "Old .env saved to .env.bak"
  fi
else
  SKIP_CONFIG=false
fi

# ── Configuration ─────────────────────────────────────────────────────────────
if [[ "$SKIP_CONFIG" == false ]]; then

  # ── Data source ───────────────────────────────────────────────────────────
  step "Football data source"
  echo -e "  ${DIM}MatchNights can pull fixtures and results from three sources:${NC}"
  echo ""
  echo -e "  ${BOLD}1)${NC} football-data.org  ${DIM}— free API key, covers most major competitions${NC}"
  echo -e "  ${BOLD}2)${NC} api-sports.io      ${DIM}— broader coverage, paid plan recommended${NC}"
  echo -e "  ${BOLD}3)${NC} openfootball       ${DIM}— free, no key, limited data${NC}"
  echo ""
  ask DATA_SOURCE_NUM "Choose data source" "1"

  case "$DATA_SOURCE_NUM" in
    1) DATA_SOURCE="football_data" ;;
    2) DATA_SOURCE="api_sports" ;;
    3) DATA_SOURCE="openfootball" ;;
    *) warn "Invalid choice — defaulting to football-data.org"; DATA_SOURCE="football_data" ;;
  esac

  API_KEY=""
  LEAGUE_ID=""
  LEAGUE_NAME=""
  SEASON="2026"

  # ── API key & league lookup ───────────────────────────────────────────────
  if [[ "$DATA_SOURCE" == "football_data" ]]; then

    step "football-data.org API key"
    echo -e "  ${DIM}Get a free key at: ${BOLD}https://www.football-data.org${NC} (register, check inbox)"
    echo ""

    while true; do
      ask_secret API_KEY "API key"
      if [[ -z "$API_KEY" ]]; then err "API key cannot be empty."; continue; fi

      info "Checking key and fetching competitions…"
      HTTP_CODE=$(curl -s -o /tmp/mn_competitions.json -w "%{http_code}" \
        -H "X-Auth-Token: $API_KEY" \
        "https://api.football-data.org/v4/competitions/" 2>/dev/null || echo "000")

      if [[ "$HTTP_CODE" == "200" ]]; then
        success "API key is valid"
        break
      elif [[ "$HTTP_CODE" == "400" || "$HTTP_CODE" == "403" ]]; then
        err "Invalid API key (HTTP $HTTP_CODE). Please check and try again."
      else
        err "Could not reach api.football-data.org (HTTP $HTTP_CODE). Check your internet connection."
        if ask_yn "Retry?"; then continue; else
          warn "Skipping league lookup — you can set FOOTBALL_WC_LEAGUE_ID manually in .env"
          break
        fi
      fi
    done

    # Parse and display competitions
    COMPETITIONS_JSON=$(cat /tmp/mn_competitions.json 2>/dev/null || echo "{}")
    COMP_COUNT=$(python_json "
import json, sys
data = json.loads('''$COMPETITIONS_JSON''')
comps = data.get('competitions', [])
print(len(comps))
" || echo "0")

    if [[ "$COMP_COUNT" -gt 0 ]]; then
      echo ""
      echo -e "  ${BOLD}Available competitions (${COMP_COUNT}):${NC}"
      echo ""

      python_json "
import json
data = json.loads(open('/tmp/mn_competitions.json').read())
comps = data.get('competitions', [])
for i, c in enumerate(comps, 1):
    season = c.get('currentSeason', {}) or {}
    year   = (season.get('startDate') or '')[:4]
    area   = (c.get('area') or {}).get('name', '')
    print(f\"  {i:>2})  {c['id']:>5}  {c['name']:<35}  {area:<20}  {year}\")
" 2>/dev/null || warn "Could not parse competition list — check /tmp/mn_competitions.json"

      echo ""
      ask COMP_NUM "Select competition number" "1"

      SELECTED=$(python_json "
import json
data = json.loads(open('/tmp/mn_competitions.json').read())
comps = data.get('competitions', [])
n = int('$COMP_NUM') - 1
if 0 <= n < len(comps):
    c = comps[n]
    season = c.get('currentSeason', {}) or {}
    year   = (season.get('startDate') or '2026')[:4]
    print(f\"{c['id']}|{c['name']}|{year}\")
" 2>/dev/null || echo "")

      if [[ -n "$SELECTED" ]]; then
        LEAGUE_ID="${SELECTED%%|*}"
        REST="${SELECTED#*|}"
        LEAGUE_NAME="${REST%|*}"
        SEASON="${REST##*|}"
        success "Selected: ${BOLD}$LEAGUE_NAME${NC} (ID $LEAGUE_ID, season $SEASON)"
      else
        warn "Could not parse selection. Enter values manually:"
        ask LEAGUE_ID    "League ID"      "2000"
        ask LEAGUE_NAME  "League name"    "FIFA World Cup"
        ask SEASON       "Season year"    "2026"
      fi
    else
      warn "No competitions returned — enter values manually"
      ask LEAGUE_ID   "League ID"    "2000"
      ask LEAGUE_NAME "League name"  "FIFA World Cup"
      ask SEASON      "Season year"  "2026"
    fi
    rm -f /tmp/mn_competitions.json

  elif [[ "$DATA_SOURCE" == "api_sports" ]]; then

    step "api-sports.io API key"
    echo -e "  ${DIM}Get a key at: ${BOLD}https://api-sports.io${NC}"
    echo ""

    while true; do
      ask_secret API_KEY "API key"
      if [[ -z "$API_KEY" ]]; then err "API key cannot be empty."; continue; fi

      info "Validating key and fetching leagues…"
      HTTP_CODE=$(curl -s -o /tmp/mn_leagues.json -w "%{http_code}" \
        -H "x-apisports-key: $API_KEY" \
        "https://v3.football.api-sports.io/leagues" 2>/dev/null || echo "000")

      ERRORS=$(python_json "
import json
try:
    data = json.loads(open('/tmp/mn_leagues.json').read())
    errs = data.get('errors', {})
    print('yes' if errs else 'no')
except: print('no')
" || echo "no")

      if [[ "$HTTP_CODE" == "200" && "$ERRORS" == "no" ]]; then
        success "API key is valid"
        break
      else
        err "Invalid key or API error (HTTP $HTTP_CODE). Please check and try again."
        if ask_yn "Retry?"; then continue; else
          warn "Skipping league lookup — you can set FOOTBALL_WC_LEAGUE_ID manually"
          break
        fi
      fi
    done

    LEAGUE_COUNT=$(python_json "
import json
data = json.loads(open('/tmp/mn_leagues.json').read())
print(len(data.get('response', [])))
" 2>/dev/null || echo "0")

    if [[ "$LEAGUE_COUNT" -gt 0 ]]; then
      echo ""
      echo -e "  ${DIM}(Showing first 40 leagues — search by number after the list)${NC}"
      echo ""

      python_json "
import json
data = json.loads(open('/tmp/mn_leagues.json').read())
leagues = data.get('response', [])[:40]
for i, entry in enumerate(leagues, 1):
    l = entry.get('league', {})
    c = entry.get('country', {})
    print(f\"  {i:>2})  {l.get('id',''):>5}  {l.get('name',''):<35}  {c.get('name','')}\")
" 2>/dev/null || true

      echo ""
      ask COMP_NUM "Select competition number" "1"

      SELECTED=$(python_json "
import json
data = json.loads(open('/tmp/mn_leagues.json').read())
entries = data.get('response', [])
n = int('$COMP_NUM') - 1
if 0 <= n < len(entries):
    l = entries[n]['league']
    seasons = entries[n].get('seasons', [])
    yr = seasons[-1]['year'] if seasons else 2026
    print(f\"{l['id']}|{l['name']}|{yr}\")
" 2>/dev/null || echo "")

      if [[ -n "$SELECTED" ]]; then
        LEAGUE_ID="${SELECTED%%|*}"
        REST="${SELECTED#*|}"
        LEAGUE_NAME="${REST%|*}"
        SEASON="${REST##*|}"
        success "Selected: ${BOLD}$LEAGUE_NAME${NC} (ID $LEAGUE_ID, season $SEASON)"
        ask SEASON "Season year" "$SEASON"
      else
        warn "Could not parse selection. Enter values manually:"
        ask LEAGUE_ID   "League ID"    "1"
        ask LEAGUE_NAME "League name"  "World Cup"
        ask SEASON      "Season year"  "2026"
      fi
    else
      ask LEAGUE_ID   "League ID"    "1"
      ask LEAGUE_NAME "League name"  "World Cup"
      ask SEASON      "Season year"  "2026"
    fi
    rm -f /tmp/mn_leagues.json

  else
    # openfootball — no API, manual entry
    step "openfootball configuration"
    warn "openfootball provides limited data and no live scores."
    echo ""
    ask LEAGUE_ID   "League ID (from openfootball repo)" "1"
    ask LEAGUE_NAME "League display name"                "WC 2026"
    ask SEASON      "Season year"                        "2026"
  fi

  # ── Admin account ─────────────────────────────────────────────────────────
  step "Admin account"
  echo -e "  ${DIM}This account is created automatically on first startup.${NC}"
  echo ""

  while true; do
    ask ADMIN_EMAIL "Admin email address" ""
    if [[ "$ADMIN_EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then break
    else err "Enter a valid email address."; fi
  done

  while true; do
    ask_secret ADMIN_PASS "Admin password (min 8 characters)"
    if [[ ${#ADMIN_PASS} -ge 8 ]]; then
      ask_secret ADMIN_PASS2 "Confirm password"
      if [[ "$ADMIN_PASS" == "$ADMIN_PASS2" ]]; then break
      else err "Passwords do not match. Try again."; fi
    else
      err "Password must be at least 8 characters."
    fi
  done

  # ── Deployment mode ───────────────────────────────────────────────────────
  step "Deployment"
  echo -e "  ${BOLD}1)${NC} Local / development   ${DIM}— HTTP on localhost:8015${NC}"
  echo -e "  ${BOLD}2)${NC} Production            ${DIM}— behind HTTPS reverse proxy${NC}"
  echo ""
  ask DEPLOY_NUM "Choose deployment mode" "1"

  if [[ "$DEPLOY_NUM" == "2" ]]; then
    COOKIE_SECURE="True"
    ask PUBLIC_HOST "Public hostname (e.g. matchnights.example.com)" ""
    CORS_ORIGINS="[\"https://${PUBLIC_HOST:-matchnights.example.com}\"]"
  else
    COOKIE_SECURE="False"
    CORS_ORIGINS='["http://localhost"]'
  fi

  # ── The Odds API (optional) ───────────────────────────────────────────────
  step "Odds (optional)"
  echo -e "  ${DIM}Match odds are fetched from the-odds-api.com (500 free requests/month).${NC}"
  echo -e "  ${DIM}Get a free key at: ${BOLD}https://the-odds-api.com${NC}"
  echo ""
  if ask_yn "Add an odds API key now?"; then
    ask ODDS_API_KEY "the-odds-api.com key" ""
  else
    ODDS_API_KEY=""
    info "You can add ODDS_API_KEY to .env later."
  fi

  # ── Generate secret key ───────────────────────────────────────────────────
  step "Generating security secret"
  SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null \
    || openssl rand -hex 32 2>/dev/null \
    || { err "Cannot generate a secret key — install Python 3 or openssl"; exit 1; })
  success "Secret key generated"

  # ── Write .env ────────────────────────────────────────────────────────────
  step "Writing .env"

  # Slugify league name for DB filename
  DB_NAME=$(echo "$LEAGUE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g' | sed 's/__*/_/g' | sed 's/^_\|_$//g')
  DB_FILE="${DB_NAME:-matchnights}.db"

  # Set source-specific key vars
  FD_KEY=""; AS_KEY=""
  [[ "$DATA_SOURCE" == "football_data" ]] && FD_KEY="$API_KEY"
  [[ "$DATA_SOURCE" == "api_sports"    ]] && AS_KEY="$API_KEY"

  cat > "$ENV_FILE" <<EOF
# Generated by setup.sh — $(date)

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=sqlite+aiosqlite:////app/data/${DB_FILE}
DB_FILE=/app/data/${DB_FILE}

# ── Security ──────────────────────────────────────────────────────────────────
SECRET_KEY=${SECRET_KEY}
SECRET_KEY_PREVIOUS=

ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
COOKIE_SECURE=${COOKIE_SECURE}

# ── Football data source ───────────────────────────────────────────────────────
FOOTBALL_DATA_SOURCE=${DATA_SOURCE}
FOOTBALL_DATA_ORG_KEY=${FD_KEY}
FOOTBALL_API_KEY=${AS_KEY}
FOOTBALL_API_HOST=v3.football.api-sports.io
FOOTBALL_WC_LEAGUE_ID=${LEAGUE_ID}
FOOTBALL_WC_SEASON=${SEASON}

# ── League display name ───────────────────────────────────────────────────────
LEAGUE_NAME=${LEAGUE_NAME}

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ORIGINS=${CORS_ORIGINS}

# ── Invites ───────────────────────────────────────────────────────────────────
INVITE_TOKEN_EXPIRE_HOURS=72

# ── Bootstrap admin ───────────────────────────────────────────────────────────
FIRST_ADMIN_EMAIL=${ADMIN_EMAIL}
FIRST_ADMIN_PASSWORD=${ADMIN_PASS}

# ── Odds ──────────────────────────────────────────────────────────────────────
ODDS_API_KEY=${ODDS_API_KEY}

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_LEVEL=INFO
EOF

  success ".env written"

fi  # end SKIP_CONFIG

# ── Build ─────────────────────────────────────────────────────────────────────
step "Building Docker images"
echo -e "  ${DIM}This may take a few minutes on the first run…${NC}"
echo ""

cd "$SCRIPT_DIR"
$COMPOSE build 2>&1 | while IFS= read -r line; do
  # Show only meaningful build progress
  if echo "$line" | grep -qE "^(#[0-9]+ (DONE|ERROR)|Step|Successfully|error)"; then
    echo "  $line"
  fi
done
success "Images built"

# ── Start ─────────────────────────────────────────────────────────────────────
step "Starting MatchNights"
$COMPOSE up -d
echo ""

# ── Health check ──────────────────────────────────────────────────────────────
info "Waiting for backend to become healthy…"
MAX_WAIT=60; WAITED=0; HEALTHY=false
while [[ $WAITED -lt $MAX_WAIT ]]; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8015/api/health 2>/dev/null || echo "000")
  if [[ "$STATUS" == "200" ]]; then
    HEALTHY=true; break
  fi
  sleep 2; WAITED=$((WAITED + 2))
  echo -en "\r  ${DIM}Waiting… ${WAITED}s${NC}   "
done
echo ""

if [[ "$HEALTHY" == true ]]; then
  success "Backend is healthy"
else
  warn "Backend didn't respond within ${MAX_WAIT}s. It may still be starting."
  warn "Check logs with: ${BOLD}$COMPOSE logs backend${NC}"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  MatchNights is up and running!${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}URL:${NC}          ${CYAN}http://localhost:8015${NC}"
if [[ -n "${ADMIN_EMAIL:-}" ]]; then
  echo -e "  ${BOLD}Admin login:${NC}  ${ADMIN_EMAIL}"
fi
echo ""
echo -e "  ${DIM}Next steps:${NC}"
echo -e "  ${BOLD}1)${NC} Open ${CYAN}http://localhost:8015${NC} and log in"
echo -e "  ${BOLD}2)${NC} Go to ${BOLD}Admin → Match Sync${NC} to pull fixture data"
echo -e "  ${BOLD}3)${NC} Go to ${BOLD}Admin → Invites${NC} to generate invite links for your friends"
echo ""
echo -e "  ${DIM}Useful commands:${NC}"
echo -e "  ${DIM}  Stop:     ${BOLD}$COMPOSE down${NC}"
echo -e "  ${DIM}  Logs:     ${BOLD}$COMPOSE logs -f backend${NC}"
echo -e "  ${DIM}  Restart:  ${BOLD}$COMPOSE restart${NC}"
echo ""
