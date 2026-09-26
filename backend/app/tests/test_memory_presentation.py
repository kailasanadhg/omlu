import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_each_saved_shape_survives_all_memory_reads(client: AsyncClient):
    suffix = uuid.uuid4().hex[:8]
    signup = await client.post("/api/v1/auth/signup", json={
        "email": f"crop_{suffix}@example.com", "username": f"crop_{suffix}",
        "display_name": "Crop Tester", "password": "password123",
    })
    assert signup.status_code == 201
    headers = {"Authorization": f"Bearer {signup.json()['access_token']}"}
    space = await client.post("/api/v1/spaces", json={"name": "Crop Test Space"}, headers=headers)
    assert space.status_code == 201
    space_id = space.json()["id"]

    shapes = {
        "portrait_9_16": 9 / 16,
        "portrait_3_4": 3 / 4,
        "square": 1,
        "landscape_4_3": 4 / 3,
        "circle": 1,
    }
    saved = {}
    for shape, aspect in shapes.items():
        crop_width = aspect / 1.5
        presentation = {
            "display_shape": shape, "crop_x": (1 - crop_width) / 2,
            "crop_y": 0, "crop_width": crop_width, "crop_height": 1,
        }
        original_url = f"https://example.test/original-{shape}.jpg"
        response = await client.post("/api/v1/memories", headers=headers, json={
            "client_id": str(uuid.uuid4()), "space_id": space_id,
            "presentation": presentation,
            "media_items": [{
                "cloudinary_public_id": f"test/{shape}", "secure_url": original_url,
                "width": 1200, "height": 800,
            }],
        })
        assert response.status_code == 201, response.text
        memory = response.json()
        assert memory["presentation"] == presentation
        assert memory["media_items"][0]["secure_url"] == original_url
        saved[memory["id"]] = presentation

    legacy = await client.post("/api/v1/memories", headers=headers, json={
        "space_id": space_id,
        "media_items": [{"cloudinary_public_id": "test/legacy", "secure_url": "https://example.test/legacy.jpg", "width": 900, "height": 600}],
    })
    assert legacy.status_code == 201
    assert legacy.json()["presentation"] is None

    for path in ("/api/v1/memories/feed", f"/api/v1/memories/space/{space_id}"):
        response = await client.get(path, headers=headers)
        assert response.status_code == 200
        items = {item["id"]: item for item in response.json()}
        for memory_id, presentation in saved.items():
            assert items[memory_id]["presentation"] == presentation
        assert items[legacy.json()["id"]]["presentation"] is None

    recent = await client.get("/api/v1/memories/recent-spaces", headers=headers)
    assert recent.status_code == 200
    recent_items = {item["id"]: item for item in recent.json()["memories"]}
    for memory_id, presentation in saved.items():
        assert recent_items[memory_id]["presentation"] == presentation
        assert recent_items[memory_id]["image_width"] == 1200
        assert recent_items[memory_id]["image_height"] == 800

    for memory_id, presentation in saved.items():
        detail = await client.get(f"/api/v1/memories/{memory_id}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["presentation"] == presentation


@pytest.mark.asyncio
async def test_invalid_crop_is_rejected(client: AsyncClient):
    suffix = uuid.uuid4().hex[:8]
    signup = await client.post("/api/v1/auth/signup", json={
        "email": f"invalid_{suffix}@example.com", "username": f"invalid_{suffix}",
        "display_name": "Crop Tester", "password": "password123",
    })
    headers = {"Authorization": f"Bearer {signup.json()['access_token']}"}
    space = await client.post("/api/v1/spaces", json={"name": "Crop Validation"}, headers=headers)
    payload = {
        "space_id": space.json()["id"],
        "media_items": [{"cloudinary_public_id": "test/invalid", "secure_url": "https://example.test/original.jpg", "width": 1200, "height": 800}],
        "presentation": {"display_shape": "square", "crop_x": 0.5, "crop_y": 0,
                         "crop_width": 0.8, "crop_height": 1},
    }
    response = await client.post("/api/v1/memories", json=payload, headers=headers)
    assert response.status_code == 422
    payload["presentation"] = {"display_shape": "square", "crop_x": 0, "crop_y": 0,
                               "crop_width": 1, "crop_height": 1}
    response = await client.post("/api/v1/memories", json=payload, headers=headers)
    assert response.status_code == 422
