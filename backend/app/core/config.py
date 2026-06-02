from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "sqlite+aiosqlite:///./wc2026.db"

    SECRET_KEY: str = "change-me-in-production"
    SECRET_KEY_PREVIOUS: str | None = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # "football_data" = football-data.org free API (default)
    # "openfootball"  = free GitHub static JSON, no key needed
    # "api_sports"    = api-sports.io v3, requires paid plan for 2026
    FOOTBALL_DATA_SOURCE: str = "football_data"
    FOOTBALL_DATA_ORG_KEY: str = ""          # football-data.org X-Auth-Token
    FOOTBALL_API_KEY: str = ""               # api-sports.io key
    FOOTBALL_API_HOST: str = "v3.football.api-sports.io"
    FOOTBALL_WC_LEAGUE_ID: int = 1
    FOOTBALL_WC_SEASON: int = 2026
    LEAGUE_NAME: str = "WC 2026"  # Display name used in iCal export

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    INVITE_TOKEN_EXPIRE_HOURS: int = 72

    FIRST_ADMIN_EMAIL: str = ""
    FIRST_ADMIN_PASSWORD: str = ""

    ODDS_API_KEY: str = ""   # the-odds-api.com free key

    LOG_LEVEL: str = "INFO"


settings = Settings()
