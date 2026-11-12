import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Metric } from '../common/types';
import { logstashTotal } from '../public/logstash_totals';
import { historyQuery } from '../server/queries';

const node = (rate: number | null, cpu: number): Metric => ({ kind: 'logstash', timestamp: 1, cluster_name: 'test', cluster_uuid: 'test', events_out_rate: rate, cpu_percent: cpu });
test('multi-node overview sums throughput and averages CPU without hiding missing values', () => {
  assert.equal(logstashTotal([node(2, 10), node(8, 30)], 'events_out_rate'), 10);
  assert.equal(logstashTotal([node(2, 10), node(8, 30)], 'cpu_percent', true), 20);
  assert.equal(logstashTotal([node(2, 10), node(null, 30)], 'events_out_rate'), null);
});
test('Logstash overview histories sum event rates, while node histories remain per-node', () => {
  assert.deepEqual(historyQuery(15, 'logstash').aggs.timeline.aggs.events_out_rate,
    { sum_bucket: { buckets_path: 'logstash_nodes>events_out_rate' } });
  assert.deepEqual(historyQuery(15, 'logstash').aggs.timeline.aggs.logstash_nodes, {
    terms: { field: 'node_id', size: 128 }, aggs: { events_in_rate: { avg: { field: 'events_in_rate' } }, events_out_rate: { avg: { field: 'events_out_rate' } } },
  });
  assert.deepEqual(historyQuery(15, 'logstash', 'node-a').aggs.timeline.aggs.events_out_rate, { avg: { field: 'events_out_rate' } });
});
