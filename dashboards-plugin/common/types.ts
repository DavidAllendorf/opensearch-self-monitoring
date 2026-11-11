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
  unassigned_shards?: number;
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
}

export const HISTORY_FIELDS = [
  'index_rate', 'search_rate', 'cpu_percent', 'heap_percent', 'index_latency_ms',
  'search_latency_ms', 'events_in_rate', 'events_out_rate', 'events_failed_rate',
  'events_latency_ms', 'worker_utilization', 'queue_backpressure', 'queue_events',
  'queue_bytes', 'docs', 'store_bytes', 'thread_pool_queue', 'rejected_total',
  'disk_available_bytes', 'gc_time_ms',
] as const;
export type SeriesPoint = { timestamp: number } & Record<typeof HISTORY_FIELDS[number], number | null>;

export interface Overview {
  latest: Metric | null;
  nodes: Metric[];
  indices: Metric[];
  pipelines: Metric[];
  logstashNodes: Metric[];
  series: SeriesPoint[];
  intervalMs: number;
  serverTime: number;
}
