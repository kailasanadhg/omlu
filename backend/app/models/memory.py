import uuid
from datetime import datetime, date
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import Text, Date, DateTime, ForeignKey, func, String, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.space import Space
    from app.models.media import Media
    from app.models.like import Like
    from app.models.comment import Comment
    from app.models.note import Note

class Memory(Base):
    __tablename__ = "memories"
    __table_args__ = (UniqueConstraint("author_id", "client_id", name="uq_memory_author_client"),
        Index("ix_memories_space_collection", "space_id", "memory_date", "created_at", "id"),
        Index("ix_memories_author_collection", "author_id", "memory_date", "created_at", "id"))

    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    request_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    space_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    memory_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    author: Mapped["User"] = relationship("User", back_populates="memories")
    space: Mapped["Space"] = relationship("Space", back_populates="memories")
    media_items: Mapped[List["Media"]] = relationship("Media", back_populates="memory", cascade="all, delete-orphan", order_by="Media.position")
    likes: Mapped[List["Like"]] = relationship("Like", back_populates="memory", cascade="all, delete-orphan")
    comments: Mapped[List["Comment"]] = relationship("Comment", back_populates="memory", cascade="all, delete-orphan", order_by="Comment.created_at")
    notes: Mapped[List["Note"]] = relationship("Note", back_populates="memory", cascade="all, delete-orphan", order_by="Note.created_at")
