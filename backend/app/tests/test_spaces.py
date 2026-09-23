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
async def test_space_lifecycle_and_invite(client: AsyncClient):
    owner, owner_token = await create_user(client, "alice")
    headers = {"Authorization": f"Bearer {owner_token}"}

    # 1. Create Space
    res_space = await client.post("/api/v1/spaces", json={
        "name": "Hostel 4 Squad",
        "description": "Memories from 2024-2028"
    }, headers=headers)
    assert res_space.status_code == 201
    space = res_space.json()
    assert space["name"] == "Hostel 4 Squad"
    assert space["is_owner"] is True
    assert space["members_count"] == 1
    assert "invite_code" in space
    invite_code = space["invite_code"]
    space_id = space["id"]

    # 2. Preview invite (public or unauthenticated)
    res_preview = await client.get(f"/api/v1/spaces/join/{invite_code}")
    assert res_preview.status_code == 200
    preview = res_preview.json()
    assert preview["name"] == "Hostel 4 Squad"
    assert preview["members_count"] == 1
    assert preview["is_member"] is False

    # 3. User Bob joins via invite
    bob, bob_token = await create_user(client, "bob")
    bob_headers = {"Authorization": f"Bearer {bob_token}"}

    res_join = await client.post(f"/api/v1/spaces/join/{invite_code}", headers=bob_headers)
    assert res_join.status_code == 200
    joined = res_join.json()
    assert joined["id"] == space_id
    assert joined["is_owner"] is False
    assert joined["members_count"] == 2

    # 4. Duplicate join returns gracefully
    res_dup_join = await client.post(f"/api/v1/spaces/join/{invite_code}", headers=bob_headers)
    assert res_dup_join.status_code == 200
    assert res_dup_join.json()["members_count"] == 2

    # 5. List members
    res_members = await client.get(f"/api/v1/spaces/{space_id}/members", headers=headers)
    assert res_members.status_code == 200
    members = res_members.json()
    assert len(members) == 2
    roles = {m["username"]: m["role"] for m in members}
    assert roles[owner["username"]] == "owner"
    assert roles[bob["username"]] == "member"

    # 6. Non-member cannot view members
    charlie, charlie_token = await create_user(client, "charlie")
    res_unauth = await client.get(f"/api/v1/spaces/{space_id}/members", headers={"Authorization": f"Bearer {charlie_token}"})
    assert res_unauth.status_code == 403

    # 7. Owner can remove Bob
    res_remove = await client.delete(f"/api/v1/spaces/{space_id}/members/{bob['id']}", headers=headers)
    assert res_remove.status_code == 200
    assert res_remove.json()["status"] == "removed"

    # 8. Bob is no longer a member
    res_bob_check = await client.get(f"/api/v1/spaces/{space_id}", headers=bob_headers)
    assert res_bob_check.status_code == 403
