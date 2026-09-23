from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import normalize_username, validate_username
from app.models.user import User
from app.models.membership import Membership
from app.models.memory import Memory
from app.schemas.user import UserProfileOut, UserUpdate
from app.schemas.auth import UserOut
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/@{username}", response_model=UserProfileOut)
async def get_user_profile(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    clean_username = normalize_username(username)
    user_stmt = select(User).where(func.lower(User.username) == clean_username)
    result = await db.execute(user_stmt)
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User @{clean_username} not found"
        )

    is_self = (current_user.id == target_user.id)

    # Calculate accessible memories and spaces count
    if is_self:
        # Full counts for self
        mem_stmt = select(func.count(Memory.id)).where(Memory.author_id == target_user.id)
        space_stmt = select(func.count(Membership.id)).where(Membership.user_id == target_user.id)
        mem_res = await db.execute(mem_stmt)
        space_res = await db.execute(space_stmt)
        mem_count = mem_res.scalar_one() or 0
        space_count = space_res.scalar_one() or 0
    else:
        # Shared spaces only (CRITICAL PRIVACY RULE)
        # Find shared spaces where BOTH current_user and target_user are members
        shared_spaces_subq = (
            select(Membership.space_id)
            .where(Membership.user_id.in_([current_user.id, target_user.id]))
            .group_by(Membership.space_id)
            .having(func.count(Membership.user_id) == 2)
            .subquery()
        )
        # Memories by target_user in shared spaces
        mem_stmt = select(func.count(Memory.id)).where(
            Memory.author_id == target_user.id,
            Memory.space_id.in_(select(shared_spaces_subq.c.space_id))
        )
        # Shared space count
        space_stmt = select(func.count(shared_spaces_subq.c.space_id))
        
        mem_res = await db.execute(mem_stmt)
        space_res = await db.execute(space_stmt)
        mem_count = mem_res.scalar_one() or 0
        space_count = space_res.scalar_one() or 0

    return UserProfileOut(
        id=target_user.id,
        username=target_user.username,
        display_name=target_user.display_name,
        avatar_url=target_user.avatar_url,
        bio=target_user.bio,
        memories_count=mem_count,
        spaces_count=space_count,
        is_self=is_self
    )

@router.patch("/me/profile", response_model=UserOut)
async def update_profile(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if payload.username is not None:
        new_username = normalize_username(payload.username)
        if new_username != current_user.username:
            is_valid, err_msg = validate_username(new_username)
            if not is_valid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)
            
            stmt = select(User).where(func.lower(User.username) == new_username)
            existing = await db.execute(stmt)
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Username @{new_username} is taken")
            current_user.username = new_username

    if payload.display_name is not None:
        clean_name = payload.display_name.strip()
        if clean_name:
            current_user.display_name = clean_name

    if payload.bio is not None:
        current_user.bio = payload.bio.strip() or None

    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url.strip() or None

    await db.commit()
    await db.refresh(current_user)
    return UserOut.model_validate(current_user)
