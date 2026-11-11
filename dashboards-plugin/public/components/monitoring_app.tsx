import React, { useEffect, useState } from 'react';
import {
  EuiBadge, EuiButton, EuiButtonEmpty, EuiCallOut, EuiFlexGroup, EuiFlexItem,
  EuiInMemoryTable, EuiLoadingSpinner, EuiPanel, EuiSelect, EuiSpacer,
  EuiStat, EuiTab, EuiTabs, EuiText, EuiTitle,
} from '@elastic/eui';
import type { HttpStart } from '../../../../src/core/public';
import type { Metric, MetricKind, Overview } from '../../common/types';
import { bytes, number } from '../format';
import { MetricChart } from './metric_chart';

interface Selection { kind: MetricKind; entity?: string; label?: string; }

export function MonitoringApp({ http }: { http: HttpStart }) {
  const [data, setData] = useState<Overview>();
  const [error, setError] = useState<string>();
  const [minutes, setMinutes] = useState(15);
  const [paused, setPaused] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState<'node' | 'index'>('node');
  const [selection, setSelection] = useState<Selection>({ kind: 'cluster' });

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    async function load() {
      let nextInterval = 10000;
      try {
        const result = await http.get<Overview>('/api/stack_monitoring/overview', {
          query: { minutes, kind: selection.kind, ...(selection.entity ? { entity: selection.entity } : {}) },
          signal: abort.signal,
        });
        nextInterval = Math.max(5000, result.intervalMs);
        if (!disposed) { setData(result); setError(undefined); }
      } catch (failure) {
        if (disposed) return;
        const status = (failure as { response?: { status: number } }).response?.status;
        setError(status === 403
          ? 'Keine Leseberechtigung für .stack-monitoring-*. Bitte die Monitoring-Leserolle zuweisen.'
          : 'Metriken konnten nicht geladen werden. Die angezeigten Daten werden nicht aktualisiert.');
      } finally {
        if (!disposed && !paused) timer = setTimeout(load, nextInterval);
      }
    }
    load();
    return () => { disposed = true; abort.abort(); clearTimeout(timer); };
  }, [http, minutes, paused, refresh, selection.kind, selection.entity]);

  const latest = data?.latest;
  const stale = latest && data && data.serverTime - latest.timestamp > Math.max(30000, data.intervalMs * 3);
  const select = (metric: Metric) => setSelection({
    kind: metric.kind, entity: metric.node_id || metric.index_uuid,
    label: metric.node_name || metric.index_name,
  });
  const nameColumn = {
    field: tab === 'node' ? 'node_name' : 'index_name', name: tab === 'node' ? 'Knoten' : 'Index', sortable: true,
    render: (name: string, metric: Metric) => <EuiButtonEmpty size="xs" flush="left" onClick={() => select(metric)}>{name}</EuiButtonEmpty>,
  };
  const columns = [nameColumn,
    { field: 'docs', name: 'Dokumente', sortable: true, render: (value: number) => number(value) },
    { field: 'store_bytes', name: 'Speicher', sortable: true, render: (value: number) => bytes(value) },
    { field: 'index_rate', name: 'Indexierung / s', sortable: true, render: (value: number) => number(value) },
    { field: 'search_rate', name: 'Suchanfragen / s', sortable: true, render: (value: number) => number(value) },
    ...(tab === 'node' ? [
      { field: 'cpu_percent', name: 'CPU', sortable: true, render: (value: number) => number(value, ' %') },
      { field: 'heap_percent', name: 'JVM Heap', sortable: true, render: (value: number) => number(value, ' %') },
      { field: 'thread_pool_queue', name: 'Queue', sortable: true, render: (value: number) => number(value) },
    ] : []),
  ];

  return <main className="smPage">
    <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" wrap>
      <EuiFlexItem grow={false}>
        <EuiText size="s"><p className="smEyebrow">OPENSEARCH · EIGENÜBERWACHUNG</p></EuiText>
        <EuiTitle size="l"><h1>Stack Monitoring</h1></EuiTitle>
        <EuiText size="s"><p>{latest?.cluster_name || 'Lokaler Cluster'} · Cluster, Knoten und Indizes an einem Ort.</p></EuiText>
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiFlexGroup gutterSize="s" alignItems="center" wrap>
          <EuiFlexItem grow={false}><EuiSelect aria-label="Zeitraum" value={minutes} onChange={event => setMinutes(Number(event.target.value))} options={[
            { value: 15, text: 'Letzte 15 Minuten' }, { value: 60, text: 'Letzte Stunde' },
            { value: 1440, text: 'Letzte 24 Stunden' }, { value: 10080, text: 'Letzte 7 Tage' },
          ]} /></EuiFlexItem>
          <EuiFlexItem grow={false}><EuiButton onClick={() => setPaused(!paused)}>{paused ? 'Fortsetzen' : 'Pausieren'}</EuiButton></EuiFlexItem>
          <EuiFlexItem grow={false}><EuiButtonEmpty iconType="refresh" onClick={() => setRefresh(value => value + 1)}>Aktualisieren</EuiButtonEmpty></EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlexItem>
    </EuiFlexGroup>
    <EuiSpacer />
    {error && <><EuiCallOut title="Monitoring nicht verfügbar" color="danger" iconType="alert"><p>{error}</p></EuiCallOut><EuiSpacer /></>}
    {!data && !error && <EuiLoadingSpinner size="xl" />}
    {data && !latest && <EuiCallOut title="Die erste Messung steht noch aus" iconType="iInCircle">
      <p>Das OpenSearch-Plugin „stack-monitoring“ muss auf den Cluster-Manager-Knoten installiert sein. Nach dem Start dauert die erste Messung etwa zehn Sekunden. Es ist keine Datenquelle einzurichten.</p>
    </EuiCallOut>}
    {latest && <>
      {stale && <><EuiCallOut title="Die Erfassung liefert keine aktuellen Daten" color="warning" iconType="alert"><p>Letzte Messung: {new Date(latest.timestamp).toLocaleString('de-DE')}. Der angezeigte Zustand ist historisch.</p></EuiCallOut><EuiSpacer /></>}
      <div className="smStatusLine">
        <EuiBadge color={stale ? 'warning' : latest.status === 'green' ? 'success' : latest.status === 'yellow' ? 'warning' : 'danger'}>{stale ? 'VERALTET' : latest.status?.toUpperCase()}</EuiBadge>
        <span>Stand {new Date(latest.timestamp).toLocaleTimeString('de-DE')} · Erfassung alle {number(data!.intervalMs / 1000)} s{paused ? ' · Ansicht pausiert' : ''}</span>
      </div>
      <EuiSpacer size="m" />
      <div className="smStats">
        {[
          ['Knoten', number(latest.nodes)], ['Indizes', number(latest.indices)],
          ['Dokumente', number(latest.docs)], ['Primärdaten', bytes(latest.store_bytes)],
          ['Aktive Shards', number(latest.active_shards)], ['Nicht zugewiesen', number(latest.unassigned_shards)],
        ].map(([label, value]) => <EuiPanel key={label} paddingSize="m"><EuiStat title={value} description={label} titleSize="s" /></EuiPanel>)}
      </div>
      <EuiSpacer />
      <EuiFlexGroup alignItems="center" justifyContent="spaceBetween">
        <EuiFlexItem><EuiTitle size="s"><h2>{selection.kind === 'cluster' ? 'Cluster-Verlauf' : `${selection.kind === 'node' ? 'Knoten' : 'Index'}: ${selection.label}`}</h2></EuiTitle></EuiFlexItem>
        {selection.kind !== 'cluster' && <EuiFlexItem grow={false}><EuiButtonEmpty onClick={() => setSelection({ kind: 'cluster' })}>Zur Clusterübersicht</EuiButtonEmpty></EuiFlexItem>}
      </EuiFlexGroup>
      <EuiSpacer size="m" />
      <div className="smCharts">
        <MetricChart title="Durchsatz" points={data!.series} unit="/s" lines={[
          { field: 'index_rate', label: 'Indexierung', color: '#008f86' },
          { field: 'search_rate', label: 'Suche', color: '#5b5fc7' },
        ]} />
        <MetricChart title="Latenz je Operation" points={data!.series} unit="ms" lines={[
          { field: 'index_latency_ms', label: 'Indexierung', color: '#008f86' },
          { field: 'search_latency_ms', label: 'Suche', color: '#5b5fc7' },
        ]} />
        {selection.kind !== 'index' && <>
          <MetricChart title="CPU-Auslastung" points={data!.series} unit="%" percent lines={[{ field: 'cpu_percent', label: selection.kind === 'cluster' ? 'Knotendurchschnitt' : 'CPU', color: '#008f86' }]} />
          <MetricChart title="JVM Heap" points={data!.series} unit="%" percent lines={[{ field: 'heap_percent', label: 'Heap belegt', color: '#b36b00' }]} />
        </>}
      </div>
      <EuiSpacer />
      <EuiPanel paddingSize="m">
        <EuiTabs>{(['node', 'index'] as const).map(kind => <EuiTab key={kind} isSelected={tab === kind} onClick={() => setTab(kind)}>{kind === 'node' ? 'Knoten' : 'Indizes'}</EuiTab>)}</EuiTabs>
        <EuiSpacer size="m" />
        <EuiInMemoryTable key={tab} items={tab === 'node' ? data!.nodes : data!.indices} columns={columns}
          pagination={{ initialPageSize: 10, pageSizeOptions: [10, 25, 100] }} sorting
          search={{ box: { incremental: true, placeholder: 'Nach Name filtern …' } }} />
        {tab === 'index' && latest.sampled_indices! < latest.indices! && <EuiText size="s"><p>Detailerfassung auf {latest.sampled_indices} von {latest.indices} Indizes begrenzt. Cluster-Gesamtwerte enthalten alle erfassten Indizes.</p></EuiText>}
      </EuiPanel>
      <EuiSpacer size="m" />
      <EuiText size="xs"><p>Primärdaten und Indexierungsrate ohne Monitoring-Indizes. Suchrate zählt Shard-Abfragen, Latenz ist keine Ende-zu-Ende-Anfragelatenz. Knotenwerte enthalten Replikate. Lücken zeigen fehlende Messungen; nach Neustarts wird zunächst keine Rate berechnet.</p></EuiText>
    </>}
  </main>;
}
