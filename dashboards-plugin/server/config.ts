import { schema } from '@osd/config-schema';
import { DEFAULT_ALERT_CONFIG as defaults, validateAlertConfig } from '../common/alert_config';
import type { AlertConfig } from '../common/alert_config';

function pair(value: { warning: number; critical: number }, max = Number.MAX_SAFE_INTEGER) {
  return schema.object({ warning: schema.number({ defaultValue: value.warning, min: 0, max }),
    critical: schema.number({ defaultValue: value.critical, min: 0, max }) });
}
function integer(defaultValue: number, min = 0, max = 1_000_000_000) {
  return schema.number({ defaultValue, min, max, validate: value => Number.isInteger(value) ? undefined : 'Must be an integer' });
}
export const configSchema = schema.object({ alerts: schema.object({
  cpu: pair(defaults.cpu, 100), heap: pair(defaults.heap, 100), disk: pair(defaults.disk, 100),
  thread_pool_queue: pair(defaults.thread_pool_queue), worker_utilization: pair(defaults.worker_utilization, 100),
  queue_backpressure: pair(defaults.queue_backpressure),
  primary_shards_per_index: integer(defaults.primary_shards_per_index),
  unassigned_shards: integer(defaults.unassigned_shards), logstash_failed_targets: integer(defaults.logstash_failed_targets),
  ingest_failed_rate: schema.number({ defaultValue: defaults.ingest_failed_rate, min: 0 }),
  stale_after_ms: integer(defaults.stale_after_ms, 1000, 86400000),
  stale_interval_multiplier: schema.number({ defaultValue: defaults.stale_interval_multiplier, min: 1, max: 1000 }),
  cluster_health: schema.object({ warning: schema.oneOf([schema.literal('yellow'), schema.literal('red')], { defaultValue: defaults.cluster_health.warning }),
    critical: schema.oneOf([schema.literal('yellow'), schema.literal('red')], { defaultValue: defaults.cluster_health.critical }) }),
  anomaly: schema.object({
    baseline_buckets: integer(defaults.anomaly.baseline_buckets, 2, 120),
    min_buckets: integer(defaults.anomaly.min_buckets, 2, 120),
    min_coverage: schema.number({ defaultValue: defaults.anomaly.min_coverage, min: .01, max: 1 }),
    spike_ratio: schema.number({ defaultValue: defaults.anomaly.spike_ratio, min: 1.01, max: 1000 }),
    mad_multiplier: schema.number({ defaultValue: defaults.anomaly.mad_multiplier, min: 0, max: 1000 }),
    min_rate: schema.number({ defaultValue: defaults.anomaly.min_rate, min: .001 }),
    drop_ratio: schema.number({ defaultValue: defaults.anomaly.drop_ratio, min: 0, max: .99 }),
  }),
}, { validate: value => validateAlertConfig(value as AlertConfig) }) });
export interface MonitoringConfig { alerts: AlertConfig; }
