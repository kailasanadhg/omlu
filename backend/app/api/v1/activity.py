from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.user import User
from app.models.notification import Notification
from app.schemas.activity import ActivityItemOut
from app.api.deps import get_current_user

router = APIRouter()

@router.get("", response_model=List[ActivityItemOut])
async def get_activity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .options(selectinload(Notification.actor))
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifications = (await db.execute(stmt)).scalars().all()

    # Mark as read
    if notifications:
        mark_stmt = (
            update(Notification)
            .where(Notification.user_id == current_user.id, Notification.is_read == False)
            .values(is_read=True)
        )
        await db.execute(mark_stmt)
        await db.commit()

    return [
        ActivityItemOut(
            id=n.id,
            type=n.type,
            actor_id=n.actor.id,
            actor_username=n.actor.username,
            actor_display_name=n.actor.display_name,
            actor_avatar_url=n.actor.avatar_url,
            memory_id=n.memory_id,
            space_id=n.space_id,
            content=n.content,
            is_read=n.is_read,
            created_at=n.created_at
        )
        for n in notifications
    ]
