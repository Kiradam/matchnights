# Contributing to MatchNights

Thanks for your interest in contributing. Here's everything you need to get started.

## Development setup

**Prerequisites:** Docker, Node 20+, Python 3.12+

```bash
git clone https://github.com/Kiradam/matchnights.git
cd matchnights
cp .env.example .env
# Fill in SECRET_KEY, FIRST_ADMIN_EMAIL, FIRST_ADMIN_PASSWORD, and FOOTBALL_DATA_ORG_KEY
docker compose up -d --build
```

The app runs at `http://localhost:8015`. The backend API is at `/api`.

## Running tests

**Backend:**
```bash
cd backend
pip install -r requirements-dev.txt
pytest -v
```

**Frontend:**
```bash
cd frontend
npm install
npm test
```

**Lint:**
```bash
cd backend && ruff check .
cd frontend && npm run lint
```

## Workflow

1. Fork the repo and create a branch from `main`
2. Make your changes — keep commits focused and the commit message clear
3. Ensure `pytest` and `npm test` pass and both linters are clean
4. Open a pull request against `main`; CI (ruff + pytest + eslint + build) runs automatically

## Architecture notes

- **Backend:** FastAPI, SQLAlchemy 2 async, SQLite, Alembic migrations, APScheduler for background jobs
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS — all UI strings go through `i18n/locales/en.json` and `hu.json`
- **No new dependencies without a reason** — prefer the standard library and existing packages
- **Migrations:** any DB schema change needs an Alembic migration in `backend/alembic/versions/`

## Reporting bugs

Open a GitHub issue. Include steps to reproduce, expected vs actual behaviour, and your Docker/OS version.
