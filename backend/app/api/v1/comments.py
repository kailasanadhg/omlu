import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.user import User
from app.models.memory import Memory
from app.models.space import Space
from app.models.membership import Membership
from app.models.comment import Comment
from app.models.notification import Notification
from app.schemas.comment import CommentCreate, CommentOut
from app.api.deps import get_current_user, get_current_user_optional, require_space_read

router = APIRouter()

@router.get("/{memory_id}/comments", response_model=List[CommentOut])
async def list_comments(
    memory_id: uuid.UUID,
    current_user: User = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    mem_stmt = select(Memory, Space.owner_id).join(Space, Space.id == Memory.space_id).where(Memory.id == memory_id)
    result = (await db.execute(mem_stmt)).first()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    memory, space_owner_id = result

    await require_space_read(memory.space_id, current_user, db)

    stmt = (
        select(Comment)
        .where(Comment.memory_id == memory_id)
        .options(selectinload(Comment.user))
        .order_by(Comment.created_at.asc())
    )
    comments = (await db.execute(stmt)).scalars().all()

    return [
        CommentOut(
            id=c.id,
            memory_id=c.memory_id,
            user_id=c.user_id,
            author_username=c.user.username,
            author_display_name=c.user.display_name,
            author_avatar_url=c.user.avatar_url,
            body=c.body,
            created_at=c.created_at,
            can_delete=(c.user_id == (current_user.id if current_user else None) or space_owner_id == (current_user.id if current_user else None))
        )
        for c in comments
    ]

@router.post("/{memory_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def create_comment(
    memory_id: uuid.UUID,
    payload: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    mem_stmt = select(Memory, Space.owner_id).join(Space, Space.id == Memory.space_id).where(Memory.id == memory_id)
    result = (await db.execute(mem_stmt)).first()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    memory, space_owner_id = result

    # Check membership
    mem_check = select(Membership).where(
        Membership.space_id == memory.space_id,
        Membership.user_id == current_user.id
    )
    if not (await db.execute(mem_check)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    comment = Comment(
        user_id=current_user.id,
        memory_id=memory_id,
        body=payload.body.strip()
    )
    db.add(comment)

    # Notify memory author if not self and author exists
    if memory.author_id and memory.author_id != current_user.id:
        notif = Notification(
            user_id=memory.author_id,
            actor_id=current_user.id,
            memory_id=memory.id,
            space_id=memory.space_id,
            type="comment",
            content=f"commented: {payload.body.strip()[:60]}"
        )
        db.add(notif)

    await db.commit()
    await db.refresh(comment)

    return CommentOut(
        id=comment.id,
        memory_id=comment.memory_id,
        user_id=comment.user_id,
        author_username=current_user.username,
        author_display_name=current_user.display_name,
        author_avatar_url=current_user.avatar_url,
        body=comment.body,
        created_at=comment.created_at,
        can_delete=True
    )

@router.delete("/{memory_id}/comments/{comment_id}")
async def delete_comment(
    memory_id: uuid.UUID,
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Comment, Space.owner_id)
        .join(Memory, Memory.id == Comment.memory_id)
        .join(Space, Space.id == Memory.space_id)
        .where(Comment.id == comment_id, Comment.memory_id == memory_id)
    )
    result = (await db.execute(stmt)).first()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    comment, space_owner_id = result

    can_delete = (comment.user_id == current_user.id or space_owner_id == current_user.id)
    if not can_delete:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    await db.delete(comment)
    await db.commit()

    return {"status": "deleted"}
