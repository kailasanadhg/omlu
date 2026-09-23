from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.spaces import router as spaces_router
from app.api.v1.memories import router as memories_router
from app.api.v1.media import router as media_router
from app.api.v1.likes import router as likes_router
from app.api.v1.comments import router as comments_router
from app.api.v1.notes import router as notes_router
from app.api.v1.activity import router as activity_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(spaces_router, prefix="/spaces", tags=["spaces"])
api_router.include_router(media_router, prefix="/media", tags=["media"])
api_router.include_router(memories_router, prefix="/memories", tags=["memories"])
api_router.include_router(likes_router, prefix="/memories", tags=["likes"])
api_router.include_router(comments_router, prefix="/memories", tags=["comments"])
api_router.include_router(notes_router, prefix="/memories", tags=["notes"])
api_router.include_router(activity_router, prefix="/activity", tags=["activity"])
