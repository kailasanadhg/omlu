import pytest
import uuid
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_signup_and_login(client: AsyncClient):
    unique = uuid.uuid4().hex[:6]
    email = f"user_{unique}@example.com"
    username = f"user_{unique}"

    # 1. Successful Signup
    res = await client.post("/api/v1/auth/signup", json={
        "email": email,
        "username": username,
        "display_name": "Test User",
        "password": "securepassword123"
    })
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["username"] == username
    assert data["user"]["display_name"] == "Test User"

    # 2. Re-signup with same email (case-insensitive) fails
    res_dup_email = await client.post("/api/v1/auth/signup", json={
        "email": email.upper(),
        "username": f"other_{unique}",
        "display_name": "Other",
        "password": "securepassword123"
    })
    assert res_dup_email.status_code == 400
    assert "already exists" in res_dup_email.json()["detail"]

    # 3. Re-signup with same username (case-insensitive) fails
    res_dup_user = await client.post("/api/v1/auth/signup", json={
        "email": f"diff_{unique}@example.com",
        "username": username.upper(),
        "display_name": "Other",
        "password": "securepassword123"
    })
    assert res_dup_user.status_code == 400
    assert "already taken" in res_dup_user.json()["detail"]

    # 4. Reserved username fails
    res_reserved = await client.post("/api/v1/auth/signup", json={
        "email": f"admin_{unique}@example.com",
        "username": "admin",
        "display_name": "Admin",
        "password": "securepassword123"
    })
    assert res_reserved.status_code == 400
    assert "reserved" in res_reserved.json()["detail"]

    # 5. Login via email
    res_login_email = await client.post("/api/v1/auth/login", json={
        "email_or_username": email,
        "password": "securepassword123"
    })
    assert res_login_email.status_code == 200
    assert "access_token" in res_login_email.json()

    # 6. Login via @username
    res_login_user = await client.post("/api/v1/auth/login", json={
        "email_or_username": f"@{username}",
        "password": "securepassword123"
    })
    assert res_login_user.status_code == 200

    # 7. Invalid password fails
    res_invalid_pw = await client.post("/api/v1/auth/login", json={
        "email_or_username": email,
        "password": "wrongpassword"
    })
    assert res_invalid_pw.status_code == 401

    # 8. GET /auth/me with Bearer token
    token = res_login_email.json()["access_token"]
    res_me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    assert res_me.json()["username"] == username
