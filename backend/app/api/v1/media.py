from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.cloudinary_service import cloudinary_service
from app.models.user import User
from app.models.space import Space
from app.models.membership import Membership
from app.schemas.media import CloudinarySignRequest, CloudinarySignResponse
from app.api.deps import get_current_user

router = APIRouter()

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
    sig_data = cloudinary_service.generate_upload_signature(folder=folder)
    return CloudinarySignResponse(**sig_data)
