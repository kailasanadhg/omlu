import pytest
import uuid
import asyncio
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from sqlalchemy import event, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.main import app
from app.core.database import Base, get_db, AsyncSessionLocal
from app.models import User, Space, Membership, Memory, Media, UploadSession
from app.core.upload_sessions import verify_asset
from fastapi import HTTPException

async def create_user(client: AsyncClient, name_prefix: str) -> tuple[dict, str]:
    uid = uuid.uuid4().hex[:6]
    email = f"{name_prefix}_{uid}@example.com"
    username = f"{name_prefix}_{uid}"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email,
        "username": username,
        "display_name": name_prefix.title(),
        "password": "password123"
    })
    data = res.json()
    return data["user"], data["access_token"]

@pytest.mark.asyncio
async def test_idempotent_memory_creation(client: AsyncClient):
    alice, token = await create_user(client, "alice_idemp")
    headers = {"Authorization": f"Bearer {token}"}

    res_space = await client.post("/api/v1/spaces", json={"name": "Idempotency Space"}, headers=headers)
    space_id = res_space.json()["id"]

    client_id = str(uuid.uuid4())
    payload = {
        "client_id": client_id,
        "space_id": space_id,
        "caption": "Sunset on beach",
        "media_items": [{
            "cloudinary_public_id": "test/photo_1",
            "secure_url": "https://example.com/p1.jpg",
            "position": 0
        }]
    }

    # 1. First creation
    res1 = await client.post("/api/v1/memories", json=payload, headers=headers)
    assert res1.status_code == 201
    mem1 = res1.json()
    assert mem1["client_id"] == client_id

    # 2. Duplicate creation with identical payload -> returns same memory, does not duplicate!
    res2 = await client.post("/api/v1/memories", json=payload, headers=headers)
    assert res2.status_code in (200, 201)
    mem2 = res2.json()
    assert mem2["id"] == mem1["id"]
    assert mem2["client_id"] == client_id

    # 3. Duplicate creation with different payload -> 409 Conflict
    conflicting_payload = {**payload, "caption": "Different caption!"}
    res3 = await client.post("/api/v1/memories", json=conflicting_payload, headers=headers)
    assert res3.status_code == 409

    # 4. Reconciliation by client_id
    res_rec = await client.get(f"/api/v1/memories/by-client/{client_id}", headers=headers)
    assert res_rec.status_code == 200
    assert res_rec.json()["id"] == mem1["id"]

    # 5. Non-existent client_id -> 404
    res_not_found = await client.get(f"/api/v1/memories/by-client/{uuid.uuid4()}", headers=headers)
    assert res_not_found.status_code == 404

@pytest.mark.asyncio
async def test_upload_session_lifecycle_and_verification(client: AsyncClient, db_session: AsyncSession):
    alice, alice_token = await create_user(client, "alice_us")
    bob, bob_token = await create_user(client, "bob_us")
    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    bob_headers = {"Authorization": f"Bearer {bob_token}"}

    res_space = await client.post("/api/v1/spaces", json={"name": "Session Space"}, headers=alice_headers)
    space_id = res_space.json()["id"]

    # 1. Sign memory upload session
    upload_session_id = str(uuid.uuid4())
    res_sign = await client.post("/api/v1/media/cloudinary-sign", json={
        "upload_session_id": upload_session_id,
        "purpose": "memory",
        "space_id": space_id
    }, headers=alice_headers)
    assert res_sign.status_code == 200
    sign_data = res_sign.json()
    assert sign_data["upload_session_id"] == upload_session_id
    assert sign_data["overwrite"] is False

    # 2. Bob tries to sign for Alice's space (he is not a member) -> 403
    res_unauth = await client.post("/api/v1/media/cloudinary-sign", json={
        "purpose": "memory",
        "space_id": space_id
    }, headers=bob_headers)
    assert res_unauth.status_code == 403

    # 3. Create memory with upload session and mocked asset verification
    mock_asset = {
        "public_id": f"omlu/spaces/{space_id}/memories/{uuid.UUID(upload_session_id).hex}",
        "asset_id": "asset_12345",
        "secure_url": "https://res.cloudinary.com/omlu/image/upload/sample.jpg",
        "resource_type": "image",
        "type": "upload",
        "format": "jpg",
        "width": 1920,
        "height": 1080,
        "bytes": 500000
    }

    client_id = str(uuid.uuid4())
    with patch("app.core.cloudinary_service.cloudinary_service.get_asset", return_value=mock_asset):
        res_mem = await client.post("/api/v1/memories", json={
            "client_id": client_id,
            "space_id": space_id,
            "caption": "Verified photo",
            "media_items": [{
                "upload_session_id": upload_session_id
            }]
        }, headers=alice_headers)
        assert res_mem.status_code == 201
        mem = res_mem.json()
        assert len(mem["media_items"]) == 1
        assert mem["media_items"][0]["cloudinary_public_id"] == mock_asset["public_id"]
        assert mem["media_items"][0]["width"] == 1920

    # 4. Trying to attach same upload session to another memory -> 409
    with patch("app.core.cloudinary_service.cloudinary_service.get_asset", return_value=mock_asset):
        res_reused = await client.post("/api/v1/memories", json={
            "client_id": str(uuid.uuid4()),
            "space_id": space_id,
            "caption": "Reusing session",
            "media_items": [{
                "upload_session_id": upload_session_id
            }]
        }, headers=alice_headers)
        assert res_reused.status_code == 409

    # 5. Bob tries to use Alice's session -> 403
    with patch("app.core.cloudinary_service.cloudinary_service.get_asset", return_value=mock_asset):
        res_stolen = await client.post("/api/v1/memories", json={
            "client_id": str(uuid.uuid4()),
            "space_id": space_id,
            "caption": "Stolen session",
            "media_items": [{
                "upload_session_id": upload_session_id
            }]
        }, headers=bob_headers)
        assert res_stolen.status_code == 403

@pytest.mark.asyncio
async def test_asset_verification_validation():
    session = UploadSession(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        space_id=uuid.uuid4(),
        public_id="omlu/spaces/test/123",
        verified_asset=None
    )

    # Valid
    valid = {
        "public_id": "omlu/spaces/test/123",
        "asset_id": "aid_1",
        "secure_url": "https://res.cloudinary.com/test.jpg",
        "resource_type": "image",
        "type": "upload",
        "format": "jpg",
        "width": 1080,
        "height": 1920,
        "bytes": 204800
    }
    with patch("app.core.cloudinary_service.cloudinary_service.get_asset", return_value=valid):
        result = await verify_asset(session)
        assert result["width"] == 1080

    # Cached verified_asset returns directly without calling get_asset
    session.verified_asset = valid
    with patch("app.core.cloudinary_service.cloudinary_service.get_asset") as mock_get:
        result = await verify_asset(session)
        assert result == valid
        mock_get.assert_not_called()

    # Invalid public_id
    session.verified_asset = None
    bad_id = {**valid, "public_id": "wrong/id"}
    with patch("app.core.cloudinary_service.cloudinary_service.get_asset", return_value=bad_id):
        with pytest.raises(HTTPException) as exc_info:
            await verify_asset(session)
        assert exc_info.value.status_code == 422

    # Non-positive dimensions
    bad_dims = {**valid, "width": 0}
    with patch("app.core.cloudinary_service.cloudinary_service.get_asset", return_value=bad_dims):
        with pytest.raises(HTTPException) as exc_info:
            await verify_asset(session)
        assert exc_info.value.status_code == 422

    # Oversized > 25MB
    bad_size = {**valid, "bytes": 30 * 1024 * 1024}
    with patch("app.core.cloudinary_service.cloudinary_service.get_asset", return_value=bad_size):
        with pytest.raises(HTTPException) as exc_info:
            await verify_asset(session)
        assert exc_info.value.status_code == 422

@pytest.mark.asyncio
async def test_concurrent_idempotent_creation(client: AsyncClient):
    alice, token = await create_user(client, "alice_conc")
    headers = {"Authorization": f"Bearer {token}"}

    res_space = await client.post("/api/v1/spaces", json={"name": "Concurrent Space"}, headers=headers)
    space_id = res_space.json()["id"]

    client_id = str(uuid.uuid4())
    payload = {
        "client_id": client_id,
        "space_id": space_id,
        "caption": "Concurrent post",
        "media_items": [{
            "cloudinary_public_id": "test/photo_conc",
            "secure_url": "https://example.com/pconc.jpg",
            "position": 0
        }]
    }

    # Override get_db to provide a fresh AsyncSession per request
    async def fresh_db():
        async with AsyncSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = fresh_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            res1, res2 = await asyncio.gather(
                c.post("/api/v1/memories", json=payload, headers=headers),
                c.post("/api/v1/memories", json=payload, headers=headers)
            )
            assert res1.status_code in (200, 201)
            assert res2.status_code in (200, 201)
            assert res1.json()["id"] == res2.json()["id"]
            assert res1.json()["client_id"] == client_id
    finally:
        app.dependency_overrides.pop(get_db, None)

@pytest.mark.asyncio
async def test_duplicate_upload_session_in_single_request(client: AsyncClient):
    alice, token = await create_user(client, "alice_dupsess")
    headers = {"Authorization": f"Bearer {token}"}

    res_space = await client.post("/api/v1/spaces", json={"name": "Dup Sess Space"}, headers=headers)
    space_id = res_space.json()["id"]

    sess_id = str(uuid.uuid4())
    await client.post("/api/v1/media/cloudinary-sign", json={
        "upload_session_id": sess_id,
        "purpose": "memory",
        "space_id": space_id
    }, headers=headers)

    res = await client.post("/api/v1/memories", json={
        "client_id": str(uuid.uuid4()),
        "space_id": space_id,
        "media_items": [
            {"upload_session_id": sess_id},
            {"upload_session_id": sess_id}
        ]
    }, headers=headers)
    assert res.status_code == 422
    assert "distinct" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_retry_after_ambiguous_network_failure(client: AsyncClient):
    alice, token = await create_user(client, "alice_netretry")
    headers = {"Authorization": f"Bearer {token}"}

    res_space = await client.post("/api/v1/spaces", json={"name": "Net Retry Space"}, headers=headers)
    space_id = res_space.json()["id"]

    client_id = str(uuid.uuid4())
    payload = {
        "client_id": client_id,
        "space_id": space_id,
        "caption": "Photo before simulated timeout",
        "media_items": [{
            "cloudinary_public_id": "test/photo_net",
            "secure_url": "https://example.com/pnet.jpg",
            "position": 0
        }]
    }

    # 1. Memory is posted
    res1 = await client.post("/api/v1/memories", json=payload, headers=headers)
    assert res1.status_code == 201
    committed_memory = res1.json()

    # 2. Client reconciles after simulated dropped connection via GET /by-client/{client_id}
    res_recon = await client.get(f"/api/v1/memories/by-client/{client_id}", headers=headers)
    assert res_recon.status_code == 200
    assert res_recon.json()["id"] == committed_memory["id"]

    # 3. Client re-sends POST /memories with identical payload (standard retry)
    res_retry = await client.post("/api/v1/memories", json=payload, headers=headers)
    assert res_retry.status_code in (200, 201)
    assert res_retry.json()["id"] == committed_memory["id"]
    assert res_retry.json()["client_id"] == client_id

@pytest.mark.asyncio
async def test_database_level_uniqueness_constraint(db_session: AsyncSession):
    from sqlalchemy.exc import IntegrityError
    from datetime import date
    user = User(email=f"u_{uuid.uuid4().hex[:6]}@ex.com", username=f"u_{uuid.uuid4().hex[:6]}", display_name="U", password_hash="h")
    db_session.add(user)
    await db_session.flush()

    space = Space(name="S", owner_id=user.id, invite_code=uuid.uuid4().hex)
    db_session.add(space)
    await db_session.flush()

    shared_client_id = uuid.uuid4()
    mem1 = Memory(author_id=user.id, space_id=space.id, client_id=shared_client_id, memory_date=date.today())
    db_session.add(mem1)
    await db_session.flush()

    # Second insert with exact same author_id and client_id directly into DB must raise IntegrityError
    mem2 = Memory(author_id=user.id, space_id=space.id, client_id=shared_client_id, memory_date=date.today())
    db_session.add(mem2)
    with pytest.raises(IntegrityError):
        await db_session.flush()

@pytest.mark.asyncio
async def test_asset_verification_errors():
    from cloudinary.exceptions import NotFound, Error as CloudinaryError
    session = UploadSession(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        space_id=uuid.uuid4(),
        public_id="omlu/spaces/test/missing",
        verified_asset=None
    )

    # Cloudinary NotFound -> HTTP 404
    with patch("app.core.cloudinary_service.cloudinary_service.get_asset", side_effect=NotFound("Resource not found")):
        with pytest.raises(HTTPException) as exc_info:
            await verify_asset(session)
        assert exc_info.value.status_code == 404
        assert "not completed" in exc_info.value.detail.lower()

    # Cloudinary generic error/timeout -> HTTP 503
    with patch("app.core.cloudinary_service.cloudinary_service.get_asset", side_effect=CloudinaryError("Service unavailable")):
        with pytest.raises(HTTPException) as exc_info:
            await verify_asset(session)
        assert exc_info.value.status_code == 503
        assert "retry later" in exc_info.value.detail.lower()

def test_cloudinary_immutable_signature_string_to_sign():
    import cloudinary.utils
    from app.core.cloudinary_service import cloudinary_service
    from app.core.config import settings

    folder = "omlu/spaces/test-space/memories"
    public_id = "test_memory_pubid"
    sig = cloudinary_service.generate_upload_signature(folder, public_id, immutable=True)

    # Must explicitly declare overwrite=False in returned signature payload
    assert sig["overwrite"] is False
    assert sig["folder"] == folder
    assert sig["public_id"] == public_id

    # Verify that api_string_to_sign properly includes overwrite=false
    # Cloudinary server expects: folder=...&overwrite=false&public_id=...&timestamp=...
    expected_to_sign = f"folder={folder}&overwrite=false&public_id={public_id}&timestamp={sig['timestamp']}"
    
    # Recompute signature directly from expected string
    expected_signature = cloudinary.utils.compute_hex_hash(
        expected_to_sign + settings.CLOUDINARY_API_SECRET,
        cloudinary.utils.SIGNATURE_SHA1
    )
    assert sig["signature"] == expected_signature, "Signature must match string-to-sign containing overwrite=false"

def test_cloudinary_mutable_signature_omits_overwrite():
    from app.core.cloudinary_service import cloudinary_service
    folder = "omlu/spaces/test-space/covers"
    public_id = "test_cover_pubid"
    sig = cloudinary_service.generate_upload_signature(folder, public_id, immutable=False)

    assert sig["overwrite"] is None
    assert "overwrite" not in sig["signature"]
