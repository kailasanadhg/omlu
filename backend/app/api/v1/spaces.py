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
from app.schemas.space import (
    SpaceVisibilityUpdate,
    SpaceGuestSettingsUpdate,
    SpaceCreate,
    SpaceOut,
    SpaceMemberOut,
    InvitePreviewOut,
    GuestSpacePreviewOut,
)
from app.api.deps import get_current_user, get_current_user_optional
from app.core.guest_session import create_guest_session

router = APIRouter()

def generate_invite_code() -> str:
    """Generate a clean, URL-safe 12-character cryptographic token."""
    return secrets.token_urlsafe(9)

def generate_guest_token() -> str:
    """Generate a secure, cryptographically unguessable guest contribution token."""
    return secrets.token_urlsafe(24)


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
        visibility=payload.visibility,
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
        visibility=space.visibility,
        description=space.description,
        cover_url=space.cover_url,
        owner_id=space.owner_id,
        invite_code=space.invite_code,
        guest_uploads_enabled=space.guest_uploads_enabled,
        guest_token=space.guest_token,
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
    # Fetch the IDs of all spaces the current user belongs to, ordered newest first.
    # Selecting only Space + the user's own membership role — no window function,
    # no implicit cross-partition counting over the filtered set.
    stmt = (
        select(Space, Membership.role)
        .join(Membership, Membership.space_id == Space.id)
        .where(Membership.user_id == current_user.id)
        .order_by(Space.created_at.desc())
    )
    res = await db.execute(stmt)
    rows = res.all()

    ids = [row[0].id for row in rows]
    member_counts = dict((await db.execute(select(Membership.space_id, func.count(Membership.id)).where(Membership.space_id.in_(ids)).group_by(Membership.space_id))).all()) if ids else {}
    memory_counts = dict((await db.execute(select(Memory.space_id, func.count(Memory.id)).where(Memory.space_id.in_(ids)).group_by(Memory.space_id))).all()) if ids else {}
    output = []
    for row in rows:
        space, role = row[0], row[1]

        m_count = member_counts.get(space.id, 0)
        mem_count = memory_counts.get(space.id, 0)

        output.append(SpaceOut(
            id=space.id,
            name=space.name,
            visibility=space.visibility,
            description=space.description,
            cover_url=space.cover_url,
            owner_id=space.owner_id,
            invite_code=space.invite_code,
            guest_uploads_enabled=space.guest_uploads_enabled,
            guest_token=space.guest_token if ((space.owner_id == current_user.id) or space.guest_uploads_enabled) else None,
            members_count=m_count,
            memories_count=mem_count,
            is_owner=(space.owner_id == current_user.id),
            is_member=True,
            created_at=space.created_at
        ))

    return output

@router.get("/guest/{guest_token}", response_model=GuestSpacePreviewOut)
async def preview_guest_space(
    guest_token: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Space).where(Space.guest_token == guest_token.strip())
    space = (await db.execute(stmt)).scalar_one_or_none()
    if not space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or revoked guest link"
        )
    if not space.guest_uploads_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest uploads are currently disabled for this Space"
        )

    session_id, claim_token = create_guest_session()
    return GuestSpacePreviewOut(
        id=space.id,
        name=space.name,
        description=space.description,
        cover_url=space.cover_url,
        guest_session_id=session_id,
        guest_claim_token=claim_token
    )


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

    is_owner = (space.owner_id == current_user.id)
    return SpaceOut(
        id=space.id,
        name=space.name,
        visibility=space.visibility,
        description=space.description,
        cover_url=space.cover_url,
        owner_id=space.owner_id,
        invite_code=space.invite_code,
        guest_uploads_enabled=space.guest_uploads_enabled,
        guest_token=space.guest_token if (is_owner or space.guest_uploads_enabled) else None,
        members_count=m_count,
        memories_count=mem_count,
        is_owner=is_owner,
        is_member=True,
        created_at=space.created_at
    )

@router.get("/{space_id}", response_model=SpaceOut)
async def get_space(
    space_id: uuid.UUID,
    current_user: User = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Space).where(Space.id == space_id)
    space = (await db.execute(stmt)).scalar_one_or_none()
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")

    # Authorization: User must be a member
    mem_stmt = select(Membership).where(
        Membership.space_id == space.id,
        Membership.user_id == (current_user.id if current_user else None)
    )
    membership = (await db.execute(mem_stmt)).scalar_one_or_none()
    if not membership and space.visibility != "public":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this private Space"
        )

    m_count_stmt = select(func.count(Membership.id)).where(Membership.space_id == space.id)
    mem_count_stmt = select(func.count(Memory.id)).where(Memory.space_id == space.id)
    m_count = (await db.execute(m_count_stmt)).scalar_one() or 0
    mem_count = (await db.execute(mem_count_stmt)).scalar_one() or 0

    is_owner = (space.owner_id == (current_user.id if current_user else None))
    is_member = membership is not None

    return SpaceOut(
        id=space.id,
        name=space.name,
        visibility=space.visibility,
        description=space.description,
        cover_url=space.cover_url,
        owner_id=space.owner_id,
        invite_code=space.invite_code if is_member else "",
        guest_uploads_enabled=space.guest_uploads_enabled,
        guest_token=space.guest_token if (is_owner or (is_member and space.guest_uploads_enabled)) else None,
        members_count=m_count,
        memories_count=mem_count,
        is_owner=is_owner,
        is_member=is_member,
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

@router.patch("/{space_id}", response_model=SpaceOut)
async def update_space_visibility(space_id: uuid.UUID, payload: SpaceVisibilityUpdate,
                                  current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    space = await db.get(Space, space_id)
    if not space:
        raise HTTPException(404, "Space not found")
    if space.owner_id != current_user.id:
        raise HTTPException(403, "Only the Space owner can change visibility")
    space.visibility = payload.visibility
    await db.commit()
    return await get_space(space_id, current_user, db)

@router.patch("/{space_id}/guest-settings", response_model=SpaceOut)
async def update_guest_settings(
    space_id: uuid.UUID,
    payload: SpaceGuestSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    space = await db.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    if space.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the Space owner can change guest upload settings")

    space.guest_uploads_enabled = payload.guest_uploads_enabled
    if payload.guest_uploads_enabled and not space.guest_token:
        space.guest_token = generate_guest_token()

    await db.commit()
    await db.refresh(space)
    return await get_space(space_id, current_user, db)

@router.post("/{space_id}/regenerate-guest-link", response_model=SpaceOut)
async def regenerate_guest_link(
    space_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    space = await db.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    if space.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the Space owner can regenerate the guest link")

    space.guest_token = generate_guest_token()
    space.guest_uploads_enabled = True
    await db.commit()
    await db.refresh(space)
    return await get_space(space_id, current_user, db)

