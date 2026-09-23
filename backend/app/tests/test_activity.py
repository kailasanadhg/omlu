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
async def test_activity_notifications(client: AsyncClient):
    alice, alice_token = await create_user(client, "alice_act")
    bob, bob_token = await create_user(client, "bob_act")
    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    bob_headers = {"Authorization": f"Bearer {bob_token}"}

    # Alice creates space
    res_space = await client.post("/api/v1/spaces", json={"name": "Activity Test Space"}, headers=alice_headers)
    space = res_space.json()

    # Bob joins via invite
    await client.post(f"/api/v1/spaces/join/{space['invite_code']}", headers=bob_headers)

    # Alice posts memory
    res_mem = await client.post("/api/v1/memories", json={
        "space_id": space["id"],
        "caption": "Photo for notifications",
        "memory_date": "2026-09-24",
        "media_items": [{
            "cloudinary_public_id": "test_public_id",
            "secure_url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
            "position": 0
        }]
    }, headers=alice_headers)
    mem_id = res_mem.json()["id"]

    # Bob likes Alice's memory
    await client.post(f"/api/v1/memories/{mem_id}/like", headers=bob_headers)

    # Bob comments on Alice's memory
    await client.post(f"/api/v1/memories/{mem_id}/comments", json={"body": "Great shot!"}, headers=bob_headers)

    # Alice checks activity
    res_act = await client.get("/api/v1/activity", headers=alice_headers)
    assert res_act.status_code == 200
    activities = res_act.json()
    assert len(activities) >= 2
    types = [a["type"] for a in activities]
    assert "like" in types
    assert "comment" in types
    assert any(a["actor_username"] == bob["username"] for a in activities)
