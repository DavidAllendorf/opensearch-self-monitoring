import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Metric, Overview } from '../common/types';
import { buildTopology, visibleTopology } from '../public/topology';
import { parseNavigation } from '../public/navigation';
import { DEFAULT_ALERT_CONFIG } from '../common/alert_config';

function metric(kind: Metric['kind'], values: Partial<Metric> = {}): Metric {
  return { kind, timestamp: 10000, cluster_uuid: 'cluster-a', cluster_name: 'Test', ...values };
}
function sample(): Overview {
  return { latest: metric('cluster', { status: 'green' }), nodes: [metric('node', { node_id: 'os-1', node_name: 'Search', cpu_percent: 10 })],
    logstashNodes: [metric('logstash', { node_id: 'ls-1', node_name: 'Logs', heap_percent: 20 })],
    pipelines: [metric('pipeline', { pipeline_uid: 'p-1', pipeline_id: 'main', pipeline_source: 'logstash', node_id: 'ls-1' }),
      metric('pipeline', { pipeline_uid: 'p-2', pipeline_id: 'main', pipeline_source: 'ingest', node_id: 'os-1', events_failed_rate: 0 })],
    indices: [], series: [], allocationNode: null, intervalMs: 10000, serverTime: 12000 };
}
test('automatic map contains only measured memberships, never guessed data flows', () => {
  const graph = buildTopology(sample());
  assert.equal(graph.nodes.length, 5);
  assert.equal(graph.edges.length, 3);
  assert.ok(graph.edges.every(edge => edge.kind === 'membership'));
  assert.equal(graph.missingParents, 0);
  assert.equal(graph.nodes.find(node => node.kind === 'ingest')?.target.entity, 'p-2');
  assert.equal(graph.nodes.find(node => node.kind === 'logstash_pipeline')?.health, 'unknown');
});
test('configured flows match exact node, pipeline and cluster identity and are deduplicated', () => {
  const data = sample();
  data.logstashNodes.push(metric('logstash', { node_id: 'ls-2', node_name: 'Other' }));
  data.pipelines.push(metric('pipeline', { pipeline_uid: 'p-3', pipeline_id: 'main', pipeline_source: 'logstash', node_id: 'ls-2' }));
  const link = { logstash_node_id: 'ls-1', pipeline_id: 'main', target_cluster_uuid: 'cluster-a' };
  data.topologyConfig = { links: [link, link, { ...link, target_cluster_uuid: 'other' }, { ...link, pipeline_id: 'missing' }] };
  const graph = buildTopology(data);
  const configured = graph.edges.filter(edge => edge.kind === 'configured');
  assert.equal(configured.length, 1);
  assert.equal(graph.nodes.find(node => node.id === configured[0].source)?.metric.node_id, 'ls-1');
  assert.equal(graph.unresolvedLinks, 2);
});
test('stale, partial and foreign-cluster samples cannot produce healthy or phantom connections', () => {
  const data = sample();
  data.serverTime = 100000;
  data.nodes = [];
  data.logstashNodes.push(metric('logstash', { node_id: 'foreign', cluster_uuid: 'elsewhere' }));
  data.pipelines.push(metric('pipeline', { pipeline_uid: 'old', pipeline_id: 'old', node_id: 'ls-1', pipeline_source: 'logstash', timestamp: 1 }));
  const graph = buildTopology(data);
  assert.ok(graph.nodes.every(node => node.health === 'unknown' && node.stale));
  assert.equal(graph.nodes.length, 4);
  assert.equal(graph.missingParents, 1);
  assert.equal(graph.edges.length, 1);
});
test('resource colors use configured thresholds and do not round values', () => {
  const data = sample();
  data.nodes[0].cpu_percent = 95;
  assert.equal(buildTopology(data).nodes.find(node => node.kind === 'node')?.health, 'critical');
  data.nodes[0].cpu_percent = 84.99;
  assert.equal(buildTopology(data).nodes.find(node => node.kind === 'node')?.health, 'normal');
  data.nodes[0].cpu_percent = NaN;
  assert.equal(buildTopology(data).nodes.find(node => node.kind === 'node')?.health, 'unknown');
  data.alertConfig = { ...DEFAULT_ALERT_CONFIG, cpu: { warning: 60, critical: 80 } };
  data.nodes[0].cpu_percent = 80;
  assert.equal(buildTopology(data).nodes.find(node => node.kind === 'node')?.health, 'critical');
  data.alertConfig.cluster_health = { warning: 'red', critical: 'red' };
  data.latest!.status = 'yellow';
  assert.equal(buildTopology(data).nodes.find(node => node.kind === 'cluster')?.health, 'normal');
});
test('search retains direct neighbours and render limits never create dangling edges', () => {
  const graph = buildTopology(sample());
  const filtered = visibleTopology(graph, 'Search');
  assert.equal(filtered.nodes.length, 3);
  assert.equal(filtered.edges.length, 2);
  const bounded = visibleTopology(graph, '', 2);
  assert.equal(bounded.nodes.length, 2);
  assert.equal(bounded.omitted, 3);
  assert.ok(bounded.edges.every(edge => bounded.nodes.some(node => node.id === edge.source) && bounded.nodes.some(node => node.id === edge.target)));
  assert.equal(visibleTopology(graph, 'not-present').nodes.length, 0);
});
test('empty samples and topology deep links are safe', () => {
  const data = sample(); data.latest = null;
  assert.equal(buildTopology(data).nodes.length, 0);
  assert.deepEqual(parseNavigation('#/opensearch/topology?entity=stale&label=old'), { section: 'opensearch', view: 'topology', entity: undefined, label: undefined });
});
