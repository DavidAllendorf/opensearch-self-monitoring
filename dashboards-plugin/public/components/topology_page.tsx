import React, { useMemo, useState } from 'react';
import { EuiBadge, EuiButtonEmpty, EuiCallOut, EuiFieldSearch, EuiPanel, EuiSpacer, EuiText, EuiTitle } from '@elastic/eui';
import type { Overview } from '../../common/types';
import type { Navigation } from '../navigation';
import { bytes, number } from '../format';
import { buildTopology, visibleTopology, TopologyKind, TopologyNode } from '../topology';

const LANES: Array<{ kind: TopologyKind; title: string }> = [
  { kind: 'logstash', title: 'Logstash-Server' }, { kind: 'logstash_pipeline', title: 'Logstash-Pipelines' },
  { kind: 'cluster', title: 'OpenSearch-Cluster' }, { kind: 'node', title: 'OpenSearch-Nodes' },
  { kind: 'ingest', title: 'Ingest-Pipelines' },
];
const HEALTH = { normal: 'Unauffällig', warning: 'Warnung', critical: 'Kritisch', unknown: 'Unbekannt' };
const COLOR = { normal: 'success', warning: 'warning', critical: 'danger', unknown: 'hollow' } as const;
const WIDTH = 232;
const HEIGHT = 116;
const GAP_X = 276;
const GAP_Y = 140;

function summary(node: TopologyNode): string {
  const m = node.metric;
  if (node.kind === 'cluster') return `${number(m.nodes)} Nodes · ${number(m.active_shards)} Shards`;
  if (node.kind === 'ingest' || node.kind === 'logstash_pipeline') return `${number(m.events_out_rate, ' Events/s')} · ${node.kind === 'ingest' ? number(m.events_failed_rate, ' Fehler/s') : number(m.queue_events, ' in Queue')}`;
  return `CPU ${number(m.cpu_percent, ' %')} · Heap ${number(m.heap_percent, ' %')}`;
}

function details(node: TopologyNode): Array<[string, string]> {
  const m = node.metric;
  const rows: Array<[string, string]> = [['Status', node.stale ? 'Messwerte veraltet' : HEALTH[node.health]],
    ['Messung', new Date(m.timestamp).toLocaleString('de-DE')]];
  const eventRates = `${number(m.events_in_rate, '/s')} / ${number(m.events_out_rate, '/s')}`;
  if (node.kind === 'cluster') {
    rows.push(['Cluster-UUID', m.cluster_uuid], ['Nodes', number(m.nodes)],
      ['Aktive / nicht zugewiesene Shards', `${number(m.active_shards)} / ${number(m.unassigned_shards)}`],
      ['Indexierung / Suche', `${number(m.index_rate, '/s')} / ${number(m.search_rate, '/s')}`]);
  } else if (node.kind === 'node' || node.kind === 'logstash') {
    rows.push(['Node-ID', m.node_id || '—'], ['Version', m.version || '—'],
      ['CPU', number(m.cpu_percent, ' %')], ['JVM Heap', number(m.heap_percent, ' %')]);
    if (node.kind === 'node') rows.push(['Rollen', roles(node)], ['Dateisystem frei', bytes(m.disk_available_bytes)],
      ['Shards', number(m.allocation_shards ?? m.shards)], ['Threadpool-Queue', number(m.thread_pool_queue)]);
    else rows.push(['Events rein / raus', eventRates]);
  } else {
    rows.push(['Pipeline-ID', m.pipeline_id || '—'], ['Node', m.node_name || m.node_id || '—'],
      ['Events rein / raus', eventRates], ['Mittlere Arbeitszeit', number(m.events_latency_ms, ' ms')]);
    if (node.kind === 'ingest') rows.push(['Fehler', number(m.events_failed_rate, '/s')]);
    else {
      const outputs = [...new Set((m.processors || []).filter(p => p.stage === 'outputs').map(p => p.type))];
      rows.push(['Worker-Auslastung', number(m.worker_utilization, ' %')], ['Queue', `${number(m.queue_events)} Events · ${bytes(m.queue_bytes)}`],
        ['Backpressure', number(m.queue_backpressure)], ['Output-Typen', outputs.join(', ') || '—']);
    }
  }
  return rows;
}

function roles(node: TopologyNode): string {
  return node.metric.roles ? node.metric.roles.join(', ') || 'Coordinating-only' : 'Rollen unbekannt';
}

export function TopologyPage({ data, navigate }: { data: Overview; navigate: (target: Navigation) => void }) {
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string>();
  const graph = useMemo(() => buildTopology(data), [data]);
  const visible = useMemo(() => visibleTopology(graph, query), [graph, query]);
  const positions = new Map<string, { x: number; y: number }>();
  let rows = 1;
  LANES.forEach((lane, column) => {
    const nodes = visible.nodes.filter(node => node.kind === lane.kind);
    rows = Math.max(rows, nodes.length);
    nodes.forEach((node, row) => positions.set(node.id, { x: 16 + column * GAP_X, y: 46 + row * GAP_Y }));
  });
  const width = 2 * 16 + 4 * GAP_X + WIDTH;
  const height = visible.nodes.length ? 46 + rows * GAP_Y : 46;
  const selected = graph.nodes.find(node => node.id === selectedId);
  const connections = selected ? graph.edges.filter(edge => edge.source === selected.id || edge.target === selected.id) : [];
  return <>
    <EuiTitle size="m"><h2>Topologie</h2></EuiTitle>
    <EuiText size="s"><p className="smTableDescription">Automatische Komponentenübersicht aus dem aktuellen Sample. Linien zeigen Zugehörigkeit, gestrichelte Pfeile ausschließlich konfigurierte Datenfluss-Zuordnungen. Sie beweisen keine aktive Verbindung.</p></EuiText>
    <div className="smTopologyToolbar">
      <EuiFieldSearch aria-label="Topologie durchsuchen" placeholder="Node, Pipeline oder Rolle suchen …" value={query} onChange={event => setQuery(event.target.value)} incremental />
      <EuiButtonEmpty size="s" aria-label="Topologie verkleinern" disabled={zoom <= .5} onClick={() => setZoom(value => Math.max(.5, value - .25))}>−</EuiButtonEmpty>
      <EuiButtonEmpty size="s" onClick={() => setZoom(1)}>{Math.round(zoom * 100)} %</EuiButtonEmpty>
      <EuiButtonEmpty size="s" aria-label="Topologie vergrößern" disabled={zoom >= 2} onClick={() => setZoom(value => Math.min(2, value + .25))}>+</EuiButtonEmpty>
    </div>
    {!!visible.omitted && <><EuiCallOut title={`Ansicht auf 160 Komponenten begrenzt; ${visible.omitted} weitere Treffer`} color="warning"><p>Bitte die Suche eingrenzen. Direkte Nachbarn werden nach Möglichkeit mit angezeigt.</p></EuiCallOut><EuiSpacer size="s" /></>}
    {!!(graph.unresolvedLinks || graph.missingParents || data.latest?.logstash_failed_targets) && <><EuiCallOut title="Topologie teilweise unvollständig" color="warning"><p>
      {graph.unresolvedLinks} konfigurierte Zuordnungen ohne passende Pipeline oder Cluster-UUID im aktuellen Sample. {graph.missingParents} Zugehörigkeiten ohne erfassten Elternknoten. {number(data.latest?.logstash_failed_targets)} Logstash-APIs nicht erreichbar.
    </p></EuiCallOut><EuiSpacer size="s" /></>}
    <div className="smTopologyLayout">
      <EuiPanel paddingSize="s" className="smTopologyCanvas">
        <div className="smTopologyScroll" tabIndex={0} aria-label="Topologie, horizontal und vertikal scrollbar">
          <svg width={width * zoom} height={height * zoom} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="OpenSearch- und Logstash-Topologie">
            <defs><marker id="smTopologyArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker></defs>
            {LANES.map((lane, column) => <text key={lane.kind} x={16 + column * GAP_X} y={24} className="smTopologyLane">{lane.title}</text>)}
            {visible.edges.map(edge => {
              const source = positions.get(edge.source)!;
              const target = positions.get(edge.target)!;
              const startX = source.x + WIDTH;
              const startY = source.y + HEIGHT / 2;
              const endX = target.x;
              const endY = target.y + HEIGHT / 2;
              const middle = (startX + endX) / 2;
              return <path key={edge.id} d={`M${startX},${startY} C${middle},${startY} ${middle},${endY} ${endX},${endY}`}
                className={`smTopologyEdge ${edge.kind === 'configured' ? 'smTopologyConfigured' : ''} ${selected && (edge.source === selected.id || edge.target === selected.id) ? 'smTopologyHighlight' : ''}`}
                markerEnd={edge.kind === 'configured' ? 'url(#smTopologyArrow)' : undefined}>
                <title>{edge.kind === 'configured' ? 'Konfigurierte Datenfluss-Zuordnung; nicht automatisch verifiziert' : 'Erfasste Zugehörigkeit; keine Netzwerkverbindung'}</title>
              </path>;
            })}
            {visible.nodes.map(node => {
              const position = positions.get(node.id)!;
              return <foreignObject key={node.id} x={position.x} y={position.y} width={WIDTH} height={HEIGHT}>
                <button className={`smTopologyNode ${selectedId === node.id ? 'smTopologySelected' : ''}`} data-health={node.health}
                  aria-pressed={selectedId === node.id} aria-label={`${node.label}: ${node.stale ? 'Veraltet' : HEALTH[node.health]}`}
                  onClick={() => setSelectedId(node.id)}>
                  <strong title={node.label}>{node.label}</strong>
                  <span>{node.stale ? 'Veraltet' : HEALTH[node.health]}</span>
                  <span>{summary(node)}</span>
                  <span>{node.kind === 'node' ? roles(node) : node.metric.node_name || 'Details öffnen'}</span>
                </button>
              </foreignObject>;
            })}
          </svg>
        </div>
        {!visible.nodes.length && <EuiText size="s"><p>Keine Komponenten für diesen Filter.</p></EuiText>}
      </EuiPanel>
      {selected && <EuiPanel paddingSize="m" className="smTopologyDetails">
        <EuiButtonEmpty size="xs" onClick={() => setSelectedId(undefined)}>Details schließen</EuiButtonEmpty>
        <EuiTitle size="s"><h3>{selected.label}</h3></EuiTitle>
        <EuiBadge color={COLOR[selected.health]}>{selected.stale ? 'Veraltet' : HEALTH[selected.health]}</EuiBadge>
        <dl>{details(selected).map(([label, value]) => <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>)}</dl>
        <EuiButtonEmpty size="s" onClick={() => navigate(selected.target)}>Monitoring-Details öffnen →</EuiButtonEmpty>
        <EuiText size="s"><p>Zugehörigkeiten und Zuordnungen:</p></EuiText>
        <ul>{connections.map(edge => {
          const neighbour = graph.nodes.find(node => node.id === (edge.source === selected.id ? edge.target : edge.source))!;
          return <li key={edge.id}><EuiButtonEmpty size="xs" onClick={() => { setQuery(''); setSelectedId(neighbour.id); }}>{neighbour.label}</EuiButtonEmpty><span className="smCellMeta">{edge.kind === 'configured' ? 'Konfigurierter Datenfluss' : 'Zugehörigkeit'}</span></li>;
        })}</ul>
      </EuiPanel>}
    </div>
    <EuiSpacer size="s" />
    <EuiText size="xs"><p>Farben: Ressourcen- und Pipeline-Schwellen aus stack_monitoring.alerts; keine vollständige Alert-Auswertung oder Erreichbarkeitsprüfung. Grau bedeutet fehlende Bewertungsdaten oder veraltete Messwerte. Logstash-Output-Ziele, Index-Routing und physische Netzwerkverbindungen werden nicht automatisch erkannt. Fehlende Raten bleiben unbekannt.</p></EuiText>
  </>;
}
