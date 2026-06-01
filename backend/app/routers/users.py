from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserUpdateMe

router = APIRouter(prefix="/users", tags=["users"])


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
