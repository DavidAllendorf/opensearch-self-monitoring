import type { Metric } from '../common/types';

export function logstashTotal(nodes: Metric[], field: 'events_in_rate' | 'events_out_rate' | 'cpu_percent' | 'heap_percent', average = false): number | null {
  const values = nodes.map(node => node[field]);
  if (!values.length || values.some(value => value == null)) return null;
  const sum = values.reduce<number>((total, value) => total + (value as number), 0);
  return average ? sum / values.length : sum;
}
