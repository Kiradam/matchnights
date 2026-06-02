import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import require_admin
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.token import InviteToken, PasswordResetToken, RefreshToken
from app.models.user import User
from app.schemas.user import CreateInviteRequest, InviteOut, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])

FRONTEND_BASE = ""  # resolved at request time from request.base_url


def _registration_url(request: Request, token: str) -> str:
    base = str(request.base_url).rstrip("/")
    # In production Nginx strips /api prefix; construct frontend URL
    # Replace backend origin with frontend origin (same host, no /api)
    return f"{base.replace('/api', '')}/register?token={token}"


@router.get("/users", response_model=list[UserOut])
async def list_users(
    page: int = 1,
    page_size: int = 50,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[User]:
    offset = (page - 1) * page_size
    result = await db.execute(select(User).order_by(User.created_at).offset(offset).limit(page_size))
    return list(result.scalars())


@router.patch("/users/{user_id}", response_model=UserOut)
async def toggle_user_active(
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate yourself")

    user.is_active = not user.is_active

    if not user.is_active:
        await db.execute(
            update(RefreshToken).where(RefreshToken.user_id == user.id).values(revoked=True)
        )

    db.add(AuditLog(
        actor_id=admin.id,
        action="user.deactivated" if not user.is_active else "user.reactivated",
        target_type="user",
        target_id=str(user.id),
    ))
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: int,
    request: Request,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    token = str(uuid.uuid4())
    prt = PasswordResetToken(
        token=token,
        user_id=user.id,
        expires_at=datetime.now(UTC) + timedelta(hours=1),
    )
    db.add(prt)
    db.add(AuditLog(actor_id=admin.id, action="user.password_reset_requested", target_type="user", target_id=str(user.id)))
    await db.commit()

    base = str(request.base_url).rstrip("/").replace("/api", "")
    return {"reset_url": f"{base}/reset-password?token={token}", "expires_in_hours": 1}


@router.post("/invites", response_model=InviteOut)
async def create_invite(
    body: CreateInviteRequest,
    request: Request,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> InviteOut:
    hours = body.expires_in_hours or settings.INVITE_TOKEN_EXPIRE_HOURS
    token = str(uuid.uuid4())
    invite = InviteToken(
        token=token,
        created_by_id=admin.id,
        expires_at=datetime.now(UTC) + timedelta(hours=hours),
    )
    db.add(invite)
    db.add(AuditLog(actor_id=admin.id, action="invite.created", target_type="invite", target_id=token))
    await db.commit()
    await db.refresh(invite)

    reg_url = _registration_url(request, token)
    return InviteOut(
        id=invite.id,
        token=invite.token,
        registration_url=reg_url,
        expires_at=invite.expires_at,
        created_at=invite.created_at,
        used=invite.used_by_id is not None,
    )


@router.get("/invites", response_model=list[InviteOut])
async def list_invites(
    request: Request,
    page: int = 1,
    page_size: int = 50,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[InviteOut]:
    offset = (page - 1) * page_size
    result = await db.execute(
        select(InviteToken).order_by(InviteToken.created_at.desc()).offset(offset).limit(page_size)
    )
    invites = list(result.scalars())
    return [
        InviteOut(
            id=i.id,
            token=i.token,
            registration_url=_registration_url(request, i.token),
            expires_at=i.expires_at,
            created_at=i.created_at,
            used=i.used_by_id is not None,
        )
        for i in invites
    ]


@router.delete("/invites/{token}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite(
    token: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(InviteToken).where(InviteToken.token == token))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    # Force expiry by setting expires_at to epoch
    invite.expires_at = datetime(1970, 1, 1, tzinfo=UTC)
    db.add(AuditLog(actor_id=admin.id, action="invite.revoked", target_type="invite", target_id=token))
    await db.commit()
