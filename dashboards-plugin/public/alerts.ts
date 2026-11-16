import type { Metric, Overview } from '../common/types';
import type { Navigation, Section } from './navigation';

export type Severity = 'critical' | 'warning';
export interface MonitoringAlert {
  id: string;
  severity: Severity;
  title: string;
  entity: string;
  observation: string;
  action: string;
  target?: Navigation;
}
export interface AlertReport { alerts: MonitoringAlert[]; notes: string[]; }

export const ALERT_RULES = [
  ['CPU / JVM Heap', 'Warnung ab 85 %, kritisch ab 95 % (aktueller Messwert).'],
  ['Dateisystem', 'Warnung ab 85 %, kritisch ab 95 % belegt.'],
  ['Primary-Shards', 'Warnung bei mehr als 3 Primary-Shards je Node, einschließlich Systemindizes. Dies ist eine eigene Richtlinie, kein OpenSearch-Limit.'],
  ['Cluster / Erfassung', 'Gelb, Rot, nicht zugewiesene Shards, fehlgeschlagene Logstash-APIs oder veraltete Messwerte.'],
  ['OpenSearch-Queue', 'Warnung ab 100, kritisch ab 1.000 wartenden Aufgaben pro Node.'],
  ['Pipelines', 'Ingest-Fehlerrate > 0/s; Logstash-Worker ab 90 / 99 %; Backpressure ab 1 / 5.'],
  ['Durchsatz-Anomalien', 'Mindestens 8 vorherige abgeschlossene Zeitintervalle: Anstieg über 3× Median und 6× MAD Abstand oder Rückgang unter 20 % des Medians (Median mindestens 10/s).'],
] as const;

const known = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const display = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Pure, read-only evaluation. Never turns a missing measurement into a healthy zero. */
export function evaluateAlerts(data: Overview, section: Section): AlertReport {
  const alerts: MonitoringAlert[] = [];
  const notes: string[] = [];
  const latest = data.latest;
  if (!latest) return { alerts, notes: ['Noch keine Messwerte vorhanden. Regeln können nicht ausgewertet werden.'] };
  const staleAfter = Math.max(30000, data.intervalMs * 3);
  const add = (id: string, severity: Severity, title: string, entity: string, observation: string, action: string, target?: Navigation) =>
    alerts.push({ id, severity, title, entity, observation, action, target });
  if (data.serverTime - latest.timestamp > staleAfter) {
    add('stale', 'critical', 'Monitoring-Daten veraltet', latest.cluster_name,
      `Letzte Messung: ${new Date(latest.timestamp).toLocaleString('de-DE')}.`,
      'Collector und OpenSearch-Logs prüfen. Aktuelle Ressourcen- und Anomalie-Regeln werden bis zur nächsten Messung ausgesetzt.');
    return { alerts, notes: ['Die angezeigten Messwerte sind historisch; der aktuelle Zustand ist unbekannt.'] };
  }
  function threshold(metric: Metric, key: string, value: number | null | undefined, warning: number, critical: number,
    title: string, unit: string, action: string, target: Navigation) {
    if (known(value) && value >= warning) add(`${key}:${metric.pipeline_uid || metric.node_id}`, value >= critical ? 'critical' : 'warning',
      title, metric.pipeline_id ? `${metric.node_name} / ${metric.pipeline_id}` : metric.node_name || 'Unbekannter Node',
      `${display(value)}${unit} · Warnung ab ${warning}${unit}, kritisch ab ${critical}${unit}.`, action, target);
  }
  const nodes = section === 'opensearch' ? data.nodes : data.logstashNodes;
  if (!nodes.length) notes.push('Keine aktuellen Node-Messwerte für diesen Bereich. Ressourcen-Regeln können nicht ausgewertet werden.');
  for (const node of nodes) {
    const target: Navigation = { section, view: 'nodes', entity: node.node_id, label: node.node_name };
    threshold(node, 'cpu', node.cpu_percent, 85, 95, 'Hohe CPU-Auslastung', ' %', 'Node-Verlauf und aktive Aufgaben prüfen.', target);
    threshold(node, 'heap', node.heap_percent, 85, 95, 'Hoher JVM-Heap-Verbrauch', ' %', 'Heap-Verlauf, Garbage Collection und Arbeitslast prüfen.', target);
    if (!known(node.cpu_percent) || !known(node.heap_percent)) notes.push(`${node.node_name}: CPU oder JVM Heap fehlen.`);
    if (section === 'opensearch') {
      if (known(node.disk_total_bytes) && node.disk_total_bytes > 0 && known(node.disk_available_bytes)) {
        threshold(node, 'disk', 100 * (1 - node.disk_available_bytes / node.disk_total_bytes), 85, 95,
          'Dateisystem fast voll', ' %', 'Speicher freigeben oder erweitern und OpenSearch-Watermarks prüfen.', target);
      } else notes.push(`${node.node_name}: Dateisystem-Belegung unbekannt.`);
      if (known(node.allocation_primaries) && node.allocation_primaries > 3) add(`primaries:${node.node_id}`, 'warning',
        'Mehr als 3 Primary-Shards auf einer Node', node.node_name || 'Unbekannter Node',
        `${node.allocation_primaries} Primary-Shards · gewünschtes Maximum: 3. Einschließlich System- und Monitoring-Indizes.`,
        'Im Node-Tab die Shards und Index-Verteilung prüfen. Die passende Shard-Anzahl hängt von Größe und Arbeitslast ab.', target);
      if (!known(node.allocation_primaries)) notes.push(`${node.node_name}: Primary-Shard-Anzahl unbekannt.`);
      threshold(node, 'queue', node.thread_pool_queue, 100, 1000, 'OpenSearch-Warteschlange wächst',
        ' Aufgaben', 'Thread-Pools und Durchsatz prüfen; gegebenenfalls Last reduzieren.', target);
    }
  }
  if (section === 'opensearch') {
    const target: Navigation = { section, view: 'overview' };
    if (latest.status === 'red' || latest.status === 'yellow') add('health', latest.status === 'red' ? 'critical' : 'warning',
      'Cluster-Zustand eingeschränkt', latest.cluster_name, `Cluster-Status: ${latest.status.toUpperCase()}.`,
      'Shard-Zuweisung und Allocation Explain prüfen.', target);
    if (known(latest.unassigned_shards) && latest.unassigned_shards > 0) add('unassigned', latest.status === 'red' ? 'critical' : 'warning',
      'Nicht zugewiesene Shards', latest.cluster_name, `${latest.unassigned_shards} Shards sind nicht zugewiesen.`,
      'Fehlende Nodes, Speicher-Watermarks und Replikazahl prüfen.', target);
    if (known(latest.nodes) && latest.nodes > data.nodes.length) notes.push('Die Node-Liste ist unvollständig; Regeln erfassen nur angezeigte Nodes.');
  } else if (known(latest.logstash_failed_targets) && latest.logstash_failed_targets > 0) {
    add('logstash-targets', 'critical', 'Logstash-APIs nicht erreichbar', 'Logstash',
      `${latest.logstash_failed_targets} von ${latest.logstash_targets ?? '?'} konfigurierten APIs fehlgeschlagen.`,
      'Logstash-Prozesse, API-Adressen und Netzwerk vom Collector aus prüfen.', { section, view: 'nodes' });
  }
  for (const pipeline of data.pipelines.filter(p => p.pipeline_source === (section === 'logstash' ? 'logstash' : 'ingest'))) {
    const target: Navigation = { section, view: 'pipelines', entity: pipeline.pipeline_uid, label: pipeline.pipeline_id };
    if (section === 'opensearch' && known(pipeline.events_failed_rate) && pipeline.events_failed_rate > 0) add(`failures:${pipeline.pipeline_uid}`, 'warning',
      'Ingest-Pipeline meldet Fehler', `${pipeline.node_name} / ${pipeline.pipeline_id}`, `${display(pipeline.events_failed_rate)} Fehler/s im letzten Messintervall.`,
      'Pipeline-Prozessoren, on_failure und fehlerhafte Dokumente prüfen.', target);
    if (section === 'logstash') {
      threshold(pipeline, 'workers', pipeline.worker_utilization, 90, 99, 'Logstash-Worker stark ausgelastet', ' %', 'Pipeline-Prozessoren und Output-Durchsatz prüfen.', target);
      threshold(pipeline, 'backpressure', pipeline.queue_backpressure, 1, 5, 'Logstash-Queue erzeugt Rückstau', '', 'Blockierende Outputs und Queue-Verlauf prüfen.', target);
    }
  }
  if (data.pipelines.length >= 10000) notes.push('Pipeline-Liste erreicht die API-Grenze; weitere Pipelines können fehlen.');

  // Histogram buckets include the current, incomplete bucket. Never compare it with complete intervals.
  const width = data.series.length > 1 ? data.series[1].timestamp - data.series[0].timestamp : 0;
  const complete = width > 0 ? data.series.filter(p => p.timestamp + width <= latest.timestamp) : [];
  let evaluated = 0;
  const fields = section === 'opensearch' ? ['index_rate', 'search_rate'] as const : ['events_out_rate'] as const;
  for (const field of fields) {
    const current = complete[complete.length - 1];
    if (!current || !known(current[field]) || latest.timestamp - current.timestamp > width + staleAfter) continue;
    const preceding = complete.slice(-31, -1);
    const baseline = preceding.map(p => p[field]).filter(known);
    // Gaps must not manufacture a baseline from a handful of distant values.
    if (baseline.length < 8 || baseline.length < preceding.length * .8) continue;
    evaluated++;
    const center = median(baseline);
    const deviation = median(baseline.map(value => Math.abs(value - center)));
    const value = current[field] as number;
    const spike = value > Math.max(center * 3, center + 6 * deviation, 10);
    const drop = center >= 10 && value < center * .2;
    if (spike || drop) add(`anomaly:${field}`, 'warning', spike ? 'Ungewöhnlicher Durchsatz-Anstieg' : 'Ungewöhnlicher Durchsatz-Rückgang',
      field === 'index_rate' ? 'OpenSearch-Indexierung' : field === 'search_rate' ? 'OpenSearch-Suche' : 'Logstash-Output',
      `${display(value)}/s gegenüber Median ${display(center)}/s in ${baseline.length} vorherigen Intervallen. Intervall: ${new Date(current.timestamp).toLocaleTimeString('de-DE')}.`,
      'Verlauf und geplante Lastwechsel prüfen. Die heuristische Abweichung ist kein sicherer Fehlernachweis.', { section, view: 'overview' });
  }
  if (evaluated < fields.length) notes.push('Anomalie-Erkennung teilweise noch nicht bereit: mindestens 8 gültige vorherige, abgeschlossene Intervalle ohne größere Datenlücken erforderlich.');
  alerts.sort((a, b) => (a.severity === b.severity ? a.id.localeCompare(b.id) : a.severity === 'critical' ? -1 : 1));
  return { alerts, notes: [...new Set(notes)] };
}
