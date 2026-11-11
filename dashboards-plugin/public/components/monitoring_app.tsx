import React, { useEffect, useState } from 'react';
import {
  EuiBadge, EuiButton, EuiButtonEmpty, EuiCallOut, EuiFlexGroup, EuiFlexItem,
  EuiLoadingSpinner, EuiPanel, EuiSelect, EuiSpacer, EuiTab, EuiTabs, EuiText, EuiTitle,
} from '@elastic/eui';
import type { HttpStart } from '../../../../src/core/public';
import type { Metric, Overview } from '../../common/types';
import { bytes, number } from '../format';
import { entityId, entityName, historyKind, navigationHash, parseNavigation, Navigation, View } from '../navigation';
import { EntityTable } from './entity_table';
import { DetailStats, MetricPanels, StatsStrip } from './metric_panels';
import { PipelineDetail } from './pipeline_detail';

const VIEW_NAMES: Record<View, string> = { overview: 'Übersicht', nodes: 'Nodes', indices: 'Indizes', pipelines: 'Pipelines' };

export function MonitoringApp({ http }: { http: HttpStart }) {
  const [nav, setNav] = useState<Navigation>(() => parseNavigation(window.location.hash));
  const [data, setData] = useState<Overview>();
  const [error, setError] = useState<string>();
  const [minutes, setMinutes] = useState(15);
  const [paused, setPaused] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [loadedKey, setLoadedKey] = useState('');
  const kind = historyKind(nav);
  const requestKey = [kind, nav.entity || '', minutes].join(':');
  const logstash = nav.section === 'logstash';

  function navigate(next: Navigation) {
    window.location.hash = navigationHash(next);
  }
  useEffect(() => {
    const changed = () => { setNav(parseNavigation(window.location.hash)); setAdvanced(false); };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    async function load() {
      let nextInterval = 10000;
      try {
        const result = await http.get<Overview>('/api/stack_monitoring/overview', {
          query: { minutes, kind, ...(nav.entity ? { entity: nav.entity } : {}) }, signal: abort.signal,
        });
        nextInterval = Math.max(5000, result.intervalMs);
        if (!disposed) { setData(result); setLoadedKey(requestKey); setError(undefined); }
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
  }, [http, minutes, paused, refresh, kind, nav.entity, requestKey]);

  const latest = data?.latest;
  const stale = latest && data && data.serverTime - latest.timestamp > Math.max(30000, data.intervalMs * 3);
  const pipelines = (data?.pipelines || []).filter(metric => metric.pipeline_source === (logstash ? 'logstash' : 'ingest'));
  const nodes = logstash ? data?.logstashNodes || [] : data?.nodes || [];
  const items = nav.view === 'pipelines' ? pipelines : nav.view === 'indices' ? data?.indices || [] : nodes;
  const selected = nav.entity ? items.find(metric => entityId(metric) === nav.entity) : undefined;
  const loading = loadedKey !== requestKey;
  const status = logstash ? (nodes[0]?.status || 'unavailable') : latest?.status;
  const activeTabs: View[] = logstash ? ['overview', 'nodes', 'pipelines'] : ['overview', 'nodes', 'indices', 'pipelines'];
  const count = (view: View) => view === 'nodes' ? nodes.length : view === 'indices' ? data?.indices.length || 0 : view === 'pipelines' ? pipelines.length : undefined;
  const select = (metric: Metric) => navigate({ ...nav, entity: entityId(metric), label: entityName(metric) });
  const title = nav.entity ? (selected ? entityName(selected) : nav.label || nav.entity) : VIEW_NAMES[nav.view];

  return <main className="smPage">
    <header className="smHeader">
      <div className="smBreadcrumb">
        <button onClick={() => navigate({ section: 'opensearch', view: 'overview' })}>Stack Monitoring</button>
        <span>/</span><span>{latest?.cluster_name || 'Lokaler Cluster'}</span>
        <span>/</span><span>{logstash ? 'Logstash' : 'OpenSearch'}</span>
      </div>
      <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" wrap>
        <EuiFlexItem grow={false}>
          <EuiTitle size="l"><h1>{latest?.cluster_name || 'Stack Monitoring'}</h1></EuiTitle>
          <EuiText size="s"><p className="smSubtitle">Stack Monitoring</p></EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiFlexGroup gutterSize="s" alignItems="center" wrap>
            <EuiFlexItem grow={false}><EuiSelect aria-label="Zeitraum" value={minutes} onChange={event => setMinutes(Number(event.target.value))} options={[
              { value: 15, text: 'Letzte 15 Minuten' }, { value: 60, text: 'Letzte Stunde' },
              { value: 1440, text: 'Letzte 24 Stunden' }, { value: 10080, text: 'Letzte 7 Tage' },
            ]} /></EuiFlexItem>
            <EuiFlexItem grow={false}><EuiButton size="s" onClick={() => setPaused(!paused)}>{paused ? 'Fortsetzen' : 'Pausieren'}</EuiButton></EuiFlexItem>
            <EuiFlexItem grow={false}><EuiButtonEmpty size="s" iconType="refresh" onClick={() => setRefresh(value => value + 1)}>Aktualisieren</EuiButtonEmpty></EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiTabs className="smProductTabs">
        <EuiTab isSelected={!logstash} onClick={() => navigate({ section: 'opensearch', view: 'overview' })}>OpenSearch</EuiTab>
        <EuiTab isSelected={logstash} onClick={() => navigate({ section: 'logstash', view: 'overview' })}>Logstash</EuiTab>
      </EuiTabs>
    </header>
    <div className="smContent">
      {error && <><EuiCallOut title="Monitoring nicht verfügbar" color="danger" iconType="alert"><p>{error}</p></EuiCallOut><EuiSpacer /></>}
      {!data && !error && <EuiLoadingSpinner size="xl" />}
      {data && !latest && <EuiCallOut title="Die erste Messung steht noch aus"><p>Das Server-Plugin muss auf dem Cluster-Manager installiert sein. Die Erfassung startet automatisch.</p></EuiCallOut>}
      {latest && <>
        <div className="smStatusLine">
          <strong>{logstash ? 'Logstash' : 'OpenSearch'}</strong>
          <EuiBadge color={stale || status === 'unavailable' ? 'warning' : status === 'green' ? 'success' : status === 'yellow' ? 'warning' : 'danger'}>{stale ? 'VERALTET' : (status || 'UNBEKANNT').toUpperCase()}</EuiBadge>
          <span>Stand {new Date(latest.timestamp).toLocaleTimeString('de-DE')} · {number(data!.intervalMs / 1000)} s{paused ? ' · Ansicht pausiert' : ''}</span>
          <span className="smVersion">{logstash ? nodes[0]?.version : data!.nodes[0]?.version}</span>
        </div>
        {stale && <><EuiSpacer size="m" /><EuiCallOut title="Die Erfassung liefert keine aktuellen Daten" color="warning"><p>Letzte Messung: {new Date(latest.timestamp).toLocaleString('de-DE')}. Der Zustand ist historisch.</p></EuiCallOut></>}
        <EuiTabs className="smSectionTabs">{activeTabs.map(view =>
          <EuiTab key={view} isSelected={nav.view === view} onClick={() => navigate({ section: nav.section, view })}>
            {VIEW_NAMES[view]}{count(view) != null && <span className="smTabCount">{count(view)}</span>}
          </EuiTab>)}</EuiTabs>
        <EuiSpacer />
        {logstash && !nodes.length ? <EuiCallOut title="Kein lokales Logstash erreichbar" iconType="iInCircle">
          <p>Die automatische Erfassung liest die lokale Logstash-Monitoring-API auf 127.0.0.1:9600 am gewählten Cluster-Manager. Eine eigene Logstash-Instanz auf anderen Hosts wird nicht automatisch erkannt.</p>
        </EuiCallOut> : <>
          <div className="smSectionHeading">
            <div>
              {nav.entity && <EuiButtonEmpty size="xs" flush="left" iconType="arrowLeft" onClick={() => navigate({ section: nav.section, view: nav.view })}>Alle {VIEW_NAMES[nav.view]}</EuiButtonEmpty>}
              <EuiTitle size="m"><h2>{title}</h2></EuiTitle>
              {selected && <p className="smMuted">{selected.node_name}{selected.roles?.length ? ' · ' + selected.roles.join(', ') : ''}{selected.version ? ' · Version ' + selected.version : ''}</p>}
            </div>
            {(nav.view === 'overview' || nav.entity) && <EuiButtonEmpty size="s" onClick={() => setAdvanced(!advanced)}>{advanced ? 'Standardansicht' : 'Erweiterte Metriken'}</EuiButtonEmpty>}
          </div>
          <EuiSpacer size="m" />
          {nav.entity ? <>
            {!selected && !loading && <EuiCallOut title="Kein aktueller Messwert für diesen Eintrag" color="warning"><p>Der Eintrag ist im aktuellen Sample nicht vorhanden. Der Verlauf im gewählten Zeitraum bleibt abrufbar.</p></EuiCallOut>}
            {selected && <DetailStats metric={selected} />}
            <EuiSpacer />
            {loading ? <EuiLoadingSpinner size="l" /> : <MetricPanels points={data!.series} kind={kind} source={selected?.pipeline_source || (logstash ? 'logstash' : 'ingest')} advanced={advanced} />}
            {selected?.kind === 'pipeline' && <><EuiSpacer /><PipelineDetail metric={selected} /></>}
            {selected?.kind === 'node' && <><EuiSpacer /><EuiPanel paddingSize="m"><EuiText size="s"><p>
              JVM Heap: {bytes(selected.heap_used_bytes)} / {bytes(selected.heap_max_bytes)} ·
              Dateisystem frei: {bytes(selected.disk_available_bytes)} / {bytes(selected.disk_total_bytes)} ·
              GC-Zeit seit Start: {number(selected.gc_time_ms, ' ms')} · Ablehnungen: {number(selected.rejected_total)}
            </p></EuiText></EuiPanel></>}
          </> : nav.view === 'overview' ? <>
            <StatsStrip values={logstash ? [
              ['Nodes', number(nodes.length)], ['Pipelines', number(pipelines.length)],
              ['Events rein / s', number(nodes[0]?.events_in_rate)], ['Events raus / s', number(nodes[0]?.events_out_rate)],
              ['CPU', number(nodes[0]?.cpu_percent, ' %')], ['JVM Heap', number(nodes[0]?.heap_percent, ' %')],
            ] : [
              ['Nodes', number(latest.nodes)], ['Indizes', number(latest.indices)], ['Dokumente', number(latest.docs)],
              ['Primärdaten', bytes(latest.store_bytes)], ['Aktive Shards', number(latest.active_shards)], ['Nicht zugewiesen', number(latest.unassigned_shards)],
            ]} />
            <EuiSpacer />
            {loading ? <EuiLoadingSpinner size="l" /> : <MetricPanels points={data!.series} kind={logstash ? 'logstash' : 'cluster'} advanced={advanced} />}
            <EuiSpacer />
            <div className="smQuickLinks">{(logstash ? ['nodes', 'pipelines'] : ['nodes', 'indices', 'pipelines']).map(view =>
              <button key={view} className="smQuickLink" onClick={() => navigate({ section: nav.section, view: view as View })}>
                <strong>{number(count(view as View))}</strong><span>{view === 'pipelines' && !logstash ? 'Ingest-Pipelines' : VIEW_NAMES[view as View]}</span><span>Details ansehen →</span>
              </button>)}</div>
          </> : <EuiPanel paddingSize="l" className="smTablePanel">
            <EuiText size="s"><p className="smTableDescription">{nav.view === 'pipelines'
              ? logstash ? 'Logstash-Pipelines mit Durchsatz, Worker-Auslastung und Queue-Werten.' : 'OpenSearch-Ingest-Pipelines pro ausführendem Node. Pipelines erscheinen, sobald die Nodes-Stats sie melden.'
              : nav.view === 'nodes' ? 'Zustand und Leistung der Nodes. Auf einen Namen klicken, um den Verlauf zu öffnen.' : 'Indexierungs- und Suchleistung sowie primärer Speicher der Indizes.'}</p></EuiText>
            <EntityTable items={items} kind={nav.view as 'nodes' | 'indices' | 'pipelines'} logstash={logstash} onSelect={select} />
            {nav.view === 'indices' && latest.sampled_indices! < latest.indices! && <EuiText size="s"><p>Detailerfassung auf {latest.sampled_indices} von {latest.indices} Indizes begrenzt.</p></EuiText>}
          </EuiPanel>}
        </>}
        <EuiSpacer />
        <EuiText size="xs"><p className="smFootnote">Primärdaten und Indexierungsrate ohne Monitoring-Indizes. Suchraten zählen Shard-Abfragen. Verarbeitungszeiten sind mittlere Arbeitszeiten, keine Ende-zu-Ende-Latenz. Nach Neustarts und bei fehlenden Samples bleiben Raten zunächst leer.</p></EuiText>
      </>}
    </div>
  </main>;
}
