import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.cloudinary_service import cloudinary_service
from app.models.user import User
from app.models.space import Space
from app.models.membership import Membership
from app.models.memory import Memory
from app.models.media import Media
from app.models.like import Like
from app.models.comment import Comment
from app.models.note import Note
from app.schemas.memory import MemoryCreate, MemoryOut
from app.schemas.media import MediaItemOut
from app.schemas.note import NoteOut
from app.api.deps import get_current_user

router = APIRouter()

async def format_memory_out(memory: Memory, current_user_id: uuid.UUID, space_owner_id: uuid.UUID, db: AsyncSession) -> MemoryOut:
    # Likes count and is_liked_by_me
    likes_count_stmt = select(func.count(Like.id)).where(Like.memory_id == memory.id)
    is_liked_stmt = select(Like).where(Like.memory_id == memory.id, Like.user_id == current_user_id)
    comments_count_stmt = select(func.count(Comment.id)).where(Comment.memory_id == memory.id)

    likes_count = (await db.execute(likes_count_stmt)).scalar_one() or 0
    is_liked = (await db.execute(is_liked_stmt)).scalar_one_or_none() is not None
    comments_count = (await db.execute(comments_count_stmt)).scalar_one() or 0

    can_delete = (memory.author_id == current_user_id) or (space_owner_id == current_user_id)

    media_items_out = [
        MediaItemOut(
            id=m.id,
            cloudinary_public_id=m.cloudinary_public_id,
            secure_url=m.secure_url,
            resource_type=m.resource_type,
            format=m.format,
            width=m.width,
            height=m.height,
            position=m.position
        )
        for m in sorted(memory.media_items, key=lambda x: x.position)
    ]

    notes_out = [
        NoteOut(
            id=n.id,
            memory_id=n.memory_id,
            author_id=n.author_id,
            author_username=n.author.username,
            author_display_name=n.author.display_name,
            author_avatar_url=n.author.avatar_url,
            body=n.body,
            created_at=n.created_at,
            can_delete=(n.author_id == current_user_id or space_owner_id == current_user_id)
        )
        for n in getattr(memory, "notes", [])
    ]

    return MemoryOut(
        id=memory.id,
        space_id=memory.space_id,
        space_name=memory.space.name,
        author_id=memory.author_id,
        author_username=memory.author.username,
        author_display_name=memory.author.display_name,
        author_avatar_url=memory.author.avatar_url,
        caption=memory.caption,
        memory_date=memory.memory_date,
        created_at=memory.created_at,
        media_items=media_items_out,
        likes_count=likes_count,
        is_liked_by_me=is_liked,
        comments_count=comments_count,
        notes=notes_out,
        can_delete=can_delete
    )

@router.post("", response_model=MemoryOut, status_code=status.HTTP_201_CREATED)
async def create_memory(
    payload: MemoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify Space exists and user is a member
    space_stmt = select(Space).where(Space.id == payload.space_id)
    space = (await db.execute(space_stmt)).scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")

    mem_stmt = select(Membership).where(
        Membership.space_id == payload.space_id,
        Membership.user_id == current_user.id
    )
    membership = (await db.execute(mem_stmt)).scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this Space to post a memory"
        )

    # Validate media count (1 to 10)
    if len(payload.media_items) < 1 or len(payload.media_items) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A Memory must contain between 1 and 10 photos"
        )

    # Create memory atomically
    memory = Memory(
        author_id=current_user.id,
        space_id=space.id,
        caption=payload.caption.strip() if payload.caption else None,
        memory_date=payload.memory_date or datetime.now(timezone.utc).date()
    )
    db.add(memory)
    await db.flush()

    for idx, item in enumerate(payload.media_items):
        media = Media(
            memory_id=memory.id,
            cloudinary_public_id=item.cloudinary_public_id,
            cloudinary_asset_id=item.cloudinary_asset_id,
            secure_url=item.secure_url,
            resource_type=item.resource_type or "image",
            format=item.format,
            width=item.width,
            height=item.height,
            bytes=item.bytes,
            position=idx
        )
        db.add(media)

    await db.commit()

    # Re-query with eager loading
    stmt = (
        select(Memory)
        .where(Memory.id == memory.id)
        .options(
            selectinload(Memory.author),
            selectinload(Memory.space),
            selectinload(Memory.media_items),
            selectinload(Memory.notes).selectinload(Note.author)
        )
    )
    loaded_memory = (await db.execute(stmt)).scalar_one()

    return await format_memory_out(loaded_memory, current_user.id, space.owner_id, db)

@router.get("/feed", response_model=List[MemoryOut])
async def get_home_feed(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Get all spaces user is member of
    user_spaces_subq = select(Membership.space_id).where(Membership.user_id == current_user.id).subquery()

    stmt = (
        select(Memory, Space.owner_id)
        .join(Space, Space.id == Memory.space_id)
        .where(Memory.space_id.in_(select(user_spaces_subq)))
        .options(
            selectinload(Memory.author),
            selectinload(Memory.space),
            selectinload(Memory.media_items),
            selectinload(Memory.notes).selectinload(Note.author)
        )
        .order_by(Memory.created_at.desc())
        .limit(50)
    )
    results = (await db.execute(stmt)).all()

    memories_out = []
    for memory, owner_id in results:
        memories_out.append(await format_memory_out(memory, current_user.id, owner_id, db))
    return memories_out

@router.get("/space/{space_id}", response_model=List[MemoryOut])
async def get_space_memories(
    space_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify Space and membership
    space_stmt = select(Space).where(Space.id == space_id)
    space = (await db.execute(space_stmt)).scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")

    mem_stmt = select(Membership).where(
        Membership.space_id == space_id,
        Membership.user_id == current_user.id
    )
    membership = (await db.execute(mem_stmt)).scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view memories in this private Space"
        )

    stmt = (
        select(Memory)
        .where(Memory.space_id == space_id)
        .options(
            selectinload(Memory.author),
            selectinload(Memory.space),
            selectinload(Memory.media_items),
            selectinload(Memory.notes).selectinload(Note.author)
        )
        .order_by(Memory.memory_date.desc(), Memory.created_at.desc())
        .limit(100)
    )
    memories = (await db.execute(stmt)).scalars().all()

    return [await format_memory_out(m, current_user.id, space.owner_id, db) for m in memories]

@router.get("/user/{user_id}", response_model=List[MemoryOut])
async def get_user_memories(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    CRITICAL PRIVACY RULE:
    Only return memories belonging to Spaces that BOTH current_user and user_id belong to.
    """
    if current_user.id == user_id:
        # User viewing their own profile: return memories from all their spaces
        user_spaces = select(Membership.space_id).where(Membership.user_id == user_id)
        stmt = (
            select(Memory, Space.owner_id)
            .join(Space, Space.id == Memory.space_id)
            .where(Memory.author_id == user_id, Memory.space_id.in_(user_spaces))
            .options(
                selectinload(Memory.author),
                selectinload(Memory.space),
                selectinload(Memory.media_items),
                selectinload(Memory.notes).selectinload(Note.author)
            )
            .order_by(Memory.memory_date.desc(), Memory.created_at.desc())
        )
    else:
        # User viewing someone else's profile: strictly find shared spaces
        shared_spaces_subq = (
            select(Membership.space_id)
            .where(Membership.user_id.in_([current_user.id, user_id]))
            .group_by(Membership.space_id)
            .having(func.count(Membership.user_id) == 2)
            .subquery()
        )
        stmt = (
            select(Memory, Space.owner_id)
            .join(Space, Space.id == Memory.space_id)
            .where(
                Memory.author_id == user_id,
                Memory.space_id.in_(select(shared_spaces_subq.c.space_id))
            )
            .options(
                selectinload(Memory.author),
                selectinload(Memory.space),
                selectinload(Memory.media_items),
                selectinload(Memory.notes).selectinload(Note.author)
            )
            .order_by(Memory.memory_date.desc(), Memory.created_at.desc())
        )

    results = (await db.execute(stmt)).all()
    return [await format_memory_out(m, current_user.id, owner_id, db) for m, owner_id in results]

@router.get("/{memory_id}", response_model=MemoryOut)
async def get_memory_detail(
    memory_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Memory, Space.owner_id)
        .join(Space, Space.id == Memory.space_id)
        .where(Memory.id == memory_id)
        .options(
            selectinload(Memory.author),
            selectinload(Memory.space),
            selectinload(Memory.media_items),
            selectinload(Memory.notes).selectinload(Note.author)
        )
    )
    result = (await db.execute(stmt)).first()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    memory, owner_id = result

    # Verify user is member of this space
    mem_check = select(Membership).where(
        Membership.space_id == memory.space_id,
        Membership.user_id == current_user.id
    )
    if not (await db.execute(mem_check)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this private Space"
        )

    return await format_memory_out(memory, current_user.id, owner_id, db)

@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Memory, Space.owner_id)
        .join(Space, Space.id == Memory.space_id)
        .where(Memory.id == memory_id)
        .options(selectinload(Memory.media_items))
    )
    result = (await db.execute(stmt)).first()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    memory, owner_id = result

    # Permission: Author or Space Owner can delete
    can_delete = (memory.author_id == current_user.id) or (owner_id == current_user.id)
    if not can_delete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this Memory"
        )

    # Clean up Cloudinary assets
    for item in memory.media_items:
        cloudinary_service.delete_asset(item.cloudinary_public_id)

    await db.delete(memory)
    await db.commit()

    return {"status": "deleted"}
