"""Driver checks require no network or database connection."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import Settings


def test_render_url_drives_both_engines():
    config = Settings(
        _env_file=None,
        DATABASE_URL="postgres://user:p%40ss@render.internal/omlu?sslmode=require",
        SYNC_DATABASE_URL="",
    )
    async_url = make_url(config.DATABASE_URL)
    sync_url = make_url(config.SYNC_DATABASE_URL)
    assert async_url.drivername == "postgresql+asyncpg"
    assert sync_url.drivername == "postgresql+psycopg"
    assert async_url.password == sync_url.password == "p@ss"
    assert async_url.query["ssl"] == "require"
    assert sync_url.query["sslmode"] == "require"

    async_engine = create_async_engine(config.DATABASE_URL)
    sync_engine = create_engine(config.SYNC_DATABASE_URL)
    try:
        assert async_engine.sync_engine.dialect.driver == "asyncpg"
        assert sync_engine.dialect.driver == "psycopg"
    finally:
        sync_engine.dispose()


def test_independent_generic_and_explicit_urls():
    config = Settings(
        _env_file=None,
        DATABASE_URL="postgresql://user:pass@async.internal/app",
        SYNC_DATABASE_URL="postgresql://user:pass@sync.internal/app",
    )
    assert make_url(config.DATABASE_URL).host == "async.internal"
    assert make_url(config.SYNC_DATABASE_URL).host == "sync.internal"
    assert make_url(config.DATABASE_URL).drivername == "postgresql+asyncpg"
    assert make_url(config.SYNC_DATABASE_URL).drivername == "postgresql+psycopg"

    async_explicit = "postgresql+asyncpg://user:pass@host/app?ssl=require"
    sync_explicit = "postgresql+psycopg://user:pass@host/app?sslmode=require"
    explicit = Settings(
        _env_file=None, DATABASE_URL=async_explicit, SYNC_DATABASE_URL=sync_explicit
    )
    assert explicit.DATABASE_URL == async_explicit
    assert explicit.SYNC_DATABASE_URL == sync_explicit


@pytest.mark.parametrize(
    ("database_url", "sync_url"),
    [
        ("postgresql+psycopg://user:pass@host/app", ""),
        ("postgresql+asyncpg://user:pass@host/app", "postgresql+asyncpg://user:pass@host/app"),
    ],
)
def test_conflicting_explicit_drivers_fail_without_rewriting(database_url, sync_url):
    with pytest.raises(ValueError, match="Expected a PostgreSQL URL"):
        Settings(
            _env_file=None, DATABASE_URL=database_url, SYNC_DATABASE_URL=sync_url
        )
