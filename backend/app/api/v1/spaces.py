import uuid
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.user import User
from app.models.space import Space
from app.models.membership import Membership
from app.models.memory import Memory
from app.models.notification import Notification
from app.schemas.space import SpaceCreate, SpaceOut, SpaceMemberOut, InvitePreviewOut
from app.api.deps import get_current_user, get_current_user_optional

router = APIRouter()

def generate_invite_code() -> str:
    """Generate a clean, URL-safe 12-character cryptographic token."""
    return secrets.token_urlsafe(9)

@router.post("", response_model=SpaceOut, status_code=status.HTTP_201_CREATED)
async def create_space(
    payload: SpaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Generate unique invite code
    invite_code = generate_invite_code()
    
    space = Space(
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        cover_url=payload.cover_url.strip() if payload.cover_url else None,
        owner_id=current_user.id,
        invite_code=invite_code
    )
    db.add(space)
    await db.flush()

    # Automatically add creator as owner member
    membership = Membership(
        user_id=current_user.id,
        space_id=space.id,
        role="owner"
    )
    db.add(membership)
    await db.commit()
    await db.refresh(space)

    return SpaceOut(
        id=space.id,
        name=space.name,
        description=space.description,
        cover_url=space.cover_url,
        owner_id=space.owner_id,
        invite_code=space.invite_code,
        members_count=1,
        memories_count=0,
        is_owner=True,
        is_member=True,
        created_at=space.created_at
    )

@router.get("", response_model=List[SpaceOut])
async def list_my_spaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Query spaces user is a member of
    stmt = (
        select(
            Space,
            Membership.role,
            func.count(func.distinct(Membership.id)).over(partition_by=Space.id).label("members_count")
        )
        .join(Membership, Membership.space_id == Space.id)
        .where(Membership.user_id == current_user.id)
        .order_by(Space.created_at.desc())
    )
    res = await db.execute(stmt)
    spaces_with_role = res.all()

    output = []
    for row in spaces_with_role:
        space = row[0]
        # Count total members
        m_count_stmt = select(func.count(Membership.id)).where(Membership.space_id == space.id)
        mem_count_stmt = select(func.count(Memory.id)).where(Memory.space_id == space.id)
        
        m_count = (await db.execute(m_count_stmt)).scalar_one() or 0
        mem_count = (await db.execute(mem_count_stmt)).scalar_one() or 0

        output.append(SpaceOut(
            id=space.id,
            name=space.name,
            description=space.description,
            cover_url=space.cover_url,
            owner_id=space.owner_id,
            invite_code=space.invite_code,
            members_count=m_count,
            memories_count=mem_count,
            is_owner=(space.owner_id == current_user.id),
            is_member=True,
            created_at=space.created_at
        ))

    return output

@router.get("/join/{code}", response_model=InvitePreviewOut)
async def preview_invite(
    code: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Space).where(Space.invite_code == code.strip())
    space = (await db.execute(stmt)).scalar_one_or_none()
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invite link"
        )

    m_count_stmt = select(func.count(Membership.id)).where(Membership.space_id == space.id)
    mem_count_stmt = select(func.count(Memory.id)).where(Memory.space_id == space.id)
    m_count = (await db.execute(m_count_stmt)).scalar_one() or 0
    mem_count = (await db.execute(mem_count_stmt)).scalar_one() or 0

    is_member = False
    if current_user:
        check_stmt = select(Membership).where(
            Membership.space_id == space.id,
            Membership.user_id == current_user.id
        )
        is_member = (await db.execute(check_stmt)).scalar_one_or_none() is not None

    return InvitePreviewOut(
        id=space.id,
        name=space.name,
        description=space.description,
        cover_url=space.cover_url,
        members_count=m_count,
        memories_count=mem_count,
        invite_code=space.invite_code,
        is_member=is_member
    )

@router.post("/join/{code}", response_model=SpaceOut)
async def join_space(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Space).where(Space.invite_code == code.strip())
    space = (await db.execute(stmt)).scalar_one_or_none()
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invite code"
        )

    # Check if already a member
    mem_stmt = select(Membership).where(
        Membership.space_id == space.id,
        Membership.user_id == current_user.id
    )
    existing_mem = (await db.execute(mem_stmt)).scalar_one_or_none()
    
    if not existing_mem:
        # Create membership
        membership = Membership(
            user_id=current_user.id,
            space_id=space.id,
            role="member"
        )
        db.add(membership)

        # Notify space owner if owner is not current user
        if space.owner_id != current_user.id:
            notif = Notification(
                user_id=space.owner_id,
                actor_id=current_user.id,
                space_id=space.id,
                type="joined_space",
                content=f"joined {space.name}"
            )
            db.add(notif)
            
        await db.commit()

    m_count_stmt = select(func.count(Membership.id)).where(Membership.space_id == space.id)
    mem_count_stmt = select(func.count(Memory.id)).where(Memory.space_id == space.id)
    m_count = (await db.execute(m_count_stmt)).scalar_one() or 0
    mem_count = (await db.execute(mem_count_stmt)).scalar_one() or 0

    return SpaceOut(
        id=space.id,
        name=space.name,
        description=space.description,
        cover_url=space.cover_url,
        owner_id=space.owner_id,
        invite_code=space.invite_code,
        members_count=m_count,
        memories_count=mem_count,
        is_owner=(space.owner_id == current_user.id),
        is_member=True,
        created_at=space.created_at
    )

@router.get("/{space_id}", response_model=SpaceOut)
async def get_space(
    space_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Space).where(Space.id == space_id)
    space = (await db.execute(stmt)).scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")

    # Authorization: User must be a member
    mem_stmt = select(Membership).where(
        Membership.space_id == space.id,
        Membership.user_id == current_user.id
    )
    membership = (await db.execute(mem_stmt)).scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this private Space"
        )

    m_count_stmt = select(func.count(Membership.id)).where(Membership.space_id == space.id)
    mem_count_stmt = select(func.count(Memory.id)).where(Memory.space_id == space.id)
    m_count = (await db.execute(m_count_stmt)).scalar_one() or 0
    mem_count = (await db.execute(mem_count_stmt)).scalar_one() or 0

    return SpaceOut(
        id=space.id,
        name=space.name,
        description=space.description,
        cover_url=space.cover_url,
        owner_id=space.owner_id,
        invite_code=space.invite_code,
        members_count=m_count,
        memories_count=mem_count,
        is_owner=(space.owner_id == current_user.id),
        is_member=True,
        created_at=space.created_at
    )

@router.get("/{space_id}/members", response_model=List[SpaceMemberOut])
async def list_space_members(
    space_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify current user is a member
    mem_check = select(Membership).where(
        Membership.space_id == space_id,
        Membership.user_id == current_user.id
    )
    if not (await db.execute(mem_check)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this Space to view its members"
        )

    stmt = (
        select(Membership, User)
        .join(User, User.id == Membership.user_id)
        .where(Membership.space_id == space_id)
        .order_by(Membership.role.desc(), Membership.joined_at.asc())
    )
    results = (await db.execute(stmt)).all()

    return [
        SpaceMemberOut(
            id=membership.id,
            user_id=user.id,
            username=user.username,
            display_name=user.display_name,
            avatar_url=user.avatar_url,
            role=membership.role,
            joined_at=membership.joined_at
        )
        for membership, user in results
    ]

@router.delete("/{space_id}/members/{user_id}")
async def remove_space_member(
    space_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    space_stmt = select(Space).where(Space.id == space_id)
    space = (await db.execute(space_stmt)).scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")

    is_owner = (space.owner_id == current_user.id)
    is_self = (user_id == current_user.id)

    if not is_owner and not is_self:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to remove this member"
        )

    if is_self and is_owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space owner cannot leave their own Space. Delete the Space or transfer ownership."
        )

    mem_stmt = select(Membership).where(
        Membership.space_id == space_id,
        Membership.user_id == user_id
    )
    membership = (await db.execute(mem_stmt)).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in this Space")

    await db.delete(membership)
    await db.commit()

    return {"status": "removed"}
