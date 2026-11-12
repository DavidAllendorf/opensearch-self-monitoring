import React, { useState } from 'react';
import { EuiBadge, EuiCallOut, EuiInMemoryTable, EuiPanel, EuiSpacer, EuiSwitch, EuiText, EuiTitle } from '@elastic/eui';
import type { Metric, ShardRecovery } from '../../common/types';
import { bytes, number } from '../format';
import { visibleRecoveries } from '../recoveries';

export function ShardActivity({ latest, minutes, serverTime }: { latest: Metric; minutes: number; serverTime: number }) {
  const [activeOnly, setActiveOnly] = useState(false);
  const [page, setPage] = useState({ index: 0, size: 5 });
  const rows = visibleRecoveries(latest.recoveries || [], minutes, serverTime, activeOnly);
  const columns = [
    { field: 'index_name', name: 'Index / Shard', sortable: true, render: (name: string, row: ShardRecovery) => <div className="smRecoveryCell">
      <span>{name}</span><small className="smCellMeta">Shard {row.shard_id} · {row.primary ? 'Primary (P)' : 'Replica (R)'}</small></div> },
    { field: 'stage', name: 'Phase', sortable: true, render: (stage: string, row: ShardRecovery) => <div className="smRecoveryCell">
      <EuiBadge color={stage === 'DONE' ? 'success' : 'warning'}>{stage}</EuiBadge><small className="smCellMeta">{row.recovery_type}</small></div> },
    { field: 'time_ms', name: 'Dauer', sortable: true, render: (value: number, row: ShardRecovery) => <div className="smRecoveryCell">
      {value < 1000 ? number(value, ' ms') : number(value / 1000, ' s')}
      <small className="smCellMeta">Start {new Date(row.start_ms).toLocaleTimeString('de-DE')}</small></div> },
    { name: 'Quelle → Ziel', render: (row: ShardRecovery) => <div className="smRecoveryCell">
      <span>{row.source_node || (row.snapshot ? 'Snapshot' : 'Lokaler Speicher')} → {row.target_node}</span>
      {row.repository && <small className="smCellMeta">{row.repository} / {row.snapshot}</small>}</div> },
    { name: 'Dateien', render: (row: ShardRecovery) => <div className="smRecoveryCell">{number(row.files_recovered)} / {number(row.files_total)}
      <small className="smCellMeta">{number(row.files_reused)} wiederverwendet</small></div> },
    { name: 'Bytes', render: (row: ShardRecovery) => <div className="smRecoveryCell">{bytes(row.bytes_recovered)} / {bytes(row.bytes_total)}
      <small className="smCellMeta">{number(row.bytes_percent, ' %')}</small></div> },
    { name: 'Translog', render: (row: ShardRecovery) => <div className="smRecoveryCell">{number(row.translog_recovered)} / {number(row.translog_total)}</div> },
  ];
  return <EuiPanel paddingSize="m" className="smShardActivity">
    <div className="smSectionHeading"><EuiTitle size="s"><h2>Shard Activity</h2></EuiTitle>
      <EuiSwitch compressed label="Nur laufende Recoveries" checked={activeOnly} onChange={event => { setActiveOnly(event.target.checked); setPage(value => ({ ...value, index: 0 })); }} /></div>
    <div className="smShardSummary">
      <span>Aktiv <strong>{number(latest.active_shards)}</strong></span>
      <span>Primary <strong>{number(latest.active_primary_shards)}</strong></span>
      <span>Initialisierung <strong>{number(latest.initializing_shards)}</strong></span>
      <span>Verschiebung <strong>{number(latest.relocating_shards)}</strong></span>
      <span>Nicht zugewiesen <strong>{number(latest.unassigned_shards)}</strong></span>
    </div>
    {latest.recoveries_available !== true ? <EuiCallOut size="s" title="Recovery-Messwerte sind für dieses Sample noch nicht verfügbar" color="warning" /> : <>
      <EuiInMemoryTable compressed items={rows} columns={columns} sorting
        pagination={{ pageIndex: Math.min(page.index, Math.max(0, Math.ceil(rows.length / page.size) - 1)), pageSize: page.size, pageSizeOptions: [5, 10, 25] }}
        onTableChange={({ page: next }: { page?: { index: number; size: number } }) => { if (next) setPage(next); }}
        message={activeOnly ? 'Keine laufenden Shard-Recoveries.' : 'Keine laufenden oder im gewählten Zeitraum abgeschlossenen Recoveries.'} />
      {latest.recovery_sampled! < latest.recovery_total! && <><EuiSpacer size="s" /><EuiText size="xs"><p>Recovery-Details auf {latest.recovery_sampled} von {latest.recovery_total} Einträgen begrenzt; laufende Recoveries haben Vorrang.</p></EuiText></>}
    </>}
    <EuiText size="xs"><p className="smFootnote">Laufende Recoveries und letzte abgeschlossene Recoveries je aktueller Shard-Kopie. Abgeschlossene Einträge werden nach dem gewählten Zeitraum gefiltert. Übertragungswerte schließen wiederverwendete Dateien aus; keine vollständige Ereignishistorie.</p></EuiText>
  </EuiPanel>;
}
