export type MetricKind = 'cluster' | 'node' | 'index';

/** Values missing after a restart or partial sampling are deliberately nullable. */
export interface Metric {
  timestamp: number;
  kind: MetricKind;
  cluster_name: string;
  cluster_uuid: string;
  status?: 'green' | 'yellow' | 'red';
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
  cpu_percent?: number;
  heap_percent?: number;
  disk_total_bytes?: number;
  disk_available_bytes?: number;
  docs: number;
  store_bytes: number;
  index_rate: number | null;
  search_rate: number | null;
  index_latency_ms: number | null;
  search_latency_ms: number | null;
  thread_pool_queue?: number;
  rejected_total?: number;
}

export interface SeriesPoint {
  timestamp: number;
  index_rate: number | null;
  search_rate: number | null;
  cpu_percent: number | null;
  heap_percent: number | null;
  index_latency_ms: number | null;
  search_latency_ms: number | null;
}

export interface Overview {
  latest: Metric | null;
  nodes: Metric[];
  indices: Metric[];
  series: SeriesPoint[];
  intervalMs: number;
  serverTime: number;
}
