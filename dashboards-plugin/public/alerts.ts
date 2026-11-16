import type { Metric, Overview } from '../common/types';
import type { Navigation, Section } from './navigation';
import { DEFAULT_ALERT_CONFIG } from '../common/alert_config';
import type { AlertConfig } from '../common/alert_config';

export type Severity = 'critical' | 'warning';
export interface MonitoringAlert {
  id: string;
  severity: Severity;
  title: string;
  entity: string;
  observation: string;
  action: string;
  target?: Navigation;
  nodes: Array<{ id: string; name: string; target?: Navigation }>;
  group: string;
}
export interface AlertReport { alerts: MonitoringAlert[]; notes: string[]; }

export function alertRules(c: AlertConfig): Array<[string, string]> {
  const pair = (value: { warning: number; critical: number }) => `Warnung ab ${value.warning}, kritisch ab ${value.critical}`;
  return [
    ['CPU / JVM Heap', `${pair(c.cpu)} % CPU; ${pair(c.heap)} % Heap.`],
    ['Dateisystem', `${pair(c.disk)} % belegt.`],
    ['Primary-Shards je Index', `Warnung bei mehr als ${c.primary_shards_per_index} Primary-Shards desselben Index auf derselben Node. Replicas zählen nicht.`],
    ['Cluster', `Warnung bei ${c.cluster_health.warning}, kritisch bei ${c.cluster_health.critical}; nicht zugewiesene Shards > ${c.unassigned_shards}.`],
    ['Erfassung', `Logstash-API-Ausfälle > ${c.logstash_failed_targets}; Datenalter > max(${c.stale_after_ms} ms, ${c.stale_interval_multiplier} Messintervalle).`],
    ['OpenSearch-Queue', `${pair(c.thread_pool_queue)} wartende Aufgaben pro Node.`],
    ['Pipelines', `Ingest-Fehler > ${c.ingest_failed_rate}/s; Worker: ${pair(c.worker_utilization)} %; Backpressure: ${pair(c.queue_backpressure)}.`],
    ['Durchsatz-Anomalien', `Basis: ${c.anomaly.min_buckets} bis ${c.anomaly.baseline_buckets} Intervalle, mindestens ${c.anomaly.min_coverage * 100} % Abdeckung. Anstieg > ${c.anomaly.spike_ratio}× Median und ${c.anomaly.mad_multiplier}× MAD Abstand sowie > ${c.anomaly.min_rate}/s. Rückgang < ${c.anomaly.drop_ratio * 100} % des Medians ab Median ${c.anomaly.min_rate}/s.`],
  ];
}

/** One row per rule, severity and (for shard placement) index; node identities remain explicit. */
function groupAlerts(alerts: MonitoringAlert[]): MonitoringAlert[] {
  const groups = new Map<string, MonitoringAlert>();
  for (const alert of alerts) {
    const key = `${alert.severity}:${alert.group}`;
    const existing = groups.get(key);
    if (!existing) { groups.set(key, { ...alert, observation: alert.nodes.length ? `${alert.entity}: ${alert.observation}` : alert.observation, nodes: [...alert.nodes] }); continue; }
    existing.observation += `\n${alert.entity}: ${alert.observation}`;
    for (const node of alert.nodes) if (!existing.nodes.some(other => other.id === node.id)) existing.nodes.push(node);
    existing.target = undefined;
    if (existing.entity !== alert.entity) existing.entity = 'Mehrere betroffene Einträge';
  }
  return [...groups.values()].sort((a, b) => a.severity === b.severity ? a.id.localeCompare(b.id) : a.severity === 'critical' ? -1 : 1);
}

const known = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const display = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Pure, read-only evaluation. Never turns a missing measurement into a healthy zero. */
export function evaluateAlerts(data: Overview, section: Section): AlertReport {
  const config = data.alertConfig || DEFAULT_ALERT_CONFIG;
  const alerts: MonitoringAlert[] = [];
  const notes: string[] = [];
  const latest = data.latest;
  if (!latest) return { alerts, notes: ['Noch keine Messwerte vorhanden. Regeln können nicht ausgewertet werden.'] };
  const staleAfter = Math.max(config.stale_after_ms, data.intervalMs * config.stale_interval_multiplier);
  const affected = (metric: Metric): MonitoringAlert['nodes'] => [{ id: metric.node_id || metric.node_name || 'unknown',
    name: metric.node_name || metric.node_id || 'Unbekannter Node',
    ...(metric.node_id ? { target: { section, view: 'nodes' as const, entity: metric.node_id, label: metric.node_name } } : {}) }];
  const add = (id: string, severity: Severity, title: string, entity: string, observation: string, action: string,
    target?: Navigation, nodes: MonitoringAlert['nodes'] = [], group = id) =>
    alerts.push({ id, severity, title, entity, observation, action, target, nodes, group });
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
      `${display(value)}${unit} · Warnung ab ${warning}${unit}, kritisch ab ${critical}${unit}.`, action, target, affected(metric), key);
  }
  const nodes = section === 'opensearch' ? data.nodes : data.logstashNodes;
  if (!nodes.length) notes.push('Keine aktuellen Node-Messwerte für diesen Bereich. Ressourcen-Regeln können nicht ausgewertet werden.');
  for (const node of nodes) {
    const target: Navigation = { section, view: 'nodes', entity: node.node_id, label: node.node_name };
    threshold(node, 'cpu', node.cpu_percent, config.cpu.warning, config.cpu.critical, 'Hohe CPU-Auslastung', ' %', 'Node-Verlauf und aktive Aufgaben prüfen.', target);
    threshold(node, 'heap', node.heap_percent, config.heap.warning, config.heap.critical, 'Hoher JVM-Heap-Verbrauch', ' %', 'Heap-Verlauf, Garbage Collection und Arbeitslast prüfen.', target);
    if (!known(node.cpu_percent) || !known(node.heap_percent)) notes.push(`${node.node_name}: CPU oder JVM Heap fehlen.`);
    if (section === 'opensearch') {
      if (known(node.disk_total_bytes) && node.disk_total_bytes > 0 && known(node.disk_available_bytes)) {
        threshold(node, 'disk', 100 * (1 - node.disk_available_bytes / node.disk_total_bytes), config.disk.warning, config.disk.critical,
          'Dateisystem fast voll', ' %', 'Speicher freigeben oder erweitern und OpenSearch-Watermarks prüfen.', target);
      } else notes.push(`${node.node_name}: Dateisystem-Belegung unbekannt.`);
      for (const index of node.allocation_index_primaries || []) {
        if (index.primaries > config.primary_shards_per_index) add(`primaries:${index.index_uuid}:${node.node_id}`, 'warning',
          'Primary-Shards eines Index auf einer Node konzentriert', index.index_name,
          `${node.node_name}: ${index.primaries} Primary-Shards von ${index.index_name} · Maximum: ${config.primary_shards_per_index}. Replicas sind nicht enthalten.`,
          'Shard-Verteilung dieses Index in den Node-Details prüfen. Dies ist eine Betriebsrichtlinie, kein OpenSearch-Limit.', target, affected(node), `primaries:${index.index_uuid}`);
      }
      if (!node.allocation_index_primaries) notes.push(`${node.node_name}: Primary-Zähler je Index fehlen; Collector 0.8.0 erforderlich.`);
      else if (known(node.allocation_indices) && node.allocation_indices > node.allocation_index_primaries.length) notes.push(`${node.node_name}: Index-Zähler begrenzt; Indizes mit den meisten Primaries werden zuerst ausgewertet.`);
      threshold(node, 'queue', node.thread_pool_queue, config.thread_pool_queue.warning, config.thread_pool_queue.critical, 'OpenSearch-Warteschlange wächst',
        ' Aufgaben', 'Thread-Pools und Durchsatz prüfen; gegebenenfalls Last reduzieren.', target);
    }
  }
  if (section === 'opensearch') {
    const target: Navigation = { section, view: 'overview' };
    if (latest.status === 'red' || latest.status === config.cluster_health.critical || latest.status === config.cluster_health.warning) add('health', latest.status === 'red' || latest.status === config.cluster_health.critical ? 'critical' : 'warning',
      'Cluster-Zustand eingeschränkt', latest.cluster_name, `Cluster-Status: ${latest.status.toUpperCase()}.`,
      'Shard-Zuweisung und Allocation Explain prüfen.', target);
    if (known(latest.unassigned_shards) && latest.unassigned_shards > config.unassigned_shards) add('unassigned', latest.status === 'red' ? 'critical' : 'warning',
      'Nicht zugewiesene Shards', latest.cluster_name, `${latest.unassigned_shards} Shards sind nicht zugewiesen.`,
      'Fehlende Nodes, Speicher-Watermarks und Replikazahl prüfen.', target);
    if (known(latest.nodes) && latest.nodes > data.nodes.length) notes.push('Die Node-Liste ist unvollständig; Regeln erfassen nur angezeigte Nodes.');
  } else if (known(latest.logstash_failed_targets) && latest.logstash_failed_targets > config.logstash_failed_targets) {
    add('logstash-targets', 'critical', 'Logstash-APIs nicht erreichbar', 'Logstash',
      `${latest.logstash_failed_targets} von ${latest.logstash_targets ?? '?'} konfigurierten APIs fehlgeschlagen.`,
      'Logstash-Prozesse, API-Adressen und Netzwerk vom Collector aus prüfen.', { section, view: 'nodes' });
  }
  for (const pipeline of data.pipelines.filter(p => p.pipeline_source === (section === 'logstash' ? 'logstash' : 'ingest'))) {
    const target: Navigation = { section, view: 'pipelines', entity: pipeline.pipeline_uid, label: pipeline.pipeline_id };
    if (section === 'opensearch' && known(pipeline.events_failed_rate) && pipeline.events_failed_rate > config.ingest_failed_rate) add(`failures:${pipeline.pipeline_uid}`, 'warning',
      'Ingest-Pipeline meldet Fehler', `${pipeline.node_name} / ${pipeline.pipeline_id}`, `${display(pipeline.events_failed_rate)} Fehler/s im letzten Messintervall.`,
      'Pipeline-Prozessoren, on_failure und fehlerhafte Dokumente prüfen.', target, affected(pipeline), 'failures');
    if (section === 'logstash') {
      threshold(pipeline, 'workers', pipeline.worker_utilization, config.worker_utilization.warning, config.worker_utilization.critical, 'Logstash-Worker stark ausgelastet', ' %', 'Pipeline-Prozessoren und Output-Durchsatz prüfen.', target);
      threshold(pipeline, 'backpressure', pipeline.queue_backpressure, config.queue_backpressure.warning, config.queue_backpressure.critical, 'Logstash-Queue erzeugt Rückstau', '', 'Blockierende Outputs und Queue-Verlauf prüfen.', target);
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
    const preceding = complete.slice(-(config.anomaly.baseline_buckets + 1), -1);
    const baseline = preceding.map(p => p[field]).filter(known);
    // Gaps must not manufacture a baseline from a handful of distant values.
    if (baseline.length < config.anomaly.min_buckets || baseline.length < preceding.length * config.anomaly.min_coverage) continue;
    evaluated++;
    const center = median(baseline);
    const deviation = median(baseline.map(value => Math.abs(value - center)));
    const value = current[field] as number;
    const spike = value > Math.max(center * config.anomaly.spike_ratio, center + config.anomaly.mad_multiplier * deviation, config.anomaly.min_rate);
    const drop = center >= config.anomaly.min_rate && value < center * config.anomaly.drop_ratio;
    if (spike || drop) add(`anomaly:${field}`, 'warning', spike ? 'Ungewöhnlicher Durchsatz-Anstieg' : 'Ungewöhnlicher Durchsatz-Rückgang',
      field === 'index_rate' ? 'OpenSearch-Indexierung' : field === 'search_rate' ? 'OpenSearch-Suche' : 'Logstash-Output',
      `${display(value)}/s gegenüber Median ${display(center)}/s in ${baseline.length} vorherigen Intervallen. Intervall: ${new Date(current.timestamp).toLocaleTimeString('de-DE')}.`,
      'Verlauf und geplante Lastwechsel prüfen. Die heuristische Abweichung ist kein sicherer Fehlernachweis.', { section, view: 'overview' });
  }
  if (evaluated < fields.length) notes.push(`Anomalie-Erkennung teilweise noch nicht bereit: mindestens ${config.anomaly.min_buckets} gültige vorherige, abgeschlossene Intervalle und ${config.anomaly.min_coverage * 100} % Datenabdeckung erforderlich.`);
  return { alerts: groupAlerts(alerts), notes: [...new Set(notes)] };
}
