import type { Metric, Overview } from '../common/types';
import { DEFAULT_ALERT_CONFIG } from '../common/alert_config';
import type { Navigation } from './navigation';
import { entityId, entityName } from './navigation';

export type TopologyKind = 'logstash' | 'logstash_pipeline' | 'cluster' | 'node' | 'ingest';
export type TopologyHealth = 'normal' | 'warning' | 'critical' | 'unknown';
export interface TopologyNode {
  id: string;
  label: string;
  kind: TopologyKind;
  metric: Metric;
  health: TopologyHealth;
  stale: boolean;
  target: Navigation;
}
export interface TopologyEdge { id: string; source: string; target: string; kind: 'membership' | 'configured'; }
export interface TopologyGraph { nodes: TopologyNode[]; edges: TopologyEdge[]; unresolvedLinks: number; missingParents: number; }
const id = (kind: TopologyKind, value: string) => JSON.stringify([kind, value]);

/** Build only relationships supported by the current sample or an explicit declaration. */
export function buildTopology(data: Overview): TopologyGraph {
  const graph: TopologyGraph = { nodes: [], edges: [], unresolvedLinks: 0, missingParents: 0 };
  const latest = data.latest;
  if (!latest) return graph;
  const config = data.alertConfig || DEFAULT_ALERT_CONFIG;
  const staleAfter = Math.max(config.stale_after_ms, data.intervalMs * config.stale_interval_multiplier);
  const nodes = new Map<string, TopologyNode>();
  function add(metric: Metric, kind: TopologyKind, identity: string, target: Navigation) {
    if (!identity || metric.cluster_uuid !== latest!.cluster_uuid || metric.timestamp !== latest!.timestamp) return;
    const stale = data.serverTime - metric.timestamp > staleAfter;
    const severities: number[] = [];
    const threshold = (value: number | null | undefined, limits: { warning: number; critical: number }) => {
      if (value != null && Number.isFinite(value)) severities.push(value >= limits.critical ? 2 : value >= limits.warning ? 1 : 0);
    };
    threshold(metric.cpu_percent, config.cpu);
    threshold(metric.heap_percent, config.heap);
    if (metric.disk_total_bytes && metric.disk_available_bytes != null) {
      threshold(100 * (1 - metric.disk_available_bytes / metric.disk_total_bytes), config.disk);
    }
    threshold(metric.thread_pool_queue, config.thread_pool_queue);
    threshold(metric.worker_utilization, config.worker_utilization);
    threshold(metric.queue_backpressure, config.queue_backpressure);
    if (metric.pipeline_source === 'ingest' && metric.events_failed_rate != null) {
      severities.push(metric.events_failed_rate > config.ingest_failed_rate ? 1 : 0);
    }
    const status = metric.status?.toLowerCase();
    if (kind === 'cluster' && status && ['green', 'yellow', 'red'].includes(status)) {
      severities.push(status === config.cluster_health.critical ? 2 : status === config.cluster_health.warning ? 1 : 0);
    } else if (kind !== 'cluster') {
      if (status === 'red' || status === 'unavailable') severities.push(2);
      else if (status === 'yellow') severities.push(1);
      else if (status === 'green') severities.push(0);
    }
    if (kind === 'cluster') {
      if ((metric.unassigned_shards || 0) > config.unassigned_shards) severities.push(1);
      if ((metric.logstash_failed_targets || 0) > config.logstash_failed_targets) severities.push(1);
    }
    const severity = Math.max(-1, ...severities);
    const health: TopologyHealth = stale || severity < 0 ? 'unknown' : severity >= 2 ? 'critical' : severity === 1 ? 'warning' : 'normal';
    const node: TopologyNode = { id: id(kind, identity), kind, metric, stale, health, target,
      label: kind === 'cluster' ? metric.cluster_name : entityName(metric) || identity };
    nodes.set(node.id, node);
  }
  const clusterId = id('cluster', latest.cluster_uuid);
  add(latest, 'cluster', latest.cluster_uuid, { section: 'opensearch', view: 'overview' });
  for (const node of data.nodes) add(node, 'node', node.node_id || '', { section: 'opensearch', view: 'nodes', entity: node.node_id, label: node.node_name });
  for (const node of data.logstashNodes) add(node, 'logstash', node.node_id || '', { section: 'logstash', view: 'nodes', entity: node.node_id, label: node.node_name });
  for (const pipeline of data.pipelines) {
    if (!pipeline.pipeline_uid || !pipeline.node_id || !pipeline.pipeline_source) continue;
    add(pipeline, pipeline.pipeline_source === 'logstash' ? 'logstash_pipeline' : 'ingest', pipeline.pipeline_uid,
      { section: pipeline.pipeline_source === 'logstash' ? 'logstash' : 'opensearch', view: 'pipelines', entity: entityId(pipeline), label: pipeline.pipeline_id });
  }
  const edges = new Map<string, TopologyEdge>();
  function connect(source: string, target: string, kind: TopologyEdge['kind']) {
    if (!nodes.has(source) || !nodes.has(target)) { graph.missingParents++; return; }
    const identity = JSON.stringify([kind, source, target]);
    edges.set(identity, { id: identity, source, target, kind });
  }
  for (const node of nodes.values()) {
    if (node.kind === 'node') connect(clusterId, node.id, 'membership');
    if (node.kind === 'ingest') connect(id('node', node.metric.node_id!), node.id, 'membership');
    if (node.kind === 'logstash_pipeline') connect(id('logstash', node.metric.node_id!), node.id, 'membership');
  }
  for (const link of data.topologyConfig?.links || []) {
    const pipeline = [...nodes.values()].find(node => node.kind === 'logstash_pipeline'
      && node.metric.node_id === link.logstash_node_id && node.metric.pipeline_id === link.pipeline_id);
    if (!pipeline || link.target_cluster_uuid !== latest.cluster_uuid) { graph.unresolvedLinks++; continue; }
    connect(pipeline.id, clusterId, 'configured');
  }
  graph.nodes = [...nodes.values()].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  graph.edges = [...edges.values()];
  return graph;
}

/** Keep direct neighbours of search hits, then cap rendering without inventing missing links. */
export function visibleTopology(graph: TopologyGraph, query: string, limit = 160): TopologyGraph & { omitted: number } {
  const search = query.trim().toLocaleLowerCase();
  const matches = new Set(graph.nodes.filter(node => !search || `${node.label} ${node.metric.node_name || ''} ${node.metric.node_id || ''} ${node.metric.pipeline_id || ''} ${node.metric.roles?.join(' ') || ''}`.toLocaleLowerCase().includes(search)).map(node => node.id));
  const visible = new Set(matches);
  for (const edge of graph.edges) if (matches.has(edge.source) || matches.has(edge.target)) { visible.add(edge.source); visible.add(edge.target); }
  const priority = (node: TopologyNode) => node.kind === 'cluster' ? 0 : matches.has(node.id) && search ? 1 : node.kind === 'node' || node.kind === 'logstash' ? 2 : 3;
  const candidates = graph.nodes.filter(node => visible.has(node.id)).sort((a, b) => priority(a) - priority(b) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  const nodes = candidates.slice(0, limit);
  const ids = new Set(nodes.map(node => node.id));
  return { ...graph, nodes, edges: graph.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)), omitted: candidates.length - nodes.length };
}
