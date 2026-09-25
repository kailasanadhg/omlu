import uuid
import pytest
from app.tests.test_authorization import create_user


async def make_memory(client, headers, space_id, caption="A memory"):
    response = await client.post('/api/v1/memories', headers=headers, json={
        'space_id': space_id, 'caption': caption, 'memory_date': '2026-09-01',
        'media_items': [{'cloudinary_public_id': 'test/' + uuid.uuid4().hex,
                         'secure_url': 'https://example.com/photo.jpg', 'width': 800, 'height': 1200}]})
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_public_reads_private_boundaries_and_writes(client):
    owner, token = await create_user(client, 'visowner')
    _, other_token = await create_user(client, 'visviewer')
    auth = {'Authorization': f'Bearer {token}'}
    other = {'Authorization': f'Bearer {other_token}'}
    public = (await client.post('/api/v1/spaces', headers=auth, json={'name': 'Public archive', 'visibility': 'public'})).json()
    private = (await client.post('/api/v1/spaces', headers=auth, json={'name': 'Private archive'})).json()
    assert private['visibility'] == 'private'
    pub = await make_memory(client, auth, public['id'])
    secret = await make_memory(client, auth, private['id'], 'Never public')
    for viewer in [{}, other]:
        result = await client.get(f"/api/v1/spaces/{public['id']}", headers=viewer)
        assert result.status_code == 200
        assert result.json()['invite_code'] == ''
        assert result.json()['is_member'] is False
        assert (await client.get(f"/api/v1/memories/{pub['id']}", headers=viewer)).json()['can_contribute'] is False
        for endpoint in [f"spaces/{private['id']}", f"memories/space/{private['id']}", f"memories/{secret['id']}", f"memories/{secret['id']}/comments", f"memories/{secret['id']}/notes"]:
            assert (await client.get('/api/v1/' + endpoint, headers=viewer)).status_code == 403
    for viewer in [{}, other, auth]:
        profile = await client.get(f"/api/v1/memories/user/{owner['id']}", headers=viewer)
        assert [m['id'] for m in profile.json()] == [pub['id']]
        counts = (await client.get(f"/api/v1/users/@{owner['username']}", headers=viewer)).json()
        assert counts['memories_count'] == 1
        assert counts['spaces_count'] == 1
    assert (await client.get(f"/api/v1/memories/{secret['id']}", headers=auth)).status_code == 200
    assert (await client.patch(f"/api/v1/spaces/{public['id']}", headers=other, json={'visibility': 'private'})).status_code == 403
    for suffix, body in [('like', {}), ('notes', {'body': 'No'}), ('comments', {'body': 'No'})]:
        assert (await client.post(f"/api/v1/memories/{pub['id']}/{suffix}", headers=other, json=body)).status_code == 403
    assert (await client.post('/api/v1/media/cloudinary-sign', headers=other, json={'purpose': 'memory', 'space_id': public['id']})).status_code == 403
    assert (await client.post('/api/v1/memories', headers=other, json={'space_id': public['id'], 'media_items': [{'secure_url': 'https://example.com/no.jpg'}]})).status_code == 403
    assert (await client.delete(f"/api/v1/memories/{pub['id']}", headers=other)).status_code == 403
    assert (await client.get(f"/api/v1/spaces/{public['id']}/members", headers=other)).status_code == 403
    result = await client.patch(f"/api/v1/spaces/{public['id']}", headers=auth, json={'visibility': 'private'})
    assert result.status_code == 200
    assert result.json()['id'] == public['id']
    assert (await client.get(f"/api/v1/memories/user/{owner['id']}")).json() == []
    assert (await client.get(f"/api/v1/memories/{pub['id']}")).status_code == 403
    spaces = (await client.get('/api/v1/spaces', headers=auth)).json()
    assert {s['id'] for s in spaces} == {public['id'], private['id']}


@pytest.mark.asyncio
async def test_collection_cursor_isolation_and_member_read(client):
    _, token = await create_user(client, 'pageowner')
    _, member_token = await create_user(client, 'pagemember')
    auth = {'Authorization': f'Bearer {token}'}
    member = {'Authorization': f'Bearer {member_token}'}
    a = (await client.post('/api/v1/spaces', headers=auth, json={'name': 'Archive A'})).json()
    b = (await client.post('/api/v1/spaces', headers=auth, json={'name': 'Archive B'})).json()
    expected = [await make_memory(client, auth, a['id']) for _ in range(5)]
    excluded = await make_memory(client, auth, b['id'])
    await client.post(f"/api/v1/spaces/join/{a['invite_code']}", headers=member)
    endpoint = f"/api/v1/memories/space/{a['id']}?limit=2"
    found = []
    cursor = ''
    while True:
        response = await client.get(endpoint + cursor, headers=member)
        assert response.status_code == 200
        batch = response.json()
        if not batch:
            break
        assert all(m['space_id'] == a['id'] for m in batch)
        found.extend(m['id'] for m in batch)
        cursor = '&before=' + batch[-1]['id']
    assert len(found) == len(set(found)) == 5
    assert set(found) == {m['id'] for m in expected}
    assert (await client.get(endpoint + '&before=' + excluded['id'], headers=member)).status_code == 400
    assert (await client.get(f"/api/v1/memories/space/{a['id']}?limit=1000", headers=member)).status_code == 422
    assert (await client.patch(f"/api/v1/spaces/{a['id']}", headers=member, json={'visibility': 'public'})).status_code == 403
