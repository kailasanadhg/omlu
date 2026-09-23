from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import (
    verify_password, 
    get_password_hash, 
    create_access_token,
    normalize_username,
    validate_username
)
from app.models.user import User
from app.schemas.auth import SignupRequest, LoginRequest, Token, UserOut
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)):
    # 1. Normalize and validate username
    normalized_username = normalize_username(payload.username)
    is_valid, error_msg = validate_username(normalized_username)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    # 2. Check email uniqueness (case-insensitive)
    normalized_email = payload.email.strip().lower()
    email_stmt = select(User).where(func.lower(User.email) == normalized_email)
    existing_email = await db.execute(email_stmt)
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists"
        )

    # 3. Check username uniqueness (case-insensitive)
    username_stmt = select(User).where(func.lower(User.username) == normalized_username)
    existing_username = await db.execute(username_stmt)
    if existing_username.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The username @{normalized_username} is already taken"
        )

    # 4. Hash password and create user
    hashed_pw = get_password_hash(payload.password)
    user = User(
        email=normalized_email,
        username=normalized_username,
        display_name=payload.display_name.strip(),
        password_hash=hashed_pw
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # 5. Issue token
    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )

@router.post("/login", response_model=Token)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    identifier = payload.email_or_username.strip().lower().lstrip("@")
    
    # Query user by either email or username
    stmt = select(User).where(
        (func.lower(User.email) == identifier) | 
        (func.lower(User.username) == identifier)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user)
    )

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
