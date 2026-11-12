import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MetricKind, ShardRecovery } from '../common/types';
import { metricCharts } from '../public/metric_charts';
import { visibleRecoveries } from '../public/recoveries';

test('expanded metrics add visible charts for every offered view', () => {
  for (const [kind, source] of [['cluster'], ['node'], ['index'], ['logstash'], ['pipeline', 'ingest'], ['pipeline', 'logstash']] as Array<[MetricKind, string?]>) {
    const basic = metricCharts(kind, source, false);
    const expanded = metricCharts(kind, source, true);
    assert.ok(expanded.length > basic.length, kind + ':' + source);
    assert.equal(new Set(expanded.map(chart => chart.title)).size, expanded.length);
    assert.ok(basic.every(chart => expanded.some(other => chart.title === other.title)));
  }
});
test('cluster expanded view includes real shard and storage measurements', () => {
  const fields = metricCharts('cluster', undefined, true).flatMap(chart => chart.lines.map(line => line.field));
  assert.ok(fields.includes('relocating_shards') && fields.includes('unassigned_shards') && fields.includes('disk_available_bytes'));
});
test('activity window keeps long-running recoveries and filters old completed entries', () => {
  const row = (stage: string, stop_ms: number) => ({ stage, stop_ms } as ShardRecovery);
  const rows = [row('INDEX', 0), row('DONE', 999000), row('DONE', 1)];
  assert.equal(visibleRecoveries(rows, 1, 1000000, false).length, 2);
  assert.deepEqual(visibleRecoveries(rows, 1, 1000000, true), [rows[0]]);
});
