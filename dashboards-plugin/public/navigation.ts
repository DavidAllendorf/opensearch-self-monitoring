import type { Metric, MetricKind } from '../common/types';

export type Section = 'opensearch' | 'logstash';
export type View = 'overview' | 'nodes' | 'indices' | 'pipelines' | 'alerts' | 'topology';
export interface Navigation { section: Section; view: View; entity?: string; label?: string; }

export function parseNavigation(hash: string): Navigation {
  const [path, query] = hash.replace(/^#\/?/, '').split('?');
  const [section, view] = path.split('/');
  const validSection = section === 'logstash' ? 'logstash' : 'opensearch';
  const validView = ['overview', 'nodes', 'pipelines', 'alerts', 'topology', ...(validSection === 'opensearch' ? ['indices'] : [])].includes(view) ? view as View : 'overview';
  const params = new URLSearchParams(query);
  const globalView = validView === 'alerts' || validView === 'topology';
  return { section: validSection, view: validView, entity: globalView ? undefined : params.get('entity') || undefined, label: globalView ? undefined : params.get('label') || undefined };
}

export function navigationHash(value: Navigation): string {
  const params = new URLSearchParams();
  if (value.entity) params.set('entity', value.entity);
  if (value.label) params.set('label', value.label);
  return '#/' + value.section + '/' + value.view + (params.toString() ? '?' + params : '');
}

export function historyKind(nav: Navigation): MetricKind {
  if (nav.view === 'topology') return 'cluster';
  if (nav.entity) return nav.view === 'pipelines' ? 'pipeline' : nav.view === 'indices' ? 'index' : nav.section === 'logstash' ? 'logstash' : 'node';
  return nav.section === 'logstash' ? 'logstash' : 'cluster';
}

export function entityId(metric: Metric): string {
  return metric.pipeline_uid || metric.index_uuid || metric.node_id || '';
}

export function entityName(metric: Metric): string {
  return metric.pipeline_id || metric.index_name || metric.node_name || '';
}
