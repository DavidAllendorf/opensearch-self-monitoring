import React, { useState } from 'react';
import { EuiButtonEmpty, EuiPanel, EuiStat } from '@elastic/eui';
import type { Metric, SeriesPoint } from '../../common/types';
import { bytes, number } from '../format';
import { MetricChart } from './metric_chart';
import { metricCharts } from '../metric_charts';

export function StatsStrip({ values }: { values: Array<[string, string]> }) {
  return <div className="smStats">{values.map(([label, value]) =>
    <EuiPanel key={label} paddingSize="s"><EuiStat title={value} description={label} titleSize="s" /></EuiPanel>)}</div>;
}

export function DetailStats({ metric }: { metric: Metric }) {
  const values: Array<[string, string]> = metric.kind === 'pipeline' || metric.kind === 'logstash' ? [
    ['Events rein', number(metric.events_in_total)], ['Events raus', number(metric.events_out_total)],
    ['Durchsatz', number(metric.events_out_rate, ' /s')], ['Zeit / Event', number(metric.events_latency_ms, ' ms')],
    ...(metric.kind === 'logstash' ? [
      ['CPU', number(metric.cpu_percent, ' %')], ['JVM Heap', number(metric.heap_percent, ' %')],
    ] as Array<[string, string]> : metric.pipeline_source === 'ingest' ? [
      ['Fehler gesamt', number(metric.events_failed_total)], ['In Bearbeitung', number(metric.events_current)],
    ] as Array<[string, string]> : [
      ['Worker-Auslastung', number(metric.worker_utilization, ' %')], ['Queue Events', number(metric.queue_events)],
    ] as Array<[string, string]>),
  ] : [
    ['Dokumente', number(metric.docs)], ['Daten', bytes(metric.store_bytes)],
    ['Indexierung', number(metric.index_rate, ' /s')], ['Suche', number(metric.search_rate, ' /s')],
    ...(metric.kind === 'node' ? [
      ['CPU', number(metric.cpu_percent, ' %')], ['JVM Heap', number(metric.heap_percent, ' %')],
    ] as Array<[string, string]> : [
      ['Shards', number(metric.shards)], ['Suchzeit / Operation', number(metric.search_latency_ms, ' ms')],
    ] as Array<[string, string]>),
  ];
  return <StatsStrip values={values} />;
}

export function MetricPanels({ points, kind, source }: {
  points: SeriesPoint[]; kind: Metric['kind']; source?: string;
}) {
  const [advanced, setAdvanced] = useState(false);
  const charts = metricCharts(kind, source, advanced);
  return <section aria-label="Metrik-Diagramme">
    <div className="smMetricToolbar"><EuiButtonEmpty size="xs" aria-expanded={advanced}
      onClick={() => setAdvanced(value => !value)}>
      {advanced ? 'Erweiterte Metriken ausblenden' : 'Erweiterte Metriken einblenden'}
    </EuiButtonEmpty></div>
    <div className="smCharts">{charts.map(definition => <MetricChart key={definition.title} {...definition} points={points} />)}</div>
  </section>;
}
