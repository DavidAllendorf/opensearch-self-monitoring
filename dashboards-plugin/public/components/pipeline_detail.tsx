import React from 'react';
import { EuiBadge, EuiPanel, EuiText, EuiTitle } from '@elastic/eui';
import type { Metric } from '../../common/types';
import { bytes, number } from '../format';

/** API metrics identify plugin stages, not conditional edges; do not invent a pipeline graph. */
export function PipelineDetail({ metric }: { metric: Metric }) {
  const ingest = metric.pipeline_source === 'ingest';
  const stages = ingest ? [['processor', 'Prozessoren']] : [['inputs', 'Inputs'], ['filters', 'Filter'], ['outputs', 'Outputs']];
  return <EuiPanel paddingSize="l" className="smPipelinePanel">
    <EuiTitle size="s"><h2>Pipeline · {metric.pipeline_id}</h2></EuiTitle>
    <EuiText size="s"><p>{ingest ? 'OpenSearch Ingest' : 'Logstash'} auf {metric.node_name}
      {!ingest && <> · {number(metric.pipeline_workers)} Worker · Batch {number(metric.pipeline_batch_size)} · Queue {metric.queue_type || '—'} ({bytes(metric.queue_bytes)})</>}
    </p></EuiText>
    <div className={ingest ? 'smProcessorList' : 'smPipelineStages'}>{stages.map(([stage, label]) =>
      <section key={stage} className="smPipelineStage">
        <h3>{label}</h3>
        {(metric.processors || []).filter(processor => processor.stage === stage).map((processor, index) =>
          <article className="smProcessor" key={processor.name + ':' + index}>
            <EuiBadge color="hollow">{processor.type}</EuiBadge>
            <p className="smProcessorId" title={processor.name}>{processor.name}</p>
            <dl><dt>Events raus</dt><dd>{number(processor.events_out)}</dd>
              <dt>Zeit gesamt</dt><dd>{number(processor.time_ms, ' ms')}</dd>
              {processor.failed != null && <><dt>Fehler gesamt</dt><dd>{number(processor.failed)}</dd></>}
            </dl>
          </article>)}
        {!(metric.processors || []).some(processor => processor.stage === stage) && <p className="smMuted">Keine {label} vorhanden.</p>}
      </section>)}</div>
    <EuiText size="xs"><p>Reihenfolge innerhalb einer Stufe entspricht der Stats-API. Bedingungen und Verzweigungen werden von dieser API nicht geliefert. Maximal 200 Komponenten je Pipeline.</p></EuiText>
  </EuiPanel>;
}
