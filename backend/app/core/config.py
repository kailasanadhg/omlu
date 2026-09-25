from typing import Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
import os


def postgres_url(raw_url: str, driver: str) -> str:
    """Normalize provider URLs while preserving explicitly selected drivers."""
    if raw_url.startswith("postgres://"):
        raw_url = "postgresql://" + raw_url[len("postgres://"):]
    url = make_url(raw_url)
    expected = f"postgresql+{driver}"
    if url.drivername == expected:
        return raw_url
    if url.drivername != "postgresql":
        raise ValueError(f"Expected a PostgreSQL URL using {expected}; got {url.drivername}")
    url = url.set(drivername=expected)
    # Render/libpq URLs may use sslmode, which asyncpg expects as ssl.
    if driver == "asyncpg" and "sslmode" in url.query:
        query = dict(url.query)
        query["ssl"] = query.pop("sslmode")
        url = url.set(query=query)
    return url.render_as_string(hide_password=False)


class Settings(BaseSettings):
    PROJECT_NAME: str = "OMLU"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "omlu-super-secret-key-change-in-production-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 14  # 14 days
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+asyncpg://localhost:5432/omlu"
    )
    SYNC_DATABASE_URL: str = os.getenv("SYNC_DATABASE_URL", "")

    @model_validator(mode="after")
    def normalize_database_urls(self):
        # Render commonly supplies just DATABASE_URL. Derive the migration URL
        # from it so the app and Alembic always target the same database.
        sync_url = self.SYNC_DATABASE_URL
        self.DATABASE_URL = postgres_url(self.DATABASE_URL, "asyncpg")
        if sync_url:
            self.SYNC_DATABASE_URL = postgres_url(sync_url, "psycopg")
        else:
            url = make_url(self.DATABASE_URL)
            query = dict(url.query)
            if "ssl" in query:
                query["sslmode"] = query.pop("ssl")
            self.SYNC_DATABASE_URL = url.set(
                drivername="postgresql+psycopg", query=query
            ).render_as_string(hide_password=False)
        return self
    
    # Cloudinary Configuration
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "omlu-dev")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "dev-api-key")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "dev-api-secret")
    CLOUDINARY_URL: Optional[str] = os.getenv("CLOUDINARY_URL", None)
    
    # App URLs
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://omlu.in",
        "https://www.omlu.in"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
