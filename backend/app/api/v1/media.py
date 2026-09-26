import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.cloudinary_service import cloudinary_service
from app.models.user import User
from app.models.space import Space
from app.models.membership import Membership
from app.schemas.media import CloudinarySignRequest, GuestCloudinarySignRequest, CloudinarySignResponse
from app.api.deps import get_current_user
from app.models.upload_session import UploadSession
from app.core.upload_sessions import lock_identity, verify_asset
from app.core.rate_limit import rate_limiter, get_client_ip

router = APIRouter()

@router.post("/guest-cloudinary-sign", response_model=CloudinarySignResponse)
async def get_guest_cloudinary_signature(
    payload: GuestCloudinarySignRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # Rate limit by client IP and guest token
    client_ip = get_client_ip(request)
    rate_limiter.check(f"guest_sign_ip:{client_ip}", max_requests=30, window_seconds=300, detail="Too many upload requests. Please wait a few minutes.")
    rate_limiter.check(f"guest_sign_token:{payload.guest_token}", max_requests=60, window_seconds=300, detail="Too many upload requests for this space link. Please wait a few minutes.")

    # Validate guest token
    stmt = select(Space).where(Space.guest_token == payload.guest_token.strip())
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

    folder = f"omlu/spaces/{space.id}/memories"
    session_id = payload.upload_session_id or uuid.uuid4()
    await lock_identity(db, f"upload:{session_id}")
    session = await db.get(UploadSession, session_id)
    if session is None:
        session = UploadSession(
            id=session_id,
            user_id=None,
            space_id=space.id,
            public_id=f"{folder}/{session_id.hex}",
            is_guest=True
        )
        db.add(session)
        await db.flush()
    if not session.is_guest or session.space_id != space.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Upload session does not belong to this guest Space")
    if session.memory_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Upload session already attached to a memory")

    sig_data = cloudinary_service.generate_upload_signature(folder, session_id.hex, immutable=True)
    return CloudinarySignResponse(**sig_data, upload_session_id=session.id)


@router.post("/cloudinary-sign", response_model=CloudinarySignResponse)
async def get_cloudinary_signature(
    payload: CloudinarySignRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if payload.purpose == "memory":
        if not payload.space_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="space_id is required for memory uploads"
            )
        # Verify user is an active member of this space
        member_stmt = select(Membership).where(
            Membership.space_id == payload.space_id,
            Membership.user_id == current_user.id
        )
        membership = (await db.execute(member_stmt)).scalar_one_or_none()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be a member of this Space to upload memories"
            )
        folder = f"omlu/spaces/{payload.space_id}/memories"

    elif payload.purpose == "space_cover":
        if not payload.space_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="space_id is required for space cover uploads"
            )
        # Verify user is the owner of this space
        space_stmt = select(Space).where(Space.id == payload.space_id)
        space = (await db.execute(space_stmt)).scalar_one_or_none()
        if not space:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Space not found"
            )
        if space.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the Space owner can update the cover image"
            )
        folder = f"omlu/spaces/{payload.space_id}/covers"

    elif payload.purpose == "avatar":
        folder = f"omlu/users/{current_user.id}/avatars"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid upload purpose"
        )

    # Generate secure signed parameters using server secret
    if payload.purpose == "memory":
        session_id = payload.upload_session_id or uuid.uuid4()
        await lock_identity(db, f"upload:{session_id}")
        session = await db.get(UploadSession, session_id)
        if session is None:
            session = UploadSession(id=session_id, user_id=current_user.id,
                                    space_id=payload.space_id, public_id=f"{folder}/{session_id.hex}")
            db.add(session)
            await db.flush()
        if session.user_id != current_user.id or session.space_id != payload.space_id:
            raise HTTPException(403, "Upload session does not belong to this user and Space")
        if session.memory_id:
            raise HTTPException(409, "Upload session already attached to a memory")
        sig_data = cloudinary_service.generate_upload_signature(folder, session_id.hex, immutable=True)
        return CloudinarySignResponse(**sig_data, upload_session_id=session.id)
    sig_data = cloudinary_service.generate_upload_signature(folder=folder)
    return CloudinarySignResponse(**sig_data)


@router.get("/upload-sessions/{session_id}")
async def recover_upload(session_id: uuid.UUID, current_user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    session = (await db.execute(select(UploadSession).where(UploadSession.id == session_id).with_for_update())).scalar_one_or_none()
    if not session or session.user_id != current_user.id:
        raise HTTPException(404, "Upload session not found")
    member = await db.scalar(select(Membership.id).where(Membership.user_id == current_user.id, Membership.space_id == session.space_id))
    if not member:
        raise HTTPException(403, "You are no longer a member of this Space")
    return await verify_asset(session)
