import assert from 'node:assert/strict';
import { groupRecentMemories } from '../src/lib/recentSpaceMemories.ts';

const now = '2026-09-26T12:00:00.000Z';
const item = (id, space_id, created_at) => ({ id, space_id, created_at, image_url: `https://example.test/${id}.jpg` });
const records = [
  item('old', 'a', '2026-09-25T11:59:59.999Z'),
  item('boundary', 'a', '2026-09-25T12:00:00.000Z'),
  item('a1', 'a', '2026-09-25T12:00:00.001Z'),
  item('b1', 'b', '2026-09-26T10:00:00.000Z'),
  item('a2', 'a', '2026-09-26T11:00:00.000Z'),
  item('future', 'b', '2026-09-26T12:00:00.001Z'),
];
const groups = groupRecentMemories(records, now);
assert.deepEqual([...groups.keys()], ['a', 'b']);
assert.deepEqual(groups.get('a').map(m => m.id), ['a1', 'a2']);
assert.deepEqual(groups.get('b').map(m => m.id), ['b1']);
assert.equal(groups.has('empty'), false);
assert.equal(groupRecentMemories(records, 'invalid').size, 0);
assert.equal(groupRecentMemories(records, '2026-09-27T12:00:00.001Z').size, 0);
assert.deepEqual(groupRecentMemories(records, now), groups, 'reload gives the same result');
console.log('Recent Space Memories: boundary, old/new, multiple Spaces, ordering, and reload tests passed');
