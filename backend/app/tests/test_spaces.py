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


@pytest.mark.asyncio
async def test_list_my_spaces(client: AsyncClient):
    """
    Regression test for GET /api/v1/spaces.
    Ensures that the list endpoint correctly returns all spaces the
    authenticated user belongs to — caught by removing the broken window
    function from the original list_my_spaces query.
    """
    owner, owner_token = await create_user(client, "list_owner")
    member, member_token = await create_user(client, "list_member")
    outsider, outsider_token = await create_user(client, "list_outsider")

    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}
    outsider_headers = {"Authorization": f"Bearer {outsider_token}"}

    # Owner creates two spaces
    res_s1 = await client.post("/api/v1/spaces", json={"name": "Space Alpha"}, headers=owner_headers)
    assert res_s1.status_code == 201
    space1 = res_s1.json()

    res_s2 = await client.post("/api/v1/spaces", json={"name": "Space Beta"}, headers=owner_headers)
    assert res_s2.status_code == 201
    space2 = res_s2.json()

    # Owner's list must include both spaces immediately after creation
    res_owner_list = await client.get("/api/v1/spaces", headers=owner_headers)
    assert res_owner_list.status_code == 200
    owner_spaces = res_owner_list.json()
    assert len(owner_spaces) == 2
    owner_space_ids = {s["id"] for s in owner_spaces}
    assert space1["id"] in owner_space_ids
    assert space2["id"] in owner_space_ids
    for s in owner_spaces:
        assert s["is_member"] is True
        assert s["is_owner"] is True

    # Member joins Space Alpha via invite
    res_join = await client.post(f"/api/v1/spaces/join/{space1['invite_code']}", headers=member_headers)
    assert res_join.status_code == 200

    # Member's list must contain only Space Alpha
    res_member_list = await client.get("/api/v1/spaces", headers=member_headers)
    assert res_member_list.status_code == 200
    member_spaces = res_member_list.json()
    assert len(member_spaces) == 1
    assert member_spaces[0]["id"] == space1["id"]
    assert member_spaces[0]["is_member"] is True
    assert member_spaces[0]["is_owner"] is False

    # Outsider (no memberships) must get an empty list
    res_outsider_list = await client.get("/api/v1/spaces", headers=outsider_headers)
    assert res_outsider_list.status_code == 200
    assert res_outsider_list.json() == []
