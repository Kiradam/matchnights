from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "sqlite+aiosqlite:///./wc2026.db"

    SECRET_KEY: str = "change-me-in-production"
    SECRET_KEY_PREVIOUS: str | None = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    FOOTBALL_API_KEY: str = ""
    FOOTBALL_API_HOST: str = "api-football-v3.p.rapidapi.com"
    FOOTBALL_WC_LEAGUE_ID: int = 1
    FOOTBALL_WC_SEASON: int = 2026

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    INVITE_TOKEN_EXPIRE_HOURS: int = 72

    FIRST_ADMIN_EMAIL: str = ""
    FIRST_ADMIN_PASSWORD: str = ""

    LOG_LEVEL: str = "INFO"


settings = Settings()
