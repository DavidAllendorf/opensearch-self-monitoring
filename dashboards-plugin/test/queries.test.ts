import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyQuery } from '../server/queries';
import { bytes, number } from '../public/format';

test('long time ranges remain bounded to roughly 120 buckets', () => {
  const query = historyQuery(10080, 'cluster', undefined, 1_000_000_000);
  const seconds = Number.parseInt(query.aggs.timeline.date_histogram.fixed_interval, 10);
  assert.ok(10080 * 60 / seconds <= 120);
  assert.equal(query.size, 0);
});

test('bucket duration absorbs sampling jitter and preserves explicit gaps', () => {
  const query = historyQuery(15, 'cluster', undefined, 1_000_000, 30000);
  assert.equal(query.aggs.timeline.date_histogram.fixed_interval, '60s');
  assert.equal(query.aggs.timeline.date_histogram.min_doc_count, 0);
});

test('entity names are exact term values rather than query-string expressions', () => {
  const entity = 'node with "quotes" OR *';
  const query = historyQuery(15, 'node', entity, 1_000_000);
  assert.deepEqual(query.query.bool.filter[2], { term: { node_id: entity } });
});

test('formatting distinguishes a missing metric from zero', () => {
  assert.equal(number(null), '—');
  assert.equal(number(0), '0');
  assert.equal(bytes(1024), '1 KiB');
  assert.equal(bytes(undefined), '—');
  assert.equal(number(Number.NaN), '—');
});
