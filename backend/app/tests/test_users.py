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
async def test_profile_photo_persistence_and_propagation(client: AsyncClient):
    """
    Verifies the complete profile photo data flow:
    1. Update avatar URL via PATCH /users/me/profile
    2. Persists to database and appears in GET /auth/me
    3. Appears in public profile GET /users/@username
    4. Appears in Space member list GET /spaces/{id}/members
    5. Appears as author_avatar_url in GET /memories/feed
    6. Appears as author_avatar_url in GET /memories/{id}/comments
    7. Partial profile update (e.g. bio) preserves existing avatar
    8. Setting avatar_url to None properly removes it
    """
    user, token = await create_user(client, "photouser")
    headers = {"Authorization": f"Bearer {token}"}
    sample_avatar = "https://res.cloudinary.com/omlu/image/upload/v12345/omlu/users/avatar123.jpg"

    # 1. Update avatar
    res_patch = await client.patch("/api/v1/users/me/profile", json={
        "avatar_url": sample_avatar
    }, headers=headers)
    assert res_patch.status_code == 200
    patched = res_patch.json()
    assert patched["avatar_url"] == sample_avatar

    # 2. Check /auth/me returns persisted avatar_url
    res_me = await client.get("/api/v1/auth/me", headers=headers)
    assert res_me.status_code == 200
    assert res_me.json()["avatar_url"] == sample_avatar

    # 3. Check public profile /users/@username returns avatar_url
    res_prof = await client.get(f"/api/v1/users/@{user['username']}", headers=headers)
    assert res_prof.status_code == 200
    assert res_prof.json()["avatar_url"] == sample_avatar

    # 4. Create a space and verify member list has avatar_url
    res_space = await client.post("/api/v1/spaces", json={"name": "Avatar Test Space"}, headers=headers)
    assert res_space.status_code == 201
    space_id = res_space.json()["id"]

    res_members = await client.get(f"/api/v1/spaces/{space_id}/members", headers=headers)
    assert res_members.status_code == 200
    members = res_members.json()
    assert len(members) == 1
    assert members[0]["avatar_url"] == sample_avatar

    # 5. Post a memory and verify author_avatar_url in feed
    res_mem = await client.post("/api/v1/memories", json={
        "space_id": space_id,
        "caption": "Testing avatar propagation",
        "media_items": [{
            "cloudinary_public_id": "test_pub_1",
            "secure_url": "https://res.cloudinary.com/test/img1.jpg",
            "position": 0
        }]
    }, headers=headers)
    assert res_mem.status_code == 201
    memory_id = res_mem.json()["id"]
    assert res_mem.json()["author_avatar_url"] == sample_avatar

    res_feed = await client.get("/api/v1/memories/feed", headers=headers)
    assert res_feed.status_code == 200
    feed = res_feed.json()
    assert len(feed) >= 1
    assert feed[0]["author_avatar_url"] == sample_avatar

    # 6. Post a comment and verify author_avatar_url in comments list
    res_comment = await client.post(f"/api/v1/memories/{memory_id}/comments", json={
        "body": "Nice photo!"
    }, headers=headers)
    assert res_comment.status_code == 201
    assert res_comment.json()["author_avatar_url"] == sample_avatar

    res_comments_list = await client.get(f"/api/v1/memories/{memory_id}/comments", headers=headers)
    assert res_comments_list.status_code == 200
    comments = res_comments_list.json()
    assert len(comments) == 1
    assert comments[0]["author_avatar_url"] == sample_avatar

    # 7. Updating display_name or bio preserves avatar_url
    res_update_bio = await client.patch("/api/v1/users/me/profile", json={
        "bio": "Updated bio text"
    }, headers=headers)
    assert res_update_bio.status_code == 200
    assert res_update_bio.json()["avatar_url"] == sample_avatar
    assert res_update_bio.json()["bio"] == "Updated bio text"

    # 8. Setting avatar_url to None removes avatar
    res_remove = await client.patch("/api/v1/users/me/profile", json={
        "avatar_url": None
    }, headers=headers)
    assert res_remove.status_code == 200
    assert res_remove.json()["avatar_url"] is None

    # Verify /auth/me reflects the removed avatar
    res_me_cleared = await client.get("/api/v1/auth/me", headers=headers)
    assert res_me_cleared.status_code == 200
    assert res_me_cleared.json()["avatar_url"] is None
