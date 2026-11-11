import React, { useMemo, useState } from 'react';
import {
  EuiBadge, EuiButtonEmpty, EuiCallOut, EuiFlexGroup, EuiFlexItem, EuiInMemoryTable,
  EuiPanel, EuiSelect, EuiSpacer, EuiTab, EuiTabs, EuiText,
} from '@elastic/eui';
import type { Metric, ShardAllocation } from '../../common/types';
import { bytes, number } from '../format';
import { nodeIndices, NodeIndex } from '../node_allocations';
import { StatsStrip } from './metric_panels';

interface Props {
  node: Metric;
  allocation: Metric | null;
  indexMetrics: Metric[];
  onIndex: (index: NodeIndex) => void;
  children: React.ReactNode;
}
export function NodeDetail({ node, allocation, indexMetrics, onIndex, children }: Props) {
  const [tab, setTab] = useState<'overview' | 'indices' | 'shards'>('overview');
  const [indexId, setIndexId] = useState('');
  const [role, setRole] = useState('');
  const [state, setState] = useState('');
  const [indexPage, setIndexPage] = useState({ index: 0, size: 10 });
  const [shardPage, setShardPage] = useState({ index: 0, size: 10 });
  const valid = allocation?.node_id === node.node_id && allocation?.timestamp === node.timestamp;
  const rows = valid ? allocation?.allocations || [] : [];
  const indices = useMemo(() => nodeIndices(rows), [rows]);
  const ready = valid && allocation?.allocations != null;
  const filtered = rows.filter(shard => (!indexId || shard.index_uuid === indexId)
    && (!role || shard.primary === (role === 'primary')) && (!state || shard.state === state));
  const numeric = (field: string, name: string) => ({ field, name, sortable: true, render: (value?: number) => number(value) });
  const indexColumns = [
    { field: 'index_name', name: 'Index auf diesem Node', sortable: true,
      render: (name: string, index: NodeIndex) => <EuiButtonEmpty size="xs" flush="left" onClick={() => { setIndexId(index.index_uuid); setShardPage(page => ({ ...page, index: 0 })); setTab('shards'); }}>{name}</EuiButtonEmpty> },
    numeric('shards', 'Shard-Kopien'), numeric('primaries', 'Primary'), numeric('replicas', 'Replica'),
    numeric('started', 'Gestartet'), numeric('initializing', 'Initialisierung'), numeric('relocating', 'Verschiebung'),
    numeric('docs', 'Lokale Dokumente'),
    { field: 'store_bytes', name: 'Lokale Daten', sortable: true, render: (value?: number) => bytes(value) },
    { name: 'Details', render: (index: NodeIndex) => indexMetrics.some(metric => metric.index_uuid === index.index_uuid)
      ? <EuiButtonEmpty size="xs" onClick={() => onIndex(index)}>Indexmetriken</EuiButtonEmpty> : <span className="smMuted">Keine Indexmetriken</span> },
  ];
  const shardColumns = [
    { field: 'index_name', name: 'Index', sortable: true },
    numeric('shard_id', 'Shard-ID'),
    { field: 'primary', name: 'Typ', sortable: true, render: (primary: boolean) => <EuiBadge color={primary ? 'primary' : 'hollow'}>{primary ? 'Primary (P)' : 'Replica (R)'}</EuiBadge> },
    { field: 'state', name: 'Zustand', sortable: true, render: (value: string) => <EuiBadge color={value === 'STARTED' ? 'success' : value === 'RELOCATING' ? 'primary' : 'warning'}>{value}</EuiBadge> },
    numeric('docs', 'Dokumente'),
    { field: 'store_bytes', name: 'Daten', sortable: true, render: (value?: number) => bytes(value) },
    { name: 'Verschiebung', render: (shard: ShardAllocation) => shard.relocating_node_id
      ? (shard.relocation_target ? 'Quelle: ' : 'Ziel: ') + (shard.relocating_node_name || shard.relocating_node_id) : '—' },
  ];
  return <>
    <EuiTabs>
      <EuiTab isSelected={tab === 'overview'} onClick={() => setTab('overview')}>Übersicht</EuiTab>
      <EuiTab isSelected={tab === 'indices'} onClick={() => setTab('indices')}>Indizes{ready ? ' (' + number(allocation?.allocation_indices) + ')' : ''}</EuiTab>
      <EuiTab isSelected={tab === 'shards'} onClick={() => setTab('shards')}>Shards{ready ? ' (' + number(allocation?.allocation_shards) + ')' : ''}</EuiTab>
    </EuiTabs>
    <EuiSpacer />
    {tab === 'overview' ? children : !ready ? <EuiCallOut title="Die Shard-Zuordnung ist für diese Messung noch nicht verfügbar">
      <p>Die Zuordnung wird ab Pluginversion 0.4.0 mit jeder Node-Messung erfasst. Nach einem Update bitte die nächste Messung abwarten.</p>
    </EuiCallOut> : <>
      <StatsStrip values={[
        ['Indizes auf dem Node', number(allocation?.allocation_indices)],
        ['Shard-Kopien', number(allocation?.allocation_shards)],
        ['Primary-Kopien', number(allocation?.allocation_primaries)],
        ['Replica-Kopien', number(allocation?.allocation_replicas)],
        ['Initialisierung', number(rows.filter(shard => shard.state === 'INITIALIZING').length)],
        ['Verschiebung', number(rows.filter(shard => shard.state === 'RELOCATING').length)],
      ]} />
      <EuiSpacer />
      {allocation!.allocation_sampled_shards! < allocation!.allocation_shards! && <>
        <EuiCallOut title="Shard-Details begrenzt" color="warning"><p>Es werden {number(allocation?.allocation_sampled_shards)} von {number(allocation?.allocation_shards)} Kopien angezeigt. Die Gesamtzähler für Indizes, Primary und Replica enthalten alle Kopien; Tabellen und Zustandszähler beziehen sich auf die erfassten Zeilen.</p></EuiCallOut><EuiSpacer />
      </>}
      <EuiPanel paddingSize="l">
        {tab === 'indices' ? <>
          <EuiText size="s"><p>Nur Indizes mit zugewiesenen Shard-Kopien auf {node.node_name}. Ein Klick auf den Index zeigt seine lokalen Shards.</p></EuiText>
          <EuiSpacer size="m" />
          <EuiInMemoryTable items={indices} columns={indexColumns} sorting
            pagination={{ pageIndex: Math.min(indexPage.index, Math.max(0, Math.ceil(indices.length / indexPage.size) - 1)), pageSize: indexPage.size, pageSizeOptions: [10, 25, 100] }}
            onTableChange={({ page }: { page?: { index: number; size: number } }) => { if (page) setIndexPage(page); }}
            search={{ box: { incremental: true, placeholder: 'Indizes auf diesem Node suchen …' }, onChange: () => { setIndexPage(page => ({ ...page, index: 0 })); return true; } }}
            message="Auf diesem Node liegen keine Shards." />
        </> : <>
          <EuiFlexGroup gutterSize="m" wrap>
            <EuiFlexItem><EuiSelect aria-label="Index filtern" value={indexId} onChange={event => { setIndexId(event.target.value); setShardPage(page => ({ ...page, index: 0 })); }}
              options={[{ value: '', text: 'Alle Indizes' }, ...indices.map(index => ({ value: index.index_uuid, text: index.index_name }))]} /></EuiFlexItem>
            <EuiFlexItem><EuiSelect aria-label="Shard-Typ filtern" value={role} onChange={event => { setRole(event.target.value); setShardPage(page => ({ ...page, index: 0 })); }}
              options={[{ value: '', text: 'Primary und Replica' }, { value: 'primary', text: 'Nur Primary' }, { value: 'replica', text: 'Nur Replica' }]} /></EuiFlexItem>
            <EuiFlexItem><EuiSelect aria-label="Shard-Zustand filtern" value={state} onChange={event => { setState(event.target.value); setShardPage(page => ({ ...page, index: 0 })); }}
              options={[{ value: '', text: 'Alle Zustände' }, ...['STARTED', 'INITIALIZING', 'RELOCATING'].map(value => ({ value, text: value }))]} /></EuiFlexItem>
          </EuiFlexGroup>
          <EuiSpacer />
          <EuiText size="s"><p>{number(filtered.length)} von {number(rows.length)} erfassten Shard-Kopien auf {node.node_name}.</p></EuiText>
          <EuiSpacer size="m" />
          <EuiInMemoryTable items={filtered} columns={shardColumns} sorting
            pagination={{ pageIndex: Math.min(shardPage.index, Math.max(0, Math.ceil(filtered.length / shardPage.size) - 1)), pageSize: shardPage.size, pageSizeOptions: [10, 25, 100] }}
            onTableChange={({ page }: { page?: { index: number; size: number } }) => { if (page) setShardPage(page); }}
            message="Keine Shard-Kopien für diese Filter." />
        </>}
      </EuiPanel>
      <EuiSpacer size="m" />
      <EuiText size="xs"><p>Routing-Stand: {new Date(allocation!.timestamp).toLocaleString('de-DE')}.
        System- und Monitoring-Indizes sind enthalten. Nicht zugewiesene Shards gehören zu keinem Node und erscheinen hier nicht.
        Während einer Verschiebung werden Quelle und initialisierendes Ziel jeweils auf ihrem Node angezeigt.
        Dokumente und Daten sind lokale Kopienwerte, keine clusterweiten Primärsummen. Fehlende Shard-Stats erscheinen als „—“.</p></EuiText>
    </>}
  </>;
}
