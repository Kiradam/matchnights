import hashlib
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: int, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def create_calendar_token(user_id: int) -> str:
    """Short-lived (5 min) single-purpose token for .ics downloads."""
    payload = {
        "sub": str(user_id),
        "type": "calendar",
        "exp": datetime.now(UTC) + timedelta(minutes=5),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> dict | None:
    for secret in filter(None, [settings.SECRET_KEY, settings.SECRET_KEY_PREVIOUS]):
        try:
            return jwt.decode(token, secret, algorithms=["HS256"])
        except JWTError:
            continue
    return None


def create_refresh_token() -> tuple[str, str]:
    """Return (raw_token, token_hash). Store only the hash."""
    raw = str(uuid.uuid4())
    return raw, hashlib.sha256(raw.encode()).hexdigest()


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def refresh_token_expires_at() -> datetime:
    return datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
