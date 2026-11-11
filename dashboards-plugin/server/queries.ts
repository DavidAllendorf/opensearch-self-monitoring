import { HISTORY_FIELDS } from '../common/types';

/** Bound response size and bucket count independently of user-supplied time ranges. */
export function historyQuery(minutes: number, kind: string, entity?: string, now = Date.now(), sampleIntervalMs = 10000, clusterId?: string) {
  const fields = HISTORY_FIELDS;
  // Two sampling periods absorb normal collection jitter without drawing false outages.
  const interval = Math.max(Math.ceil(sampleIntervalMs / 1000) * 2, Math.ceil(minutes * 60 / 120));
  const filters: object[] = [{ term: { kind } }, { range: { timestamp: { gte: now - minutes * 60_000, lte: now } } }];
  if (clusterId) filters.push({ term: { cluster_uuid: clusterId } });
  if (kind !== 'cluster' && entity) filters.push({ term: { [kind === 'index' ? 'index_uuid' : kind === 'pipeline' ? 'pipeline_uid' : 'node_id']: entity } });
  return {
    size: 0,
    query: { bool: { filter: filters } },
    aggs: {
      timeline: {
        date_histogram: { field: 'timestamp', fixed_interval: `${interval}s`, min_doc_count: 0, extended_bounds: { min: now - minutes * 60_000, max: now } },
        aggs: Object.fromEntries(fields.map(field => [field, { avg: { field } }])),
      },
    },
  };
}
