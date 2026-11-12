import type { MetricKind, SeriesPoint } from '../common/types';

interface Line { field: Exclude<keyof SeriesPoint, 'timestamp'>; label: string; color: string; }
export interface ChartDefinition { title: string; lines: Line[]; unit?: string; percent?: boolean; }
const chart = (title: string, field: Line['field'], label: string, color: string, unit = '', percent = false): ChartDefinition =>
  ({ title, lines: [{ field, label, color }], unit, percent });
const indexing = chart('Indexierung', 'index_rate', 'Dokumente', '#00b3a4', '/s');
const search = chart('Suche', 'search_rate', 'Shard-Abfragen', '#3185fc', '/s');
const latency = [chart('Indexierungszeit je Operation', 'index_latency_ms', 'Indexierung', '#00b3a4', 'ms'),
  chart('Suchzeit je Operation', 'search_latency_ms', 'Suche', '#3185fc', 'ms')];

/** One catalog for visible charts: every supported view has a real expanded state. */
export function metricCharts(kind: MetricKind, source: string | undefined, advanced: boolean): ChartDefinition[] {
  if (kind === 'pipeline' || kind === 'logstash') {
    const base: ChartDefinition[] = [{ title: 'Event-Durchsatz', unit: '/s', lines: [
      { field: 'events_in_rate', label: 'Events rein', color: '#00b3a4' },
      { field: 'events_out_rate', label: 'Events raus', color: '#3185fc' },
    ] }];
    const extra = [chart('Verarbeitungszeit je Event', 'events_latency_ms', 'Mittlere Arbeitszeit', '#3185fc', 'ms')];
    if (source === 'ingest') {
      base.push(chart('Fehlgeschlagene Events', 'events_failed_rate', 'Fehler', '#bd271e', '/s'));
      extra.push(chart('Events in Bearbeitung', 'events_current', 'Aktuell verarbeitet', '#9170b8'));
    } else if (kind === 'pipeline') {
      base.push(chart('Worker-Auslastung', 'worker_utilization', 'Worker', '#00b3a4', '%', true),
        chart('Events in der Queue', 'queue_events', 'Queue Events', '#9170b8'));
      extra.push(chart('Queue Backpressure', 'queue_backpressure', 'Blockierte Input-Zeit / Echtzeit', '#d6a100'),
        chart('Queue-Speicher', 'queue_bytes', 'Queue-Daten', '#9170b8', 'B'));
    } else {
      base.push(chart('CPU-Auslastung', 'cpu_percent', 'Logstash-Prozess / Node-Mittel', '#00b3a4', '%'),
        chart('JVM Heap', 'heap_percent', 'Heap belegt', '#9170b8', '%', true));
    }
    return advanced ? [...base, ...extra] : base;
  }
  const base = [indexing, search];
  if (kind !== 'index') base.push(chart('CPU-Auslastung', 'cpu_percent', kind === 'cluster' ? 'Knotendurchschnitt' : 'CPU', '#00b3a4', '%', true),
    chart('JVM Heap', 'heap_percent', 'Heap belegt', '#9170b8', '%', true));
  if (!advanced) return base;
  const extra = [...latency];
  if (kind === 'node') extra.push(chart('Threadpool Queue', 'thread_pool_queue', 'Wartende Operationen', '#d6a100'),
    chart('Ablehnungen seit Start', 'rejected_total', 'Ablehnungen', '#bd271e'),
    chart('Freier Dateisystemspeicher', 'disk_available_bytes', 'Verfügbar', '#9170b8', 'B'),
    chart('GC-Zeit seit Start', 'gc_time_ms', 'GC-Arbeitszeit', '#3185fc', 'ms'));
  else {
    extra.push(chart('Dokumente', 'docs', 'Primäre Dokumente', '#00b3a4'), chart('Speicher', 'store_bytes', 'Primärdaten', '#9170b8', 'B'));
    if (kind === 'cluster') extra.push(chart('Freier Dateisystemspeicher', 'disk_available_bytes', 'Verfügbar', '#9170b8', 'B'),
      { title: 'Shard-Zustände', unit: '', lines: [
        { field: 'initializing_shards', label: 'Initialisierung', color: '#d6a100' },
        { field: 'relocating_shards', label: 'Verschiebung', color: '#3185fc' },
        { field: 'unassigned_shards', label: 'Nicht zugewiesen', color: '#bd271e' },
      ] });
  }
  return [...base, ...extra];
}
