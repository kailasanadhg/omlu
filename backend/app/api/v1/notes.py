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
from app.models.note import Note
from app.models.notification import Notification
from app.schemas.note import NoteCreate, NoteOut
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/{memory_id}/notes", response_model=List[NoteOut])
async def list_notes(
    memory_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    mem_stmt = select(Memory, Space.owner_id).join(Space, Space.id == Memory.space_id).where(Memory.id == memory_id)
    result = (await db.execute(mem_stmt)).first()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    memory, space_owner_id = result

    # Check Space membership
    mem_check = select(Membership).where(
        Membership.space_id == memory.space_id,
        Membership.user_id == current_user.id
    )
    if not (await db.execute(mem_check)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    stmt = (
        select(Note)
        .where(Note.memory_id == memory_id)
        .options(selectinload(Note.author))
        .order_by(Note.created_at.asc())
    )
    notes = (await db.execute(stmt)).scalars().all()

    return [
        NoteOut(
            id=n.id,
            memory_id=n.memory_id,
            author_id=n.author_id,
            author_username=n.author.username,
            author_display_name=n.author.display_name,
            author_avatar_url=n.author.avatar_url,
            body=n.body,
            created_at=n.created_at,
            can_delete=(n.author_id == current_user.id or space_owner_id == current_user.id)
        )
        for n in notes
    ]

@router.post("/{memory_id}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def add_note(
    memory_id: uuid.UUID,
    payload: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    mem_stmt = select(Memory, Space.owner_id).join(Space, Space.id == Memory.space_id).where(Memory.id == memory_id)
    result = (await db.execute(mem_stmt)).first()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    memory, space_owner_id = result

    # Check Space membership
    mem_check = select(Membership).where(
        Membership.space_id == memory.space_id,
        Membership.user_id == current_user.id
    )
    if not (await db.execute(mem_check)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    note = Note(
        author_id=current_user.id,
        memory_id=memory_id,
        body=payload.body.strip()
    )
    db.add(note)

    # Notify author if not self
    if memory.author_id != current_user.id:
        notif = Notification(
            user_id=memory.author_id,
            actor_id=current_user.id,
            memory_id=memory.id,
            space_id=memory.space_id,
            type="note",
            content=f"added a note: {payload.body.strip()[:60]}"
        )
        db.add(notif)

    await db.commit()
    await db.refresh(note)

    return NoteOut(
        id=note.id,
        memory_id=note.memory_id,
        author_id=note.author_id,
        author_username=current_user.username,
        author_display_name=current_user.display_name,
        author_avatar_url=current_user.avatar_url,
        body=note.body,
        created_at=note.created_at,
        can_delete=True
    )

@router.delete("/{memory_id}/notes/{note_id}")
async def delete_note(
    memory_id: uuid.UUID,
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Note, Space.owner_id)
        .join(Memory, Memory.id == Note.memory_id)
        .join(Space, Space.id == Memory.space_id)
        .where(Note.id == note_id, Note.memory_id == memory_id)
    )
    result = (await db.execute(stmt)).first()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    note, space_owner_id = result

    can_delete = (note.author_id == current_user.id or space_owner_id == current_user.id)
    if not can_delete:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

    await db.delete(note)
    await db.commit()

    return {"status": "deleted"}
