import pytest
import uuid
from httpx import AsyncClient

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
async def test_memory_creation_and_cloudinary_signing(client: AsyncClient):
    alice, alice_token = await create_user(client, "alice_mem")
    bob, bob_token = await create_user(client, "bob_mem")
    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    bob_headers = {"Authorization": f"Bearer {bob_token}"}

    # 1. Alice creates space
    res_space = await client.post("/api/v1/spaces", json={"name": "Goa Trip 2026"}, headers=alice_headers)
    space_id = res_space.json()["id"]

    # 2. Bob (not yet a member) tries to get Cloudinary upload signature -> 403 Forbidden
    res_unauth_sign = await client.post("/api/v1/media/cloudinary-sign", json={
        "purpose": "memory",
        "space_id": space_id
    }, headers=bob_headers)
    assert res_unauth_sign.status_code == 403

    # 3. Alice gets Cloudinary upload signature -> Success
    res_sign = await client.post("/api/v1/media/cloudinary-sign", json={
        "purpose": "memory",
        "space_id": space_id
    }, headers=alice_headers)
    assert res_sign.status_code == 200
    sign_data = res_sign.json()
    assert "signature" in sign_data
    assert "timestamp" in sign_data
    assert "api_key" in sign_data
    assert "upload_url" in sign_data
    assert f"omlu/spaces/{space_id}/memories" in sign_data["folder"]

    # 4. Bob tries to sign space_cover -> 403 Forbidden
    res_cover_unauth = await client.post("/api/v1/media/cloudinary-sign", json={
        "purpose": "space_cover",
        "space_id": space_id
    }, headers=bob_headers)
    assert res_cover_unauth.status_code == 403

    # 5. Alice posts memory with 2 photos
    res_mem = await client.post("/api/v1/memories", json={
        "space_id": space_id,
        "caption": "Sunset at Anjuna beach!",
        "memory_date": "2026-09-20",
        "media_items": [
            {
                "cloudinary_public_id": "omlu/spaces/sample1",
                "secure_url": "https://res.cloudinary.com/demo/image/upload/sample1.jpg",
                "resource_type": "image",
                "format": "jpg",
                "width": 1920,
                "height": 1080,
                "position": 0
            },
            {
                "cloudinary_public_id": "omlu/spaces/sample2",
                "secure_url": "https://res.cloudinary.com/demo/image/upload/sample2.jpg",
                "resource_type": "image",
                "format": "jpg",
                "width": 1080,
                "height": 1080,
                "position": 1
            }
        ]
    }, headers=alice_headers)
    assert res_mem.status_code == 201
    memory = res_mem.json()
    assert memory["caption"] == "Sunset at Anjuna beach!"
    assert len(memory["media_items"]) == 2
    assert memory["likes_count"] == 0
    assert memory["is_liked_by_me"] is False
    memory_id = memory["id"]

    # 6. Alice checks Home Feed
    res_feed = await client.get("/api/v1/memories/feed", headers=alice_headers)
    assert res_feed.status_code == 200
    feed_items = res_feed.json()
    assert len(feed_items) >= 1
    assert feed_items[0]["id"] == memory_id

    # 7. Alice checks Space Feed
    res_space_feed = await client.get(f"/api/v1/memories/space/{space_id}", headers=alice_headers)
    assert res_space_feed.status_code == 200
    assert len(res_space_feed.json()) >= 1

    # 8. Liking memory
    res_like = await client.post(f"/api/v1/memories/{memory_id}/like", headers=alice_headers)
    assert res_like.status_code == 200
    assert res_like.json()["is_liked"] is True
    assert res_like.json()["likes_count"] == 1

    # Toggling like removes it
    res_unlike = await client.post(f"/api/v1/memories/{memory_id}/like", headers=alice_headers)
    assert res_unlike.status_code == 200
    assert res_unlike.json()["is_liked"] is False
    assert res_unlike.json()["likes_count"] == 0

    # 9. Adding comment
    res_comment = await client.post(f"/api/v1/memories/{memory_id}/comments", json={
        "body": "What a stunning view!"
    }, headers=alice_headers)
    assert res_comment.status_code == 201
    comment = res_comment.json()
    assert comment["body"] == "What a stunning view!"
    comment_id = comment["id"]

    # Listing comments
    res_comments_list = await client.get(f"/api/v1/memories/{memory_id}/comments", headers=alice_headers)
    assert res_comments_list.status_code == 200
    assert len(res_comments_list.json()) == 1

    # Deleting comment
    res_del_comment = await client.delete(f"/api/v1/memories/{memory_id}/comments/{comment_id}", headers=alice_headers)
    assert res_del_comment.status_code == 200

    # 10. Deleting memory
    res_del_mem = await client.delete(f"/api/v1/memories/{memory_id}", headers=alice_headers)
    assert res_del_mem.status_code == 200
    assert res_del_mem.json()["status"] == "deleted"
