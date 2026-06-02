from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import (
    create_calendar_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.match import Match
from app.models.preference import Preference, PreferenceChoice
from app.models.user import User
from app.schemas.user import UserOut, UserUpdateMe

router = APIRouter(prefix="/users", tags=["users"])

_WATCH_CHOICES = {PreferenceChoice.watch, PreferenceChoice.watch_together}


def _ical_esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _ical_fold(line: str) -> str:
    """RFC 5545 §3.1 — fold at 75 octets."""
    encoded = line.encode("utf-8")
    if len(encoded) <= 75:
        return line
    chunks: list[str] = []
    current = ""
    for char in line:
        if len((current + char).encode("utf-8")) > 75:
            chunks.append(current)
            current = " " + char
        else:
            current += char
    if current:
        chunks.append(current)
    return "\r\n".join(chunks)


@router.get("/me/calendar-token")
async def get_calendar_token(user: User = Depends(get_current_user)) -> dict:
    return {"token": create_calendar_token(user.id)}


@router.get("/me/calendar.ics", response_class=Response)
async def download_calendar(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> Response:
    payload = decode_access_token(token)
    if not payload or payload.get("type") != "calendar" or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    user_result = await db.execute(select(User).where(User.id == int(payload["sub"])))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    match_result = await db.execute(
        select(Match)
        .join(Preference, Preference.match_id == Match.id)
        .where(Preference.user_id == user.id, Preference.choice.in_(_WATCH_CHOICES))
        .distinct()
        .order_by(Match.match_datetime)
    )
    matches = match_result.scalars().all()

    now = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    league_slug = settings.LEAGUE_NAME.replace(" ", "")
    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:-//MatchNights//{league_slug}//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{settings.LEAGUE_NAME} Watchlist",
    ]

    for m in matches:
        start = m.match_datetime
        if start.tzinfo is None:
            start = start.replace(tzinfo=UTC)
        end = start + timedelta(hours=2)
        dtstart = start.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")
        dtend = end.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")

        lines += [
            "BEGIN:VEVENT",
            f"UID:mn-{m.id}@matchnights",
            f"DTSTAMP:{now}",
            f"DTSTART:{dtstart}",
            f"DTEND:{dtend}",
            f"SUMMARY:{_ical_esc(f'{m.home_team} vs {m.away_team}')}",
        ]
        if m.stage:
            lines.append(f"DESCRIPTION:{_ical_esc(m.stage)}")
        if m.venue:
            lines.append(f"LOCATION:{_ical_esc(m.venue)}")
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")

    content = "\r\n".join(_ical_fold(line) for line in lines) + "\r\n"

    return Response(
        content=content,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="wc2026-watchlist.ics"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserUpdateMe,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if body.new_password:
        if not body.current_password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="current_password required to set a new password",
            )
        if not verify_password(body.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="current_password is incorrect",
            )
        user.hashed_password = hash_password(body.new_password)

    if body.full_name is not None:
        user.full_name = body.full_name

    await db.commit()
    await db.refresh(user)
    return user
