import type { ShardAllocation } from '../common/types';

export interface NodeIndex {
  index_name: string;
  index_uuid: string;
  shards: number;
  primaries: number;
  replicas: number;
  started: number;
  initializing: number;
  relocating: number;
  docs?: number;
  store_bytes?: number;
}

/** Aggregate only the copies physically assigned to this node; never use cluster index totals. */
export function nodeIndices(shards: ShardAllocation[]): NodeIndex[] {
  const indices = new Map<string, NodeIndex>();
  for (const shard of shards) {
    let index = indices.get(shard.index_uuid);
    if (!index) {
      index = { index_name: shard.index_name, index_uuid: shard.index_uuid, shards: 0,
        primaries: 0, replicas: 0, started: 0, initializing: 0, relocating: 0, docs: 0, store_bytes: 0 };
      indices.set(shard.index_uuid, index);
    }
    index.shards++;
    if (shard.primary) index.primaries++; else index.replicas++;
    if (shard.state === 'STARTED') index.started++;
    if (shard.state === 'INITIALIZING') index.initializing++;
    if (shard.state === 'RELOCATING') index.relocating++;
    // One missing copy makes the index sum incomplete: show missing instead of a false partial total.
    index.docs = index.docs == null || shard.docs == null ? undefined : index.docs + shard.docs;
    index.store_bytes = index.store_bytes == null || shard.store_bytes == null ? undefined : index.store_bytes + shard.store_bytes;
  }
  return Array.from(indices.values()).sort((a, b) => a.index_name.localeCompare(b.index_name));
}
