import React from 'react';
import { EuiBadge, EuiButtonEmpty, EuiInMemoryTable, EuiText } from '@elastic/eui';
import type { Metric } from '../../common/types';
import { bytes, number } from '../format';
import { entityName } from '../navigation';

interface Props { items: Metric[]; kind: 'nodes' | 'indices' | 'pipelines'; logstash?: boolean; onSelect: (metric: Metric) => void; }
export function EntityTable({ items, kind, logstash, onSelect }: Props) {
  const pipeline = kind === 'pipelines';
  const numeric = (field: string, name: string, unit = '') => ({
    field, name, sortable: true, render: (value?: number | null) => number(value, unit),
  });
  const columns = [
    { field: pipeline ? 'pipeline_id' : kind === 'indices' ? 'index_name' : 'node_name',
      name: pipeline ? 'Pipeline' : kind === 'indices' ? 'Index' : 'Node', sortable: true,
      render: (_: string, metric: Metric) => <EuiButtonEmpty size="xs" flush="left" onClick={() => onSelect(metric)}>{entityName(metric)}</EuiButtonEmpty> },
    ...(pipeline ? [
      { field: 'node_name', name: 'Node', sortable: true },
      numeric('events_in_rate', 'Events rein / s'), numeric('events_out_rate', 'Events raus / s'),
      numeric('events_latency_ms', 'Zeit / Event', ' ms'),
      ...(logstash ? [numeric('worker_utilization', 'Worker', ' %'), numeric('queue_events', 'Queue Events')]
        : [numeric('events_failed_total', 'Fehler gesamt'), numeric('events_current', 'In Bearbeitung')]),
    ] : logstash ? [
      { field: 'status', name: 'Status', render: (value: string) => <EuiBadge color={value === 'green' ? 'success' : 'warning'}>{value || '—'}</EuiBadge> },
      { field: 'version', name: 'Version' }, numeric('events_in_rate', 'Events rein / s'),
      numeric('events_out_rate', 'Events raus / s'), numeric('cpu_percent', 'CPU', ' %'), numeric('heap_percent', 'JVM Heap', ' %'),
    ] : [
      ...(kind === 'indices' ? [{ field: 'status', name: 'Status', render: (value?: string) => <EuiBadge color={value === 'green' ? 'success' : value === 'red' ? 'danger' : 'warning'}>{value || '—'}</EuiBadge> }] : []),
      numeric('docs', 'Dokumente'),
      { field: 'store_bytes', name: 'Daten', sortable: true, render: (value?: number) => bytes(value) },
      numeric('index_rate', 'Indexierung / s'), numeric('search_rate', 'Suche / s'),
      ...(kind === 'nodes' ? [
        numeric('cpu_percent', 'CPU', ' %'), numeric('heap_percent', 'JVM Heap', ' %'),
        numeric('thread_pool_queue', 'Queue'),
      ] : [numeric('shards', 'Shards'), numeric('index_latency_ms', 'Indexierung', ' ms')]),
    ]),
  ];
  return <>
    <EuiInMemoryTable items={items} columns={columns} sorting
      pagination={{ initialPageSize: 10, pageSizeOptions: [10, 25, 100] }}
      search={{ box: { incremental: true, placeholder: pipeline ? 'Pipelines oder Nodes suchen …' : 'Nach Name suchen …' } }}
      message={pipeline ? 'Keine Pipelines in der aktuellen Messung vorhanden.' : 'Keine Einträge in der aktuellen Messung vorhanden.'} />
    {pipeline && <EuiText size="xs"><p>Eine Zeile je Pipeline und ausführendem Node. Zähler gelten seit dem jeweiligen Start; fehlende Raten erscheinen als „—“.</p></EuiText>}
  </>;
}
