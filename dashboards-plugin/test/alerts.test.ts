import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Metric, Overview, SeriesPoint } from '../common/types';
import { evaluateAlerts } from '../public/alerts';
import { historyKind, parseNavigation } from '../public/navigation';

const now = 1_000_000;
function metric(values: Partial<Metric> = {}): Metric {
  return { timestamp: now, kind: 'cluster', cluster_name: 'test', cluster_uuid: 'cluster', ...values };
}
function overview(values: Partial<Overview> = {}): Overview {
  return { latest: metric({ status: 'green', nodes: 1 }), nodes: [metric({ kind: 'node', node_id: 'n1', node_name: 'node1',
    allocation_primaries: 3, cpu_percent: 0, heap_percent: 0, disk_total_bytes: 1000, disk_available_bytes: 1000 })],
    indices: [], pipelines: [], logstashNodes: [], allocationNode: null, series: [], intervalMs: 10000, serverTime: now, ...values };
}
const ids = (data: Overview, section: 'opensearch' | 'logstash' = 'opensearch') => evaluateAlerts(data, section).alerts.map(a => a.id);

test('primary rule is strictly greater than three and links to node details', () => {
  const data = overview();
  assert.equal(ids(data).length, 0);
  data.nodes[0].allocation_primaries = 4;
  const alert = evaluateAlerts(data, 'opensearch').alerts[0];
  assert.equal(alert.id, 'primaries:n1');
  assert.equal(alert.target?.entity, 'n1');
  assert.equal(alert.target?.view, 'nodes');
  data.nodes[0].allocation_primaries = undefined;
  assert.equal(ids(data).length, 0);
  assert.ok(evaluateAlerts(data, 'opensearch').notes.some(n => n.includes('Primary-Shard-Anzahl unbekannt')));
});
test('resource thresholds use unrounded values and promote warning to critical', () => {
  const data = overview();
  Object.assign(data.nodes[0], { cpu_percent: 84.99, heap_percent: 85, disk_available_bytes: 50, thread_pool_queue: 1000 });
  const alerts = evaluateAlerts(data, 'opensearch').alerts;
  assert.ok(!alerts.some(a => a.id === 'cpu:n1'));
  assert.equal(alerts.find(a => a.id === 'heap:n1')?.severity, 'warning');
  assert.equal(alerts.find(a => a.id === 'disk:n1')?.severity, 'critical');
  assert.equal(alerts.find(a => a.id === 'queue:n1')?.severity, 'critical');
  assert.equal(alerts[0].severity, 'critical');
});
test('missing, NaN and zero capacity never become a healthy resource measurement', () => {
  const data = overview();
  Object.assign(data.nodes[0], { cpu_percent: null, heap_percent: NaN, disk_total_bytes: 0, disk_available_bytes: 0 });
  const report = evaluateAlerts(data, 'opensearch');
  assert.equal(report.alerts.length, 0);
  assert.ok(report.notes.some(n => n.includes('CPU oder JVM Heap fehlen')));
  assert.ok(report.notes.some(n => n.includes('Dateisystem-Belegung unbekannt')));
});
test('stale data suspends resource and anomaly rules and does not imply recovery', () => {
  const data = overview({ serverTime: now + 30001 });
  data.nodes[0].cpu_percent = 100;
  assert.deepEqual(ids(data), ['stale']);
  assert.equal(evaluateAlerts(data, 'opensearch').alerts[0].severity, 'critical');
  assert.equal(evaluateAlerts(overview({ latest: null }), 'opensearch').alerts.length, 0);
});
test('health, unassigned shards and Logstash failures stay scoped to their product', () => {
  const data = overview({ latest: metric({ status: 'red', unassigned_shards: 1, logstash_targets: 2, logstash_failed_targets: 1 }) });
  assert.deepEqual(ids(data).sort(), ['health', 'unassigned']);
  assert.deepEqual(ids(data, 'logstash'), ['logstash-targets']);
});
test('pipeline rules use rates rather than cumulative failure counters', () => {
  const data = overview({ pipelines: [metric({ kind: 'pipeline', pipeline_source: 'ingest', pipeline_uid: 'i', events_failed_total: 10, events_failed_rate: 0 }),
    metric({ kind: 'pipeline', pipeline_source: 'logstash', pipeline_uid: 'l', worker_utilization: 99, queue_backpressure: 1 })] });
  assert.equal(ids(data).length, 0);
  data.pipelines[0].events_failed_rate = 1;
  assert.deepEqual(ids(data), ['failures:i']);
  assert.deepEqual(ids(data, 'logstash'), ['workers:l', 'backpressure:l']);
});

function history(values: Array<number | null>): SeriesPoint[] {
  return values.map((value, index) => ({ timestamp: now - (values.length - index - 1) * 20000,
    index_rate: value, search_rate: value, events_out_rate: value } as SeriesPoint));
}
test('anomalies ignore incomplete last bucket and require eight prior intervals', () => {
  const data = overview({ series: history([...Array(8).fill(100), 1000]) });
  assert.equal(ids(data).length, 0); // Spike belongs to the incomplete bucket.
  data.series = history([...Array(8).fill(100), 1000, 0]);
  assert.deepEqual(ids(data), ['anomaly:index_rate', 'anomaly:search_rate']);
  assert.deepEqual(ids(data, 'logstash'), ['anomaly:events_out_rate']);
});
test('multiple pipelines on one node retain independent alert identities', () => {
  const data = overview({ pipelines: ['one', 'two'].map(id => metric({ kind: 'pipeline', node_id: 'same-node',
    pipeline_source: 'logstash', pipeline_uid: id, worker_utilization: 95 })) });
  assert.deepEqual(ids(data, 'logstash'), ['workers:one', 'workers:two']);
});
test('anomaly detector handles zero throughput, variable baselines and gaps', () => {
  assert.ok(ids(overview({ series: history([...Array(8).fill(100), 0, 9999]) })).includes('anomaly:index_rate'));
  assert.equal(ids(overview({ series: history([...Array(8).fill(0), 0, 100]) })).length, 0);
  assert.equal(ids(overview({ series: history([100, 1000, 100, 1000, 100, 1000, 100, 1000, 1000, 0]) })).length, 0);
  assert.equal(ids(overview({ series: history([100, null, null, null, 100, 100, 100, 100, 1000, 0]) })).length, 0);
  const staleHistory = history([...Array(8).fill(100), 0, 0]).map(p => ({ ...p, timestamp: p.timestamp - 120000 }));
  assert.equal(ids(overview({ series: staleHistory })).length, 0);
});
test('alerts are shareable product tabs, cannot request accidental entity histories', () => {
  for (const section of ['opensearch', 'logstash']) {
    const nav = parseNavigation(`#/${section}/alerts?entity=bad&label=bad`);
    assert.equal(nav.view, 'alerts');
    assert.equal(nav.entity, undefined);
    assert.equal(historyKind(nav), section === 'opensearch' ? 'cluster' : 'logstash');
  }
});
