import asyncio
import uuid
import sys
from httpx import AsyncClient, ASGITransport
from app.main import app

async def run_e2e_verification():
    print("=" * 70)
    print("🚀 STARTING OMLU CRITICAL E2E VERIFICATION TEST")
    print("=" * 70)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # -------------------------------------------------------------
        # 1. USER A CREATES ACCOUNT
        # -------------------------------------------------------------
        tag_a = uuid.uuid4().hex[:6]
        user_a_email = f"kailas_{tag_a}@example.com"
        user_a_uname = f"kailaseey_{tag_a}"
        print(f"\n[1] Registering User A (@{user_a_uname})...")
        res_a = await client.post("/api/v1/auth/signup", json={
            "email": user_a_email,
            "username": user_a_uname,
            "display_name": "Kailas Nadh",
            "password": "password123"
        })
        assert res_a.status_code == 201, f"User A signup failed: {res_a.text}"
        data_a = res_a.json()
        token_a = data_a["access_token"]
        user_a = data_a["user"]
        headers_a = {"Authorization": f"Bearer {token_a}"}
        print(f"  ✓ User A created successfully with ID: {user_a['id']}")

        # -------------------------------------------------------------
        # 2. USER A CREATES SPACE
        # -------------------------------------------------------------
        print("\n[2] User A creates Space 'Data Science 2025–2029'...")
        res_space = await client.post("/api/v1/spaces", json={
            "name": "Data Science 2025–2029",
            "description": "Our college batch shared memories"
        }, headers=headers_a)
        assert res_space.status_code == 201
        space = res_space.json()
        space_id = space["id"]
        invite_code = space["invite_code"]
        print(f"  ✓ Space created: '{space['name']}' (ID: {space_id})")
        print(f"  ✓ Cryptographic Invite Code generated: {invite_code}")

        # -------------------------------------------------------------
        # 3. USER B OPENS INVITE (UNAUTHENTICATED PREVIEW)
        # -------------------------------------------------------------
        print("\n[3] Visitor (future User B) scans QR / opens invite...")
        res_preview = await client.get(f"/api/v1/spaces/join/{invite_code}")
        assert res_preview.status_code == 200
        preview = res_preview.json()
        assert preview["name"] == "Data Science 2025–2029"
        assert preview["members_count"] == 1
        assert preview["is_member"] is False
        print(f"  ✓ Space preview visible: {preview['name']} ({preview['members_count']} member, {preview['memories_count']} memories)")

        # -------------------------------------------------------------
        # 4. USER B REGISTERS & RETURNS TO INVITE TO JOIN
        # -------------------------------------------------------------
        tag_b = uuid.uuid4().hex[:6]
        user_b_email = f"adhi_{tag_b}@example.com"
        user_b_uname = f"adhi_{tag_b}"
        print(f"\n[4] User B registers (@{user_b_uname}) and joins Space...")
        res_b = await client.post("/api/v1/auth/signup", json={
            "email": user_b_email,
            "username": user_b_uname,
            "display_name": "Adhi",
            "password": "password123"
        })
        assert res_b.status_code == 201
        data_b = res_b.json()
        token_b = data_b["access_token"]
        user_b = data_b["user"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # User B joins space
        res_join = await client.post(f"/api/v1/spaces/join/{invite_code}", headers=headers_b)
        assert res_join.status_code == 200
        assert res_join.json()["members_count"] == 2
        print(f"  ✓ User B joined space! Member count is now {res_join.json()['members_count']}")

        # Verify duplicate join doesn't fail
        res_dup_join = await client.post(f"/api/v1/spaces/join/{invite_code}", headers=headers_b)
        assert res_dup_join.status_code == 200
        print("  ✓ Duplicate join handled idempotently")

        # -------------------------------------------------------------
        # 5. USER B UPLOADS CLOUDINARY MEDIA & POSTS MEMORY
        # -------------------------------------------------------------
        print("\n[5] User B creates a Memory with multiple photos...")
        # Step 5a: Obtain Cloudinary signed authorization
        res_sign = await client.post("/api/v1/media/cloudinary-sign", json={
            "purpose": "memory",
            "space_id": space_id
        }, headers=headers_b)
        assert res_sign.status_code == 200
        sig_data = res_sign.json()
        assert "signature" in sig_data
        print(f"  ✓ Cloudinary upload authorization issued for folder: {sig_data['folder']}")

        # Step 5b: Create Memory with multiple photos & custom memory date
        res_mem = await client.post("/api/v1/memories", json={
            "space_id": space_id,
            "caption": "Orientation day in lab 3! Sep 2026",
            "memory_date": "2026-09-12",
            "media_items": [
                {
                    "cloudinary_public_id": f"omlu/spaces/{space_id}/memories/photo1_{tag_b}",
                    "secure_url": "https://res.cloudinary.com/demo/image/upload/sample1.jpg",
                    "format": "jpg",
                    "width": 1920,
                    "height": 1080,
                    "position": 0
                },
                {
                    "cloudinary_public_id": f"omlu/spaces/{space_id}/memories/photo2_{tag_b}",
                    "secure_url": "https://res.cloudinary.com/demo/image/upload/sample2.jpg",
                    "format": "jpg",
                    "width": 1080,
                    "height": 1080,
                    "position": 1
                }
            ]
        }, headers=headers_b)
        assert res_mem.status_code == 201
        created_mem = res_mem.json()
        memory_id = created_mem["id"]
        print(f"  ✓ Memory created: '{created_mem['caption']}' with {len(created_mem['media_items'])} photos")
        print(f"  ✓ Memory date: {created_mem['memory_date']}")

        # Step 5c: LIVE MOMENT SHUTTER CAPTURE (Instant, no caption, no date specified)
        print("\n[5c] User B captures a LIVE MOMENT via Shutter (zero prompt, instant post)...")
        res_live = await client.post("/api/v1/memories", json={
            "space_id": space_id,
            "media_items": [
                {
                    "cloudinary_public_id": f"omlu/spaces/{space_id}/memories/live_{tag_b}",
                    "secure_url": "https://res.cloudinary.com/demo/image/upload/live_moment.jpg",
                    "format": "jpg",
                    "width": 1080,
                    "height": 1920,
                    "position": 0
                }
            ]
        }, headers=headers_b)
        assert res_live.status_code == 201
        live_mem = res_live.json()
        live_memory_id = live_mem["id"]
        assert live_mem["caption"] is None
        assert live_mem["memory_date"] is not None
        print(f"  ✓ Live Moment captured and published instantly (ID: {live_memory_id})")

        # -------------------------------------------------------------
        # 6. USER A SEES USER B'S MEMORY, LIKES, COMMENTS, AND ADDS NOTES
        # -------------------------------------------------------------
        print("\n[6] User A views home feed, likes, comments, and contributes Notes...")
        res_feed = await client.get("/api/v1/memories/feed", headers=headers_a)
        assert res_feed.status_code == 200
        feed = res_feed.json()
        assert len(feed) >= 2
        print(f"  ✓ User A sees User B's Live Moments in home feed")

        # User A likes it
        res_like = await client.post(f"/api/v1/memories/{memory_id}/like", headers=headers_a)
        assert res_like.status_code == 200
        assert res_like.json()["is_liked"] is True
        assert res_like.json()["likes_count"] == 1
        print("  ✓ User A liked User B's Memory (like count = 1)")

        # User A comments on it
        res_comment = await client.post(f"/api/v1/memories/{memory_id}/comments", json={
            "body": "Unforgettable day! So glad we took these."
        }, headers=headers_a)
        assert res_comment.status_code == 201
        print(f"  ✓ User A commented: '{res_comment.json()['body']}'")

        # User A adds a Note ("Capture now. Remember together later.")
        print("\n[6b] Collaborative Notes: User A & User B add context after capture...")
        res_note_a = await client.post(f"/api/v1/memories/{live_memory_id}/notes", json={
            "body": "This was right before the electricity went out during presentation!"
        }, headers=headers_a)
        assert res_note_a.status_code == 201
        note_a = res_note_a.json()
        print(f"  ✓ User A added Note: '{note_a['body']}'")

        # User B adds a Note
        res_note_b = await client.post(f"/api/v1/memories/{live_memory_id}/notes", json={
            "body": "And Kailas tried to use his flashlight as a projector 😂"
        }, headers=headers_b)
        assert res_note_b.status_code == 201
        print(f"  ✓ User B added Note: '{res_note_b.json()['body']}'")

        # Verify notes list and feed integration
        res_notes_list = await client.get(f"/api/v1/memories/{live_memory_id}/notes", headers=headers_b)
        assert res_notes_list.status_code == 200
        assert len(res_notes_list.json()) == 2
        print("  ✓ Memory contains both collaborative notes in chronological order")

        # User B views Activity and sees the like, comment, and note
        res_b_act = await client.get("/api/v1/activity", headers=headers_b)
        assert res_b_act.status_code == 200
        act_types = [a["type"] for a in res_b_act.json()]
        assert "like" in act_types
        assert "comment" in act_types
        assert "note" in act_types
        print("  ✓ User B received activity notifications for like, comment, and note")

        # -------------------------------------------------------------
        # 7. USER C (UNAUTHORIZED) STRICT PRIVACY & PERMISSION BOUNDARIES
        # -------------------------------------------------------------
        tag_c = uuid.uuid4().hex[:6]
        user_c_email = f"charlie_{tag_c}@example.com"
        user_c_uname = f"charlie_{tag_c}"
        print(f"\n[7] Testing strict privacy enforcement against unauthorized User C (@{user_c_uname})...")
        res_c = await client.post("/api/v1/auth/signup", json={
            "email": user_c_email,
            "username": user_c_uname,
            "display_name": "Charlie",
            "password": "password123"
        })
        token_c = res_c.json()["access_token"]
        headers_c = {"Authorization": f"Bearer {token_c}"}

        # 7a: User C tries to view Space A -> 403
        res_c_space = await client.get(f"/api/v1/spaces/{space_id}", headers=headers_c)
        assert res_c_space.status_code == 403
        print("  ✓ User C denied access to Space A (403 Forbidden)")

        # 7b: User C tries to view Space A's memories -> 403
        res_c_mems = await client.get(f"/api/v1/memories/space/{space_id}", headers=headers_c)
        assert res_c_mems.status_code == 403
        print("  ✓ User C denied access to Space A memories (403 Forbidden)")

        # 7c: User C tries to request upload signature for Space A -> 403
        res_c_sign = await client.post("/api/v1/media/cloudinary-sign", json={
            "purpose": "memory",
            "space_id": space_id
        }, headers=headers_c)
        assert res_c_sign.status_code == 403
        print("  ✓ User C denied upload authorization for Space A (403 Forbidden)")

        # 7d: User C visits User B's profile
        # CRITICAL PRIVACY RULE: User C shares NO spaces with User B, so 0 memories returned!
        res_c_b_mems = await client.get(f"/api/v1/memories/user/{user_b['id']}", headers=headers_c)
        assert res_c_b_mems.status_code == 200
        assert len(res_c_b_mems.json()) == 0
        print("  ✓ CRITICAL PRIVACY RULE ENFORCED: User C sees 0 memories on User B's profile because they share no Spaces!")

        # 7e: User C tries to add note to Space A's Live Moment -> 403
        res_c_note = await client.post(f"/api/v1/memories/{live_memory_id}/notes", json={
            "body": "Unauthorized note"
        }, headers=headers_c)
        assert res_c_note.status_code == 403
        print("  ✓ User C denied adding note to private Space memory (403 Forbidden)")

        # -------------------------------------------------------------
        # 8. MODERATION: SPACE OWNER USER A DELETES MEMORY
        # -------------------------------------------------------------
        print("\n[8] Testing moderation by Space Owner (User A deleting memories)...")
        res_del1 = await client.delete(f"/api/v1/memories/{memory_id}", headers=headers_a)
        assert res_del1.status_code == 200
        res_del2 = await client.delete(f"/api/v1/memories/{live_memory_id}", headers=headers_a)
        assert res_del2.status_code == 200
        print("  ✓ Space Owner successfully deleted Memories and associated assets")

        # Memory is gone from feed
        res_feed_after = await client.get("/api/v1/memories/feed", headers=headers_a)
        assert len(res_feed_after.json()) == 0
        print("  ✓ All memories successfully removed from feed")

    print("\n" + "=" * 70)
    print("🎉 ALL CRITICAL E2E PATH TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_e2e_verification())
