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
async def test_live_moment_creation_and_notes_flow(client: AsyncClient):
    alice, alice_token = await create_user(client, "alice_notes")
    bob, bob_token = await create_user(client, "bob_notes")
    charlie, charlie_token = await create_user(client, "charlie_notes")

    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    bob_headers = {"Authorization": f"Bearer {bob_token}"}
    charlie_headers = {"Authorization": f"Bearer {charlie_token}"}

    # 1. Alice creates space
    res_space = await client.post("/api/v1/spaces", json={"name": "Hostel 4 B-Wing"}, headers=alice_headers)
    assert res_space.status_code == 201
    space = res_space.json()
    space_id = space["id"]
    invite_code = space["invite_code"]

    # 2. Bob joins space
    res_join = await client.post(f"/api/v1/spaces/join/{invite_code}", headers=bob_headers)
    assert res_join.status_code == 200

    # Charlie does NOT join space.

    # 3. Alice captures a Live Moment (shutter capture: no caption, no memory_date specified)
    res_moment = await client.post("/api/v1/memories", json={
        "space_id": space_id,
        "media_items": [
            {
                "cloudinary_public_id": "omlu/spaces/moment_1",
                "secure_url": "https://res.cloudinary.com/demo/image/upload/moment_1.jpg",
                "resource_type": "image",
                "format": "jpg",
                "width": 1080,
                "height": 1920,
                "position": 0
            }
        ]
    }, headers=alice_headers)
    assert res_moment.status_code == 201
    moment = res_moment.json()
    assert moment["caption"] is None
    assert moment["memory_date"] is not None  # defaulted to today
    assert moment["notes"] == []
    memory_id = moment["id"]

    # 4. Charlie (non-member) tries to add a note -> 403 Forbidden
    res_charlie_note = await client.post(f"/api/v1/memories/{memory_id}/notes", json={
        "body": "I shouldn't be allowed to write here!"
    }, headers=charlie_headers)
    assert res_charlie_note.status_code == 403

    # 5. Bob (member) adds a note
    res_bob_note = await client.post(f"/api/v1/memories/{memory_id}/notes", json={
        "body": "Remember when we laughed at this at 2am?"
    }, headers=bob_headers)
    assert res_bob_note.status_code == 201
    bob_note = res_bob_note.json()
    assert bob_note["body"] == "Remember when we laughed at this at 2am?"
    assert bob_note["author_username"] == bob["username"]
    bob_note_id = bob_note["id"]

    # 6. Alice (space owner + author) adds a note
    res_alice_note = await client.post(f"/api/v1/memories/{memory_id}/notes", json={
        "body": "Best night of college hands down"
    }, headers=alice_headers)
    assert res_alice_note.status_code == 201
    alice_note = res_alice_note.json()
    alice_note_id = alice_note["id"]

    # 7. List notes for the memory
    res_notes = await client.get(f"/api/v1/memories/{memory_id}/notes", headers=bob_headers)
    assert res_notes.status_code == 200
    notes_list = res_notes.json()
    assert len(notes_list) == 2
    assert notes_list[0]["id"] == bob_note_id
    assert notes_list[1]["id"] == alice_note_id

    # 8. Check feed includes notes
    res_feed = await client.get("/api/v1/memories/feed", headers=alice_headers)
    assert res_feed.status_code == 200
    feed_items = res_feed.json()
    found = next((m for m in feed_items if m["id"] == memory_id), None)
    assert found is not None
    assert len(found["notes"]) == 2

    # 9. Bob tries to delete Alice's note -> 403 Forbidden
    res_bob_del = await client.delete(f"/api/v1/memories/{memory_id}/notes/{alice_note_id}", headers=bob_headers)
    assert res_bob_del.status_code == 403

    # 10. Alice (space owner) CAN delete Bob's note (moderation)
    res_alice_del_bob = await client.delete(f"/api/v1/memories/{memory_id}/notes/{bob_note_id}", headers=alice_headers)
    assert res_alice_del_bob.status_code == 200
    assert res_alice_del_bob.json()["status"] == "deleted"

    # 11. Alice deletes her own note
    res_alice_del_own = await client.delete(f"/api/v1/memories/{memory_id}/notes/{alice_note_id}", headers=alice_headers)
    assert res_alice_del_own.status_code == 200

    # 12. Notes list should now be empty
    res_notes_empty = await client.get(f"/api/v1/memories/{memory_id}/notes", headers=bob_headers)
    assert res_notes_empty.status_code == 200
    assert len(res_notes_empty.json()) == 0
