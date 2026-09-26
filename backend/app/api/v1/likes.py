import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.user import User
from app.models.memory import Memory
from app.models.membership import Membership
from app.models.like import Like
from app.models.notification import Notification
from app.schemas.memory import LikeToggleOut
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/{memory_id}/like", response_model=LikeToggleOut)
async def toggle_like(
    memory_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify memory exists
    mem_stmt = select(Memory).where(Memory.id == memory_id)
    memory = (await db.execute(mem_stmt)).scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")

    # Verify user is member of this space
    membership_stmt = select(Membership).where(
        Membership.space_id == memory.space_id,
        Membership.user_id == current_user.id
    )
    if not (await db.execute(membership_stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this Space to like memories"
        )

    # Check existing like
    like_stmt = select(Like).where(
        Like.memory_id == memory_id,
        Like.user_id == current_user.id
    )
    existing_like = (await db.execute(like_stmt)).scalar_one_or_none()

    if existing_like:
        await db.delete(existing_like)
        is_liked = False
    else:
        new_like = Like(
            memory_id=memory_id,
            user_id=current_user.id
        )
        db.add(new_like)
        is_liked = True

        # Notify author if not self and author exists
        if memory.author_id and memory.author_id != current_user.id:
            notif = Notification(
                user_id=memory.author_id,
                actor_id=current_user.id,
                memory_id=memory.id,
                space_id=memory.space_id,
                type="like",
                content="liked your memory"
            )
            db.add(notif)

    await db.commit()

    # Get updated count
    count_stmt = select(func.count(Like.id)).where(Like.memory_id == memory_id)
    likes_count = (await db.execute(count_stmt)).scalar_one() or 0

    return LikeToggleOut(
        memory_id=memory_id,
        is_liked=is_liked,
        likes_count=likes_count
    )
