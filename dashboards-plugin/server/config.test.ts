import { configSchema } from './config';
import { DEFAULT_ALERT_CONFIG } from '../common/alert_config';

describe('monitoring configuration contract', () => {
  it('uses shared defaults and permits partial YAML overrides', () => {
    expect(configSchema.validate({}).alerts).toEqual(DEFAULT_ALERT_CONFIG);
    const configured = configSchema.validate({ alerts: { cpu: { warning: 70 }, primary_shards_per_index: 5 } });
    expect(configured.alerts.cpu).toEqual({ warning: 70, critical: 95 });
    expect(configured.alerts.primary_shards_per_index).toBe(5);
  });
  it('rejects misspellings, impossible ranges and reversed thresholds', () => {
    for (const alerts of [{ unknown: 1 }, { cpu: { warning: 101 } }, { heap: { warning: 90, critical: 80 } },
      { primary_shards_per_index: 3.5 }, { anomaly: { min_buckets: 40, baseline_buckets: 30 } },
      { anomaly: { drop_ratio: 1 } }, { stale_after_ms: -1 }]) {
      expect(() => configSchema.validate({ alerts })).toThrow();
    }
  });
});
