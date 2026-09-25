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
async def test_strict_private_space_and_profile_privacy(client: AsyncClient):
    user_a, token_a = await create_user(client, "alice_priv")
    user_b, token_b = await create_user(client, "bob_priv")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 1. User A creates private Space A
    res_sa = await client.post("/api/v1/spaces", json={"name": "Secret Squad A"}, headers=headers_a)
    space_a_id = res_sa.json()["id"]

    # 2. User A posts Memory MA in Space A
    res_ma = await client.post("/api/v1/memories", json={
        "space_id": space_a_id,
        "caption": "Secret memory A",
        "memory_date": "2026-09-01",
        "media_items": [{
            "cloudinary_public_id": "omlu/spaces/sec_a",
            "secure_url": "https://res.cloudinary.com/demo/image/upload/sec_a.jpg",
            "position": 0
        }]
    }, headers=headers_a)
    mem_a_id = res_ma.json()["id"]

    # 3. User B (not in Space A) tries to access Space A -> 403 Forbidden
    res_b_space = await client.get(f"/api/v1/spaces/{space_a_id}", headers=headers_b)
    assert res_b_space.status_code == 403

    # 4. User B tries to fetch memories of Space A -> 403 Forbidden
    res_b_mems = await client.get(f"/api/v1/memories/space/{space_a_id}", headers=headers_b)
    assert res_b_mems.status_code == 403

    # 5. User B tries to fetch direct Memory MA -> 403 Forbidden
    res_b_direct = await client.get(f"/api/v1/memories/{mem_a_id}", headers=headers_b)
    assert res_b_direct.status_code == 403

    # 6. CRITICAL PRIVACY RULE: User B visits User A's profile
    # User B must see ZERO memories because they share no spaces!
    res_b_profile_mems = await client.get(f"/api/v1/memories/user/{user_a['id']}", headers=headers_b)
    assert res_b_profile_mems.status_code == 200
    assert len(res_b_profile_mems.json()) == 0

    # User B checks User A's profile card -> count shows 0 shared memories
    res_b_profile = await client.get(f"/api/v1/users/@{user_a['username']}", headers=headers_b)
    assert res_b_profile.status_code == 200
    assert res_b_profile.json()["memories_count"] == 0

    # 7. User A creates Shared Space C and invites User B
    res_sc = await client.post("/api/v1/spaces", json={"name": "Shared Trip C"}, headers=headers_a)
    space_c = res_sc.json()
    invite_c = space_c["invite_code"]

    res_join_c = await client.post(f"/api/v1/spaces/join/{invite_c}", headers=headers_b)
    assert res_join_c.status_code == 200

    # User A posts Memory MC in Shared Space C
    res_mc = await client.post("/api/v1/memories", json={
        "space_id": space_c["id"],
        "caption": "Shared campfire memory C",
        "memory_date": "2026-09-15",
        "media_items": [{
            "cloudinary_public_id": "omlu/spaces/shared_c",
            "secure_url": "https://res.cloudinary.com/demo/image/upload/shared_c.jpg",
            "position": 0
        }]
    }, headers=headers_a)
    assert res_mc.status_code == 201
    mem_c_id = res_mc.json()["id"]

    # Private contributions stay inside Spaces even for shared members and self.
    for headers in [headers_a, headers_b, {}]:
        profile = await client.get(f"/api/v1/memories/user/{user_a['id']}", headers=headers)
        assert profile.status_code == 200
        assert profile.json() == []
    assert (await client.get(f"/api/v1/memories/{mem_c_id}", headers=headers_b)).status_code == 200
