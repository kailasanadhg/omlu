"""Execute the new migration in a temporary schema containing pre-migration rows."""
import importlib.util
from pathlib import Path
import uuid
import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text


@pytest.mark.asyncio
async def test_visibility_migration_preserves_identities(db_session):
    conn = await db_session.connection()
    schema = 'migration_' + uuid.uuid4().hex
    def verify(connection):
        connection.execute(text(f'CREATE SCHEMA {schema}'))
        connection.execute(text(f'SET LOCAL search_path TO {schema}'))
        connection.execute(text('CREATE TABLE spaces (id uuid PRIMARY KEY)'))
        connection.execute(text('CREATE TABLE memories (id uuid PRIMARY KEY, space_id uuid REFERENCES spaces(id), author_id uuid, memory_date date, created_at timestamptz)'))
        sid, mid, uid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        connection.execute(text('INSERT INTO spaces VALUES (:id)'), {'id': sid})
        connection.execute(text('INSERT INTO memories VALUES (:id, :space, :author, CURRENT_DATE, now())'), {'id': mid, 'space': sid, 'author': uid})
        path = Path(__file__).parents[2] / 'alembic/versions/c24a91d8e602_space_visibility.py'
        spec = importlib.util.spec_from_file_location('visibility_migration', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.op = Operations(MigrationContext.configure(connection))
        module.upgrade()
        assert connection.execute(text('SELECT id, visibility FROM spaces')).one() == (sid, 'private')
        assert connection.execute(text('SELECT id, space_id, author_id FROM memories')).one() == (mid, sid, uid)
        module.downgrade()
        assert connection.execute(text('SELECT id FROM spaces')).scalar_one() == sid
        assert connection.execute(text('SELECT id FROM memories')).scalar_one() == mid
        connection.execute(text('SET LOCAL search_path TO public'))
        connection.execute(text(f'DROP SCHEMA {schema} CASCADE'))
    await conn.run_sync(verify)
