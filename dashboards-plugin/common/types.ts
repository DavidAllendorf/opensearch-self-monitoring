import type { AlertConfig } from './alert_config';
import type { TopologyConfig } from './topology_config';
export type MetricKind = 'cluster' | 'node' | 'index' | 'pipeline' | 'logstash';

export interface ProcessorMetric {
  name: string;
  type: string;
  stage: string;
  events_in?: number;
  events_out: number;
  time_ms: number;
  failed?: number;
}

export interface ShardRecovery {
  index_name: string; index_uuid: string; shard_id: number; primary: boolean;
  stage: string; recovery_type: string; start_ms: number; stop_ms: number; time_ms: number;
  source_node?: string; target_node: string; repository?: string; snapshot?: string;
  files_recovered: number; files_total: number; files_reused: number;
  bytes_recovered: number; bytes_total: number; bytes_percent?: number;
  translog_recovered: number; translog_total?: number;
}

export interface ShardAllocation {
  index_name: string;
  index_uuid: string;
  shard_id: number;
  primary: boolean;
  state: string;
  allocation_id: string;
  relocation_target: boolean;
  relocating_node_id?: string;
  relocating_node_name?: string;
  docs?: number;
  store_bytes?: number;
}

/** Values missing after a restart or partial sampling are deliberately nullable. */
export interface Metric {
  timestamp: number;
  kind: MetricKind;
  cluster_name: string;
  cluster_uuid: string;
  status?: string;
  interval_ms?: number;
  nodes?: number;
  indices?: number;
  sampled_indices?: number;
  active_shards?: number;
  active_primary_shards?: number;
  initializing_shards?: number;
  relocating_shards?: number;
  unassigned_shards?: number;
  recoveries_available?: boolean;
  recovery_total?: number;
  recovery_sampled?: number;
  recoveries?: ShardRecovery[];
  node_id?: string;
  node_name?: string;
  index_name?: string;
  index_uuid?: string;
  roles?: string[];
  version?: string;
  shards?: number;
  uptime_ms?: number;
  heap_used_bytes?: number;
  heap_max_bytes?: number;
  cpu_percent?: number;
  heap_percent?: number;
  disk_total_bytes?: number;
  disk_available_bytes?: number;
  docs?: number;
  store_bytes?: number;
  index_rate?: number | null;
  search_rate?: number | null;
  index_latency_ms?: number | null;
  search_latency_ms?: number | null;
  thread_pool_queue?: number;
  rejected_total?: number;
  gc_time_ms?: number;
  logstash_available?: boolean;
  logstash_targets?: number;
  logstash_failed_targets?: number;
  pipeline_source?: 'ingest' | 'logstash';
  pipeline_id?: string;
  pipeline_uid?: string;
  pipeline_workers?: number;
  pipeline_batch_size?: number;
  events_in_total?: number;
  events_out_total?: number;
  events_failed_total?: number;
  events_current?: number;
  events_in_rate?: number | null;
  events_out_rate?: number | null;
  events_failed_rate?: number | null;
  events_latency_ms?: number | null;
  worker_utilization?: number | null;
  queue_backpressure?: number | null;
  queue_events?: number;
  queue_bytes?: number;
  queue_type?: string;
  processors?: ProcessorMetric[];
  allocation_shards?: number;
  allocation_primaries?: number;
  allocation_replicas?: number;
  allocation_indices?: number;
  allocation_sampled_shards?: number;
  allocations?: ShardAllocation[];
  allocation_index_primaries?: Array<{ index_name: string; index_uuid: string; primaries: number }>;
}

export const HISTORY_FIELDS = [
  'index_rate', 'search_rate', 'cpu_percent', 'heap_percent', 'index_latency_ms',
  'search_latency_ms', 'events_in_rate', 'events_out_rate', 'events_failed_rate',
  'events_latency_ms', 'worker_utilization', 'queue_backpressure', 'queue_events',
  'queue_bytes', 'docs', 'store_bytes', 'thread_pool_queue', 'rejected_total',
  'disk_available_bytes', 'gc_time_ms',
  'active_shards', 'initializing_shards', 'relocating_shards', 'unassigned_shards', 'events_current',
] as const;
export type SeriesPoint = { timestamp: number } & Record<typeof HISTORY_FIELDS[number], number | null>;

export interface Overview {
  topologyConfig?: TopologyConfig;
  alertConfig?: AlertConfig;
  latest: Metric | null;
  nodes: Metric[];
  indices: Metric[];
  pipelines: Metric[];
  logstashNodes: Metric[];
  allocationNode: Metric | null;
  series: SeriesPoint[];
  intervalMs: number;
  serverTime: number;
}
