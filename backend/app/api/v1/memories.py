import uuid
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
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
from app.models.upload_session import UploadSession
from app.core.upload_sessions import lock_identity, verify_asset
from app.models.like import Like
from app.models.comment import Comment
from app.models.note import Note
from app.schemas.memory import MemoryCreate, MemoryOut, RecentSpaceMemoryOut, RecentSpaceMemoriesOut
from app.schemas.media import MediaItemOut
from app.schemas.note import NoteOut
from app.api.deps import get_current_user, get_current_user_optional, require_space_read

router = APIRouter()

async def memory_stats(ids: list[uuid.UUID], current_user_id: uuid.UUID, db: AsyncSession) -> dict:
    if not ids:
        return {}
    likes = dict((await db.execute(select(Like.memory_id, func.count(Like.id)).where(Like.memory_id.in_(ids)).group_by(Like.memory_id))).all())
    liked = set((await db.execute(select(Like.memory_id).where(Like.memory_id.in_(ids), Like.user_id == current_user_id))).scalars())
    comments = dict((await db.execute(select(Comment.memory_id, func.count(Comment.id)).where(Comment.memory_id.in_(ids)).group_by(Comment.memory_id))).all())
    writable = set((await db.execute(select(Memory.id).join(Membership, Membership.space_id == Memory.space_id).where(Memory.id.in_(ids), Membership.user_id == current_user_id))).scalars())
    return {id: (likes.get(id, 0), id in liked, comments.get(id, 0), id in writable) for id in ids}


async def format_memory_out(memory: Memory, current_user_id: uuid.UUID, space_owner_id: uuid.UUID, db: AsyncSession, stats: Optional[dict] = None) -> MemoryOut:
    if stats is None:
        stats = await memory_stats([memory.id], current_user_id, db)
    likes_count, is_liked, comments_count, can_contribute = stats[memory.id]

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
        client_id=memory.client_id,
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
        can_contribute=can_contribute,
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

    uploads_repr = [
        str(item.upload_session_id) if item.upload_session_id else f"{item.cloudinary_public_id}:{item.secure_url}"
        for item in payload.media_items
    ]
    identity = {
        "space_id": str(payload.space_id),
        "caption": payload.caption.strip() if payload.caption else None,
        "memory_date": str(payload.memory_date) if payload.memory_date else None,
        "uploads": uploads_repr
    }
    request_hash = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()

    memory = None
    if payload.client_id:
        await lock_identity(db, f"memory:{current_user.id}:{payload.client_id}")
        memory = await db.scalar(
            select(Memory).where(
                Memory.author_id == current_user.id,
                Memory.client_id == payload.client_id
            )
        )
        if memory:
            if memory.request_hash != request_hash:
                raise HTTPException(status.HTTP_409_CONFLICT, "client_id was already used with different content")

    if memory is None:
        has_upload_sessions = any(item.upload_session_id is not None for item in payload.media_items)
        if has_upload_sessions:
            ids = [item.upload_session_id for item in payload.media_items]
            if any(u_id is None for u_id in ids):
                raise HTTPException(422, "All photos must provide an upload session")
            if len(set(ids)) != len(ids):
                raise HTTPException(422, "Each photo needs a distinct upload session")
            sessions = (
                await db.execute(
                    select(UploadSession)
                    .where(UploadSession.id.in_(ids))
                    .order_by(UploadSession.id)
                    .with_for_update()
                )
            ).scalars().all()
            if len(sessions) != len(ids) or any(u.user_id != current_user.id or u.space_id != space.id for u in sessions):
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Media was not authorized for this user and Space")
            if any(u.memory_id for u in sessions):
                raise HTTPException(status.HTTP_409_CONFLICT, "Media is already attached to another memory")
            assets = {u.id: await verify_asset(u) for u in sessions}
            memory = Memory(
                author_id=current_user.id,
                space_id=space.id,
                client_id=payload.client_id,
                request_hash=request_hash,
                caption=identity["caption"],
                memory_date=payload.memory_date or datetime.now(timezone.utc).date()
            )
            db.add(memory)
            await db.flush()
            for idx, upload_id in enumerate(ids):
                asset = assets[upload_id]
                db.add(
                    Media(
                        memory_id=memory.id,
                        cloudinary_public_id=asset["public_id"],
                        cloudinary_asset_id=asset.get("asset_id"),
                        secure_url=asset["secure_url"],
                        resource_type=asset.get("resource_type", "image"),
                        format=asset.get("format"),
                        width=asset.get("width"),
                        height=asset.get("height"),
                        bytes=asset.get("bytes"),
                        position=idx
                    )
                )
            for session in sessions:
                session.memory_id = memory.id
            await db.commit()
        else:
            memory = Memory(
                author_id=current_user.id,
                space_id=space.id,
                client_id=payload.client_id,
                request_hash=request_hash,
                caption=identity["caption"],
                memory_date=payload.memory_date or datetime.now(timezone.utc).date()
            )
            db.add(memory)
            await db.flush()
            for idx, item in enumerate(payload.media_items):
                db.add(
                    Media(
                        memory_id=memory.id,
                        cloudinary_public_id=item.cloudinary_public_id or "",
                        cloudinary_asset_id=item.cloudinary_asset_id,
                        secure_url=item.secure_url or "",
                        resource_type=item.resource_type or "image",
                        format=item.format,
                        width=item.width,
                        height=item.height,
                        bytes=item.bytes,
                        position=idx
                    )
                )
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

@router.get("/recent-spaces", response_model=RecentSpaceMemoriesOut)
async def get_recent_space_memories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lightweight, read-only view of existing memories from the last 24 hours."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)
    first_image = (
        select(Media.secure_url)
        .where(Media.memory_id == Memory.id)
        .order_by(Media.position, Media.id)
        .limit(1)
        .scalar_subquery()
    )
    stmt = (
        select(Memory.id, Memory.space_id, Memory.created_at, first_image.label("image_url"))
        .join(Membership, Membership.space_id == Memory.space_id)
        .where(
            Membership.user_id == current_user.id,
            Memory.created_at > cutoff,
            Memory.created_at <= now,
        )
        .order_by(Memory.created_at.asc(), Memory.id.asc())
    )
    rows = (await db.execute(stmt)).all()
    return RecentSpaceMemoriesOut(
        server_time=now,
        memories=[
            RecentSpaceMemoryOut(
                id=row.id,
                space_id=row.space_id,
                created_at=row.created_at,
                image_url=row.image_url,
            )
            for row in rows
        ],
    )


@router.get("/feed", response_model=List[MemoryOut])
async def get_home_feed(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    before: Optional[uuid.UUID] = None,
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
    )
    if before:
        anchor = await db.scalar(
            select(Memory)
            .where(Memory.id == before, Memory.space_id.in_(select(user_spaces_subq)))
        )
        if not anchor:
            raise HTTPException(400, "Invalid memory cursor")
        from sqlalchemy import tuple_
        stmt = stmt.where(tuple_(Memory.created_at, Memory.id) <
                          tuple_(anchor.created_at, anchor.id))
    stmt = stmt.order_by(Memory.created_at.desc(), Memory.id.desc()).limit(limit)
    results = (await db.execute(stmt)).all()

    stats = await memory_stats([m.id for m, _ in results], current_user.id, db)
    memories_out = []
    for memory, owner_id in results:
        memories_out.append(await format_memory_out(memory, current_user.id, owner_id, db, stats))
    return memories_out

@router.get("/space/{space_id}", response_model=List[MemoryOut])
async def get_space_memories(
    space_id: uuid.UUID,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=100),
    before: Optional[uuid.UUID] = None,
):
    space = await require_space_read(space_id, current_user, db)
    stmt = memory_collection().where(Memory.space_id == space_id)
    stmt = await paginate_memories(stmt, before, limit, db)
    memories = (await db.execute(stmt)).scalars().all()
    viewer_id = current_user.id if current_user else None
    stats = await memory_stats([m.id for m in memories], viewer_id, db)
    return [await format_memory_out(m, viewer_id, space.owner_id, db, stats) for m in memories]


def memory_collection():
    return select(Memory).options(
        selectinload(Memory.author), selectinload(Memory.space),
        selectinload(Memory.media_items), selectinload(Memory.notes).selectinload(Note.author))


async def paginate_memories(stmt, before, limit, db):
    # Cursor is looked up within the already-authorized collection, never globally.
    if before:
        anchor = (await db.execute(stmt.where(Memory.id == before))).scalar_one_or_none()
        if not anchor:
            raise HTTPException(400, "Invalid memory cursor")
        from sqlalchemy import tuple_
        stmt = stmt.where(tuple_(Memory.memory_date, Memory.created_at, Memory.id) <
                          tuple_(anchor.memory_date, anchor.created_at, anchor.id))
    return stmt.order_by(Memory.memory_date.desc(), Memory.created_at.desc(), Memory.id.desc()).limit(limit)


@router.get("/user/{user_id}", response_model=List[MemoryOut])
async def get_user_memories(
    user_id: uuid.UUID,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=100),
    before: Optional[uuid.UUID] = None,
):
    # Public profiles never aggregate private contributions, including for the owner.
    stmt = memory_collection().join(Space, Space.id == Memory.space_id).where(
        Memory.author_id == user_id, Space.visibility == "public")
    stmt = await paginate_memories(stmt, before, limit, db)
    memories = (await db.execute(stmt)).scalars().all()
    viewer_id = current_user.id if current_user else None
    stats = await memory_stats([m.id for m in memories], viewer_id, db)
    return [await format_memory_out(m, viewer_id, m.space.owner_id, db, stats) for m in memories]

@router.get("/by-client/{client_id}", response_model=MemoryOut)
async def get_memory_by_client(client_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    memory_id = await db.scalar(select(Memory.id).where(Memory.author_id == current_user.id, Memory.client_id == client_id))
    if not memory_id:
        raise HTTPException(404, "Memory not found")
    return await get_memory_detail(memory_id, current_user, db)


@router.get("/{memory_id}", response_model=MemoryOut)
async def get_memory_detail(
    memory_id: uuid.UUID,
    current_user: User = Depends(get_current_user_optional),
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

    await require_space_read(memory.space_id, current_user, db)

    return await format_memory_out(memory, current_user.id if current_user else None, owner_id, db)

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
