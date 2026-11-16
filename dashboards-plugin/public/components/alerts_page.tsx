import React, { useState } from 'react';
import { EuiBadge, EuiButtonEmpty, EuiCallOut, EuiInMemoryTable, EuiPanel, EuiSelect, EuiSpacer, EuiText, EuiTitle } from '@elastic/eui';
import type { Overview } from '../../common/types';
import { ALERT_RULES, evaluateAlerts, MonitoringAlert } from '../alerts';
import type { Navigation, Section } from '../navigation';
import { StatsStrip } from './metric_panels';

export function AlertsPage({ data, section, navigate }: { data: Overview; section: Section; navigate: (target: Navigation) => void }) {
  const [severity, setSeverity] = useState('all');
  const report = evaluateAlerts(data, section);
  const critical = report.alerts.filter(alert => alert.severity === 'critical').length;
  const items = report.alerts.filter(alert => severity === 'all' || alert.severity === severity);
  const columns = [
    { field: 'severity', name: 'Schweregrad', width: '110px', render: (_: string, alert: MonitoringAlert) =>
      <EuiBadge color={alert.severity === 'critical' ? 'danger' : 'warning'}>{alert.severity === 'critical' ? 'Kritisch' : 'Warnung'}</EuiBadge> },
    { field: 'title', name: 'Hinweis', render: (_: string, alert: MonitoringAlert) => <div className="smRecoveryCell"><strong>{alert.title}</strong><span className="smCellMeta">{alert.entity}</span></div> },
    { field: 'observation', name: 'Messwert / Auslöser' },
    { field: 'action', name: 'Empfohlene Prüfung', render: (_: string, alert: MonitoringAlert) => <div className="smRecoveryCell">{alert.action}
      {alert.target && <div><EuiButtonEmpty size="xs" flush="left" onClick={() => navigate(alert.target!)}>Details ansehen →</EuiButtonEmpty></div>}</div> },
  ];
  return <>
    <EuiTitle size="m"><h2>Alerts</h2></EuiTitle>
    <EuiText size="s"><p className="smTableDescription">Aktuelle Hinweise für {section === 'opensearch' ? 'OpenSearch' : 'Logstash'}. Die Auswertung aktualisiert sich mit den Messwerten. Hinweise verschwinden, sobald die Bedingung nicht mehr erfüllt ist; es gibt keine Alarmhistorie oder Benachrichtigungen.</p></EuiText>
    <div className="smAlertStats"><StatsStrip values={[["Kritisch", String(critical)], ["Warnungen", String(report.alerts.length - critical)], ["Aktive Hinweise", String(report.alerts.length)]]} /></div>
    <EuiSpacer size="m" />
    {!!report.notes.length && <><EuiCallOut title="Grenzen der Auswertung" color="warning" iconType="iInCircle"><ul>{report.notes.map(note => <li key={note}>{note}</li>)}</ul></EuiCallOut><EuiSpacer size="m" /></>}
    {!report.alerts.length && <><EuiCallOut title="Keine Regel ausgelöst" color="success"><p>Die verfügbaren Messwerte überschreiten derzeit keine Schwelle. Fehlende Messwerte werden nicht als gesund bewertet.</p></EuiCallOut><EuiSpacer size="m" /></>}
    <EuiPanel paddingSize="m">
      <div className="smAlertToolbar"><EuiSelect aria-label="Alerts nach Schweregrad filtern" value={severity} onChange={event => setSeverity(event.target.value)} options={[
        { value: 'all', text: 'Alle Schweregrade' }, { value: 'critical', text: 'Nur kritisch' }, { value: 'warning', text: 'Nur Warnungen' },
      ]} /></div>
      <EuiInMemoryTable compressed items={items} columns={columns} itemId="id"
        pagination={{ initialPageSize: 10, pageSizeOptions: [10, 25, 100] }}
        search={{ box: { incremental: true, placeholder: 'Hinweise, Nodes oder Pipelines suchen …' } }}
        message={report.alerts.length ? 'Keine Hinweise für diesen Filter.' : 'Keine aktiven Hinweise.'} />
    </EuiPanel>
    <EuiSpacer size="m" />
    <details className="smAlertRules"><summary>Regeln und Schwellenwerte</summary><dl>{ALERT_RULES.map(([name, rule]) => <React.Fragment key={name}><dt>{name}</dt><dd>{rule}</dd></React.Fragment>)}</dl>
      <p>Feste, im Code dokumentierte Regeln; Anomalien verwenden den ausgewählten Zeitraum und aggregierte Intervalle. Momentaufnahmen sind keine dauerhafte Zustandsprüfung. Prozentwerte werden ohne Rundung verglichen.</p></details>
  </>;
}
