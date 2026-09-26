import uuid
from datetime import datetime, timezone, date
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.space import Space
from app.models.memory import Memory
from app.models.upload_session import UploadSession
from app.core.security import create_access_token

@pytest.mark.asyncio
async def test_guest_uploads_full_flow(client: AsyncClient, db_session: AsyncSession):
    tag = uuid.uuid4().hex[:6]
    # 1. Create owner user & space
    res_owner = await client.post("/api/v1/auth/signup", json={
        "email": f"owner_{tag}@test.com",
        "username": f"owner_{tag}",
        "display_name": "Space Owner",
        "password": "password123"
    })
    assert res_owner.status_code == 201
    token = res_owner.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res_create = await client.post("/api/v1/spaces", json={"name": "UKFCET 2026 Batch"}, headers=headers)
    assert res_create.status_code == 201
    space_data = res_create.json()
    space_id = space_data["id"]
    assert space_data["guest_uploads_enabled"] is False
    assert space_data["guest_token"] is None

    # 2. Guest preview when OFF -> returns 404 (no token exists yet)
    res_preview_off = await client.get("/api/v1/spaces/guest/randomtoken123")
    assert res_preview_off.status_code == 404

    # 3. Owner enables Guest Uploads
    res_toggle = await client.patch(
        f"/api/v1/spaces/{space_id}/guest-settings",
        json={"guest_uploads_enabled": True},
        headers=headers
    )
    assert res_toggle.status_code == 200
    updated_space = res_toggle.json()
    assert updated_space["guest_uploads_enabled"] is True
    guest_token = updated_space["guest_token"]
    assert guest_token is not None
    assert len(guest_token) >= 20

    # 4. Preview guest space with valid token
    res_guest_preview = await client.get(f"/api/v1/spaces/guest/{guest_token}")
    assert res_guest_preview.status_code == 200
    guest_preview = res_guest_preview.json()
    assert guest_preview["name"] == "UKFCET 2026 Batch"
    assert "guest_session_id" in guest_preview
    assert "guest_claim_token" in guest_preview
    guest_session_id = guest_preview["guest_session_id"]
    guest_claim_token = guest_preview["guest_claim_token"]

    # 5. Non-owner cannot change guest settings
    res_other = await client.post("/api/v1/auth/signup", json={
        "email": f"other_{tag}@test.com",
        "username": f"other_{tag}",
        "display_name": "Other User",
        "password": "password123"
    })
    assert res_other.status_code == 201
    other_headers = {"Authorization": f"Bearer {res_other.json()['access_token']}"}

    res_forbidden = await client.patch(
        f"/api/v1/spaces/{space_id}/guest-settings",
        json={"guest_uploads_enabled": False},
        headers=other_headers
    )
    assert res_forbidden.status_code == 403

    # 6. Accountless guest signs upload session
    res_sign = await client.post(
        "/api/v1/media/guest-cloudinary-sign",
        json={"guest_token": guest_token}
    )
    assert res_sign.status_code == 200
    sign_data = res_sign.json()
    upload_session_id = sign_data["upload_session_id"]
    assert upload_session_id is not None
    assert "signature" in sign_data
    assert "timestamp" in sign_data

    # Check that UploadSession in DB is marked is_guest=True, user_id=None, space_id=space_id
    session_obj = await db_session.get(UploadSession, uuid.UUID(upload_session_id))
    assert session_obj.is_guest is True
    assert session_obj.user_id is None
    assert str(session_obj.space_id) == space_id

    # 7. Accountless guest creates memory with valid presentation (e.g. circle)
    res_mem = await client.post(
        "/api/v1/memories/guest",
        json={
            "guest_token": guest_token,
            "client_id": str(uuid.uuid4()),
            "media_items": [
                {
                    "cloudinary_public_id": "guest_sample_public_id",
                    "secure_url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
                    "width": 1000,
                    "height": 1000,
                }
            ],
            "presentation": {
                "display_shape": "circle",
                "crop_x": 0.0,
                "crop_y": 0.0,
                "crop_width": 1.0,
                "crop_height": 1.0,
            },
            "guest_session_id": guest_session_id,
            "guest_claim_token": guest_claim_token,
        }
    )
    assert res_mem.status_code == 201
    mem_data = res_mem.json()
    memory_id = mem_data["id"]
    assert mem_data["is_guest"] is True
    assert mem_data["author_id"] is None
    assert mem_data["author_username"] is None
    assert mem_data["author_display_name"] == "Guest"
    assert mem_data["presentation"]["display_shape"] == "circle"

    # 8. Check that memory appears in Space memories
    res_space_memories = await client.get(f"/api/v1/memories/space/{space_id}", headers=headers)
    assert res_space_memories.status_code == 200
    space_memories = res_space_memories.json()
    assert len(space_memories) == 1
    assert space_memories[0]["id"] == memory_id
    assert space_memories[0]["author_display_name"] == "Guest"
    assert space_memories[0]["can_delete"] is True  # Owner can delete!

    # Non-owner viewing space memories has can_delete=False on guest memory
    res_other_view = await client.get(f"/api/v1/memories/space/{space_id}", headers=other_headers)
    assert res_other_view.status_code == 403  # Private space, other is not member
    # Join other to space or test delete directly
    res_other_delete = await client.delete(f"/api/v1/memories/{memory_id}", headers=other_headers)
    assert res_other_delete.status_code == 403

    # 9. Recent Space Memories: guest memory participates
    res_recent = await client.get("/api/v1/memories/recent-spaces", headers=headers)
    assert res_recent.status_code == 200
    recent_data = res_recent.json()
    recent_ids = [m["id"] for m in recent_data["memories"]]
    assert memory_id in recent_ids

    # 10. Regenerate guest link invalidates old link
    res_regen = await client.post(f"/api/v1/spaces/{space_id}/regenerate-guest-link", headers=headers)
    assert res_regen.status_code == 200
    new_guest_token = res_regen.json()["guest_token"]
    assert new_guest_token != guest_token

    # Old token is now 404
    res_old_token = await client.get(f"/api/v1/spaces/guest/{guest_token}")
    assert res_old_token.status_code == 404

    # Old token upload fails
    res_old_upload = await client.post(
        "/api/v1/media/guest-cloudinary-sign",
        json={"guest_token": guest_token}
    )
    assert res_old_upload.status_code == 404

    # New token works
    res_new_token = await client.get(f"/api/v1/spaces/guest/{new_guest_token}")
    assert res_new_token.status_code == 200

    # 11. Disable Guest Uploads
    await client.patch(
        f"/api/v1/spaces/{space_id}/guest-settings",
        json={"guest_uploads_enabled": False},
        headers=headers
    )
    # Disabled token returns 403
    res_disabled = await client.get(f"/api/v1/spaces/guest/{new_guest_token}")
    assert res_disabled.status_code == 403
    res_disabled_sign = await client.post(
        "/api/v1/media/guest-cloudinary-sign",
        json={"guest_token": new_guest_token}
    )
    assert res_disabled_sign.status_code == 403

    # Existing guest memory remains!
    res_check = await client.get(f"/api/v1/memories/space/{space_id}", headers=headers)
    assert res_check.status_code == 200
    assert len(res_check.json()) == 1

    # 12. Claiming guest memories upon signup
    # Create another guest upload with active token first
    await client.patch(
        f"/api/v1/spaces/{space_id}/guest-settings",
        json={"guest_uploads_enabled": True},
        headers=headers
    )
    active_token = (await client.get(f"/api/v1/spaces/{space_id}", headers=headers)).json()["guest_token"]
    preview2 = (await client.get(f"/api/v1/spaces/guest/{active_token}")).json()
    sess_id = preview2["guest_session_id"]
    claim_tok = preview2["guest_claim_token"]

    res_mem2 = await client.post(
        "/api/v1/memories/guest",
        json={
            "guest_token": active_token,
            "media_items": [
                {
                    "cloudinary_public_id": "guest_mem2_pid",
                    "secure_url": "https://res.cloudinary.com/demo/image/upload/sample2.jpg",
                    "width": 1000,
                    "height": 1000,
                }
            ],
            "presentation": {
                "display_shape": "portrait_3_4",
                "crop_x": 0.125,
                "crop_y": 0.0,
                "crop_width": 0.75,
                "crop_height": 1.0,
            },
            "guest_session_id": sess_id,
            "guest_claim_token": claim_tok,
        }
    )
    assert res_mem2.status_code == 201
    mem2_id = res_mem2.json()["id"]

    # Now guest creates account with session & claim token
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": f"claimedguest_{tag}@test.com",
            "username": f"claimed_{tag}",
            "display_name": "Claimed Guest",
            "password": "password123",
            "guest_session_id": sess_id,
            "guest_claim_token": claim_tok,
        }
    )
    assert signup_res.status_code == 201
    new_user_id = signup_res.json()["user"]["id"]
    new_token = signup_res.json()["access_token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}

    # CRITICAL TEST: Verify memory is privately associated with new user, but STILL publicly Guest!
    mem_db = await db_session.get(Memory, uuid.UUID(mem2_id))
    assert str(mem_db.contributor_user_id) == new_user_id
    assert mem_db.author_id is None
    assert mem_db.is_guest is True

    # Normal space viewers (including the Space Owner) STILL see it as Guest
    res_owner_view = await client.get(f"/api/v1/memories/{mem2_id}", headers=headers)
    assert res_owner_view.status_code == 200
    owner_view_data = res_owner_view.json()
    assert owner_view_data["is_guest"] is True
    assert owner_view_data["author_id"] is None
    assert owner_view_data["author_username"] is None
    assert owner_view_data["author_display_name"] == "Guest"
    assert "claimed_" not in str(owner_view_data)
    assert new_user_id not in str(owner_view_data)

    # Claimed user can privately access their contributions
    res_my_contrib = await client.get("/api/v1/memories/my-contributions", headers=new_headers)
    assert res_my_contrib.status_code == 200
    my_contribs = res_my_contrib.json()
    assert any(m["id"] == mem2_id for m in my_contribs)
    # The claimed contributor has deletion permission on their privately owned memory
    my_mem = next(m for m in my_contribs if m["id"] == mem2_id)
    assert my_mem["can_delete"] is True

    # 13. Test Login Claiming flow (guest uploads -> existing user logs in -> claims memory)
    # Guest uploads memory 3
    from app.core.guest_session import create_guest_session
    sess3_id, sess3_claim = create_guest_session()
    res_mem3 = await client.post(
        "/api/v1/memories/guest",
        json={
            "guest_token": active_token,
            "media_items": [{
                "cloudinary_public_id": "guest_mem3_pid",
                "secure_url": "https://res.cloudinary.com/demo/image/upload/sample3.jpg",
                "width": 800,
                "height": 800,
            }],
            "presentation": {
                "display_shape": "square",
                "crop_x": 0.0, "crop_y": 0.0, "crop_width": 1.0, "crop_height": 1.0,
            },
            "guest_session_id": str(sess3_id),
            "guest_claim_token": sess3_claim,
        }
    )
    assert res_mem3.status_code == 201
    mem3_id = res_mem3.json()["id"]

    # Existing user claims via POST /api/v1/auth/claim-guest
    claim_res = await client.post(
        "/api/v1/auth/claim-guest",
        json={"guest_session_id": str(sess3_id), "guest_claim_token": sess3_claim},
        headers=new_headers
    )
    assert claim_res.status_code == 200
    assert claim_res.json()["claimed_count"] == 1

    # Verify memory 3 is STILL publicly Guest
    mem3_db = await db_session.get(Memory, uuid.UUID(mem3_id))
    assert str(mem3_db.contributor_user_id) == new_user_id
    assert mem3_db.author_id is None
    assert mem3_db.is_guest is True

    res_mem3_view = await client.get(f"/api/v1/memories/{mem3_id}", headers=headers)
    assert res_mem3_view.status_code == 200
    assert res_mem3_view.json()["author_display_name"] == "Guest"
    assert res_mem3_view.json()["author_username"] is None
    assert res_mem3_view.json()["is_guest"] is True

    # 14. Owner deletes first guest memory
    res_delete = await client.delete(f"/api/v1/memories/{memory_id}", headers=headers)
    assert res_delete.status_code == 200
    assert (await db_session.get(Memory, uuid.UUID(memory_id))) is None


@pytest.mark.asyncio
async def test_signed_in_user_contributes_as_guest(client: AsyncClient, db_session: AsyncSession):
    tag = uuid.uuid4().hex[:6]
    # Create owner and space
    res_owner = await client.post("/api/v1/auth/signup", json={
        "email": f"owner_priv_{tag}@test.com", "username": f"own_{tag}", "display_name": "Owner", "password": "password123"
    })
    owner_token = res_owner.json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    res_space = await client.post("/api/v1/spaces", json={"name": "Privacy Space"}, headers=owner_headers)
    space_id = res_space.json()["id"]

    # Enable guest uploads
    res_enable = await client.patch(f"/api/v1/spaces/{space_id}/guest-settings", json={"guest_uploads_enabled": True}, headers=owner_headers)
    guest_token = res_enable.json()["guest_token"]

    # Member user logs in
    res_member = await client.post("/api/v1/auth/signup", json={
        "email": f"member_{tag}@test.com", "username": f"member_{tag}", "display_name": "Alice Member", "password": "password123"
    })
    member_id = res_member.json()["user"]["id"]
    member_token = res_member.json()["access_token"]
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # Member deliberately posts as Guest using space's guest token
    res_post = await client.post(
        "/api/v1/memories/guest",
        json={
            "guest_token": guest_token,
            "media_items": [{
                "cloudinary_public_id": "pid_priv",
                "secure_url": "https://example.test/priv.jpg",
                "width": 800,
                "height": 800
            }],
            "presentation": {
                "display_shape": "square",
                "crop_x": 0.0, "crop_y": 0.0, "crop_width": 1.0, "crop_height": 1.0
            }
        },
        headers=member_headers
    )
    assert res_post.status_code == 201
    mem_out = res_post.json()
    assert mem_out["is_guest"] is True
    assert mem_out["author_id"] is None
    assert mem_out["author_username"] is None
    assert mem_out["author_display_name"] == "Guest"

    # Verify DB has contributor_user_id for audit, but author_id is None
    mem_id = mem_out["id"]
    db_mem = await db_session.get(Memory, uuid.UUID(mem_id))
    assert str(db_mem.contributor_user_id) == member_id
    assert db_mem.author_id is None

    # Owner views space: attribution is strictly "Guest", alice's username is nowhere
    res_view = await client.get(f"/api/v1/memories/space/{space_id}", headers=owner_headers)
    assert res_view.status_code == 200
    view_mem = res_view.json()[0]
    assert view_mem["author_display_name"] == "Guest"
    assert view_mem["author_username"] is None
    assert "Alice" not in str(view_mem)
    assert f"member_{tag}" not in str(view_mem)


@pytest.mark.asyncio
async def test_guest_rate_limiting_and_validation(client: AsyncClient, db_session: AsyncSession):
    tag = uuid.uuid4().hex[:6]
    res_owner = await client.post("/api/v1/auth/signup", json={
        "email": f"owner_rl_{tag}@test.com", "username": f"rl_{tag}", "display_name": "Owner", "password": "password123"
    })
    headers = {"Authorization": f"Bearer {res_owner.json()['access_token']}"}
    res_space = await client.post("/api/v1/spaces", json={"name": "Rate Limit Space"}, headers=headers)
    space_id = res_space.json()["id"]
    res_enable = await client.patch(f"/api/v1/spaces/{space_id}/guest-settings", json={"guest_uploads_enabled": True}, headers=headers)
    guest_token = res_enable.json()["guest_token"]

    # Invalid crop shape mismatch
    res_bad_crop = await client.post(
        "/api/v1/memories/guest",
        json={
            "guest_token": guest_token,
            "media_items": [{"cloudinary_public_id": "pid_bad", "secure_url": "https://example.test/img.jpg", "width": 1000, "height": 1000}],
            "presentation": {
                # 9:16 expects width/height = 9/16, but crop is 1:1
                "display_shape": "portrait_9_16",
                "crop_x": 0.0, "crop_y": 0.0, "crop_width": 1.0, "crop_height": 1.0
            }
        }
    )
    assert res_bad_crop.status_code == 422
    assert "does not match the selected shape" in res_bad_crop.json()["detail"]

    # Rate limiting on signing endpoint
    # Send requests up to limit
    hit_429 = False
    for _ in range(40):
        res = await client.post("/api/v1/media/guest-cloudinary-sign", json={"guest_token": guest_token})
        if res.status_code == 429:
            hit_429 = True
            break
    assert hit_429 is True

