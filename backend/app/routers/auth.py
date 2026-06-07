import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_token,
    refresh_token_expires_at,
    verify_password,
)
from app.db.session import get_db
from app.models.token import InviteToken, PasswordResetToken, RefreshToken
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordResetRequest,
    RegisterRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        raw_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")


async def _issue_tokens(user: User, db: AsyncSession, response: Response) -> TokenResponse:
    access = create_access_token(user.id, user.role.value)
    raw, token_hash = create_refresh_token()
    family = str(uuid.uuid4())
    rt = RefreshToken(
        token_hash=token_hash,
        user_id=user.id,
        family=family,
        expires_at=refresh_token_expires_at(),
    )
    db.add(rt)
    await db.commit()
    _set_refresh_cookie(response, raw)
    return TokenResponse(access_token=access)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    return await _issue_tokens(user, db, response)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/10minute")
async def register(
    request: Request,
    body: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    now = datetime.now(UTC)

    result = await db.execute(
        select(InviteToken).where(InviteToken.token == body.token)
    )
    invite = result.scalar_one_or_none()

    if not invite or invite.use_count >= invite.max_uses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invite token")
    if invite.expires_at.replace(tzinfo=UTC) < now:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invite token has expired")

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.flush()

    invite.use_count += 1
    await db.commit()
    await db.refresh(user)

    return await _issue_tokens(user, db, response)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(default=None),
) -> TokenResponse:
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    token_hash = hash_token(refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    rt = result.scalar_one_or_none()

    if not rt:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # Token reuse detection: revoke entire family
    if rt.revoked:
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.family == rt.family)
            .values(revoked=True)
        )
        await db.commit()
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token reuse detected")

    now = datetime.now(UTC)
    if rt.expires_at.replace(tzinfo=UTC) < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    user_result = await db.execute(select(User).where(User.id == rt.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    # Rotate: revoke old, issue new
    rt.revoked = True
    await db.flush()

    access = create_access_token(user.id, user.role.value)
    raw, new_hash = create_refresh_token()
    new_rt = RefreshToken(
        token_hash=new_hash,
        user_id=user.id,
        family=rt.family,
        expires_at=refresh_token_expires_at(),
    )
    db.add(new_rt)
    await db.commit()
    _set_refresh_cookie(response, raw)
    return TokenResponse(access_token=access)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(default=None),
) -> None:
    if refresh_token:
        token_hash = hash_token(refresh_token)
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        rt = result.scalar_one_or_none()
        if rt:
            rt.revoked = True
            await db.commit()
    _clear_refresh_cookie(response)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    body: PasswordResetRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> None:
    now = datetime.now(UTC)
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == body.token)
    )
    prt = result.scalar_one_or_none()

    if not prt or prt.used_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or already used token")
    if prt.expires_at.replace(tzinfo=UTC) < now:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Reset token expired")

    user_result = await db.execute(select(User).where(User.id == prt.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.hashed_password = hash_password(body.new_password)
    prt.used_at = now

    # Revoke all refresh tokens for this user
    await db.execute(
        update(RefreshToken).where(RefreshToken.user_id == user.id).values(revoked=True)
    )
    await db.commit()
    _clear_refresh_cookie(response)
