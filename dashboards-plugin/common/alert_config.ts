export interface LimitPair { warning: number; critical: number; }
export interface AlertConfig {
  cpu: LimitPair; heap: LimitPair; disk: LimitPair; thread_pool_queue: LimitPair;
  worker_utilization: LimitPair; queue_backpressure: LimitPair;
  primary_shards_per_index: number; unassigned_shards: number;
  logstash_failed_targets: number; ingest_failed_rate: number;
  stale_after_ms: number; stale_interval_multiplier: number;
  cluster_health: { warning: 'yellow' | 'red'; critical: 'yellow' | 'red' };
  anomaly: { baseline_buckets: number; min_buckets: number; min_coverage: number;
    spike_ratio: number; mad_multiplier: number; min_rate: number; drop_ratio: number; };
}
/** Shared defaults: validation, evaluation and UI describe the same values. */
export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  cpu: { warning: 85, critical: 95 }, heap: { warning: 85, critical: 95 },
  disk: { warning: 85, critical: 95 }, thread_pool_queue: { warning: 100, critical: 1000 },
  worker_utilization: { warning: 90, critical: 99 }, queue_backpressure: { warning: 1, critical: 5 },
  primary_shards_per_index: 3, unassigned_shards: 0, logstash_failed_targets: 0, ingest_failed_rate: 0,
  stale_after_ms: 30000, stale_interval_multiplier: 3,
  cluster_health: { warning: 'yellow', critical: 'red' },
  anomaly: { baseline_buckets: 30, min_buckets: 8, min_coverage: .8,
    spike_ratio: 3, mad_multiplier: 6, min_rate: 10, drop_ratio: .2 },
};
/** Cross-field checks supplement the server schema's numeric/type bounds. */
export function validateAlertConfig(config: AlertConfig): string | undefined {
  for (const key of ['cpu', 'heap', 'disk', 'thread_pool_queue', 'worker_utilization', 'queue_backpressure'] as const) {
    if (config[key].critical < config[key].warning) return `${key}.critical must be >= ${key}.warning`;
  }
  if (config.anomaly.min_buckets > config.anomaly.baseline_buckets) return 'anomaly.min_buckets must be <= anomaly.baseline_buckets';
  if (config.cluster_health.warning === 'red' && config.cluster_health.critical === 'yellow') return 'cluster_health.critical must not precede warning';
}
