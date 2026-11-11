import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ShardAllocation } from '../common/types';
import { nodeIndices } from '../public/node_allocations';

function shard(values: Partial<ShardAllocation>): ShardAllocation {
  return { index_name: 'logs', index_uuid: 'uuid-1', shard_id: 0, primary: true,
    state: 'STARTED', allocation_id: 'a', relocation_target: false, docs: 5, store_bytes: 100, ...values };
}

test('node index totals contain only local copies, separating primary and replica', () => {
  const [index] = nodeIndices([shard({}), shard({ shard_id: 1, primary: false, docs: 7, state: 'INITIALIZING' })]);
  assert.equal(index.shards, 2);
  assert.equal(index.primaries, 1);
  assert.equal(index.replicas, 1);
  assert.equal(index.started, 1);
  assert.equal(index.initializing, 1);
  assert.equal(index.docs, 12);
  assert.equal(index.store_bytes, 200);
});

test('missing shard stats make sums incomplete rather than fabricated zeroes', () => {
  const [index] = nodeIndices([shard({}), shard({ docs: undefined, store_bytes: undefined })]);
  assert.equal(index.docs, undefined);
  assert.equal(index.store_bytes, undefined);
  assert.equal(index.shards, 2);
});

test('index identity uses UUID even when names match', () => {
  assert.equal(nodeIndices([shard({}), shard({ index_uuid: 'uuid-2' })]).length, 2);
});
