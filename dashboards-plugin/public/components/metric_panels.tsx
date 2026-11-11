import React from 'react';
import { EuiPanel, EuiStat } from '@elastic/eui';
import type { Metric, SeriesPoint } from '../../common/types';
import { bytes, number } from '../format';
import { MetricChart } from './metric_chart';

export function StatsStrip({ values }: { values: Array<[string, string]> }) {
  return <div className="smStats">{values.map(([label, value]) =>
    <EuiPanel key={label} paddingSize="m"><EuiStat title={value} description={label} titleSize="s" /></EuiPanel>)}</div>;
}

export function DetailStats({ metric }: { metric: Metric }) {
  const values: Array<[string, string]> = metric.kind === 'pipeline' || metric.kind === 'logstash' ? [
    ['Events rein', number(metric.events_in_total)], ['Events raus', number(metric.events_out_total)],
    ['Durchsatz', number(metric.events_out_rate, ' /s')], ['Zeit / Event', number(metric.events_latency_ms, ' ms')],
    ...(metric.pipeline_source === 'ingest' ? [
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

export function MetricPanels({ points, kind, source, advanced = false }: {
  points: SeriesPoint[]; kind: Metric['kind']; source?: string; advanced?: boolean;
}) {
  const pipeline = kind === 'pipeline' || kind === 'logstash';
  return <div className="smCharts">
    {pipeline ? <>
      <MetricChart title="Event-Durchsatz" points={points} unit="/s" lines={[
        { field: 'events_in_rate', label: 'Events rein', color: '#00b3a4' },
        { field: 'events_out_rate', label: 'Events raus', color: '#3185fc' },
      ]} />
      <MetricChart title="Verarbeitungszeit je Event" points={points} unit="ms" lines={[
        { field: 'events_latency_ms', label: 'Mittlere Zeit', color: '#3185fc' },
      ]} />
      {source === 'ingest' ? <>
        <MetricChart title="Fehlgeschlagene Events" points={points} unit="/s" lines={[{ field: 'events_failed_rate', label: 'Fehler', color: '#bd271e' }]} />
      </> : kind === 'pipeline' ? <>
        <MetricChart title="Worker-Auslastung" points={points} unit="%" percent lines={[{ field: 'worker_utilization', label: 'Worker', color: '#00b3a4' }]} />
        <MetricChart title="Events in der Queue" points={points} lines={[{ field: 'queue_events', label: 'Queue Events', color: '#9170b8' }]} />
        {advanced && <MetricChart title="Queue Backpressure" points={points} lines={[{ field: 'queue_backpressure', label: 'Blockierte Input-Zeit / Echtzeit', color: '#d6a100' }]} />}
      </> : <>
        <MetricChart title="CPU-Auslastung" points={points} unit="%" lines={[{ field: 'cpu_percent', label: 'Logstash-Prozess', color: '#00b3a4' }]} />
        <MetricChart title="JVM Heap" points={points} unit="%" percent lines={[{ field: 'heap_percent', label: 'Heap belegt', color: '#9170b8' }]} />
      </>}
    </> : <>
      <MetricChart title="Indexierung" points={points} unit="/s" lines={[{ field: 'index_rate', label: 'Dokumente', color: '#00b3a4' }]} />
      <MetricChart title="Suche" points={points} unit="/s" lines={[{ field: 'search_rate', label: 'Shard-Abfragen', color: '#3185fc' }]} />
      <MetricChart title="Indexierungszeit je Operation" points={points} unit="ms" lines={[{ field: 'index_latency_ms', label: 'Indexierung', color: '#00b3a4' }]} />
      <MetricChart title="Suchzeit je Operation" points={points} unit="ms" lines={[{ field: 'search_latency_ms', label: 'Suche', color: '#3185fc' }]} />
      {kind !== 'index' && <>
        <MetricChart title="CPU-Auslastung" points={points} unit="%" percent lines={[{ field: 'cpu_percent', label: kind === 'cluster' ? 'Knotendurchschnitt' : 'CPU', color: '#00b3a4' }]} />
        <MetricChart title="JVM Heap" points={points} unit="%" percent lines={[{ field: 'heap_percent', label: 'Heap belegt', color: '#9170b8' }]} />
      </>}
      {advanced && kind === 'node' && <>
        <MetricChart title="Threadpool Queue" points={points} lines={[{ field: 'thread_pool_queue', label: 'Wartende Operationen', color: '#d6a100' }]} />
        <MetricChart title="Ablehnungen seit Start" points={points} lines={[{ field: 'rejected_total', label: 'Ablehnungen', color: '#bd271e' }]} />
      </>}
      {advanced && kind === 'index' && <>
        <MetricChart title="Dokumente" points={points} lines={[{ field: 'docs', label: 'Primäre Dokumente', color: '#00b3a4' }]} />
        <MetricChart title="Speicher" points={points} unit="B" lines={[{ field: 'store_bytes', label: 'Primärdaten', color: '#9170b8' }]} />
      </>}
    </>}
  </div>;
}
