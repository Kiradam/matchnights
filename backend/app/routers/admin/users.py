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
from app.models.user import User, UserRole
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


@router.post("/users/{user_id}/toggle-role", response_model=UserOut)
async def toggle_user_role(
    user_id: int,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own role")
    new_role = UserRole.admin if user.role == UserRole.user else UserRole.user
    user.role = new_role
    db.add(AuditLog(
        actor_id=admin.id,
        action="user.promoted" if new_role == UserRole.admin else "user.demoted",
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
        use_count=invite.use_count,
        max_uses=invite.max_uses,
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
            use_count=i.use_count,
            max_uses=i.max_uses,
        )
        for i in invites
    ]


@router.post("/cleanup")
async def cleanup_expired(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    now = datetime.now(UTC)

    expired_invites_result = await db.execute(
        select(InviteToken).where(
            InviteToken.expires_at < now,
        )
    )
    invite_tokens = list(expired_invites_result.scalars())
    for t in invite_tokens:
        await db.delete(t)

    expired_refresh_result = await db.execute(
        select(RefreshToken).where(RefreshToken.expires_at < now)
    )
    refresh_tokens = list(expired_refresh_result.scalars())
    for t in refresh_tokens:
        await db.delete(t)

    db.add(AuditLog(
        actor_id=admin.id,
        action="admin.cleanup",
        target_type="system",
        payload={
            "invite_tokens_deleted": len(invite_tokens),
            "refresh_tokens_deleted": len(refresh_tokens),
        },
    ))
    await db.commit()
    return {
        "invite_tokens_deleted": len(invite_tokens),
        "refresh_tokens_deleted": len(refresh_tokens),
    }


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
