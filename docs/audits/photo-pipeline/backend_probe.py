"""Audit-only ASGI/SQL timing. Local PostgreSQL, isolated schema, outer rollback.

Run from repo root: backend/venv/bin/python docs/audits/photo-pipeline/backend_probe.py
No Cloudinary upload, existing data access, persistent fixtures, or app file edits.
HTTP transport is in-process: these are NOT mobile/network/commit-fsync timings.
"""
import asyncio
import json
import statistics
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from app.main import app
from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.models import User, Space, Membership, Memory, Media
from datetime import date


async def main():
    if make_url(settings.DATABASE_URL).host not in ("localhost", "127.0.0.1", "::1"):
        raise RuntimeError("Audit probe refuses non-local database")
    engine = create_async_engine(settings.DATABASE_URL)
    sql = []
    @event.listens_for(engine.sync_engine, "before_cursor_execute")
    def before(conn, cursor, statement, parameters, context, executemany):
        context.audit_start = time.perf_counter()
    @event.listens_for(engine.sync_engine, "after_cursor_execute")
    def after(conn, cursor, statement, parameters, context, executemany):
        sql.append({"verb": statement.split()[0], "ms": (time.perf_counter()-context.audit_start)*1000})

    schema = "omlu_audit_" + uuid.uuid4().hex
    results = []
    async with engine.connect() as connection:
        outer = await connection.begin()
        try:
            await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
            await connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            await connection.run_sync(Base.metadata.create_all)
            async with AsyncSession(bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint") as session:
                user = User(email="audit@example.invalid", username="audit", display_name="Audit", password_hash="unused")
                session.add(user)
                await session.flush()
                space = Space(name="Audit only", owner_id=user.id, invite_code=uuid.uuid4().hex)
                session.add(space)
                await session.flush()
                session.add(Membership(user_id=user.id, space_id=space.id, role="owner"))
                await session.commit()
                user_id, space_id = user.id, space.id

            async def db_override():
                async with AsyncSession(bind=connection, expire_on_commit=False, autoflush=False, join_transaction_mode="create_savepoint") as session:
                    yield session
                    await session.commit()
            app.dependency_overrides[get_db] = db_override
            token = create_access_token({"sub": str(user_id)})
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://audit.local", headers={"Authorization": f"Bearer {token}"}) as client:
                async def request(label, method, path, payload=None):
                    sql.clear()
                    start = time.perf_counter()
                    response = await client.request(method, path, json=payload)
                    elapsed = (time.perf_counter()-start)*1000
                    response.raise_for_status()
                    results.append({"stage":label,"ms":round(elapsed,3),"status":response.status_code,"selects":sum(q["verb"]=="SELECT" for q in sql),"inserts":sum(q["verb"]=="INSERT" for q in sql),"sql_ms":round(sum(q["ms"] for q in sql),3)})
                    return response.json()
                for _ in range(5):
                    await request("signature", "POST", "/api/v1/media/cloudinary-sign", {"purpose":"memory","space_id":str(space_id)})
                payload = {"space_id":str(space_id),"media_items":[{"cloudinary_public_id":"audit/not_uploaded","secure_url":"https://example.invalid/not-uploaded.jpg","format":"jpg","width":1920,"height":1080,"bytes":123456}]}
                ids = []
                for _ in range(5):
                    out = await request("create", "POST", "/api/v1/memories", payload)
                    ids.append(out["id"])
                for _ in range(3):
                    await request("space_feed_5", "GET", f"/api/v1/memories/space/{space_id}")
                async with AsyncSession(bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint") as session:
                    for _ in range(95):
                        memory = Memory(author_id=user_id, space_id=space_id, memory_date=date.today())
                        session.add(memory)
                        await session.flush()
                        session.add(Media(memory_id=memory.id, cloudinary_public_id="audit/not_uploaded", secure_url="https://example.invalid/not-uploaded.jpg", width=1920, height=1080))
                    await session.commit()
                for _ in range(3):
                    await request("space_feed_100", "GET", f"/api/v1/memories/space/{space_id}")
                    await request("home_feed_50", "GET", "/api/v1/memories/feed")
                await request("space_details", "GET", f"/api/v1/spaces/{space_id}")
                await request("space_members", "GET", f"/api/v1/spaces/{space_id}/members")
                duplicate_ids = len(set(ids))
        finally:
            app.dependency_overrides.pop(get_db, None)
            await outer.rollback()
        exists = await connection.scalar(text("SELECT count(*) FROM pg_namespace WHERE nspname=:name"), {"name":schema})
        assert exists == 0, "Audit schema unexpectedly persisted"
    await engine.dispose()
    summary = {}
    for stage in dict.fromkeys(r["stage"] for r in results):
        rows = [r for r in results if r["stage"] == stage]
        summary[stage] = {"n":len(rows),"median_ms":round(statistics.median(r["ms"] for r in rows),3),"min_ms":min(r["ms"] for r in rows),"max_ms":max(r["ms"] for r in rows),"selects":rows[0]["selects"],"inserts":rows[0]["inserts"]}
    output = {"scope":"Local ASGI + real PostgreSQL isolated transactional schema. No network upload. Commit uses savepoints, not durable fsync.","schema_rolled_back":True,"identical_create_requests":5,"distinct_memory_ids":duplicate_ids,"summary":summary,"samples":results}
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
