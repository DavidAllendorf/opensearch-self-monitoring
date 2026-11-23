import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { TopologyPage } from './topology_page';
import type { Overview } from '../../common/types';

describe('topology user interactions', () => {
  let container: HTMLDivElement;
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
  afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); });
  it('opens details, follows monitoring links, searches and zooms', () => {
    const metric = { timestamp: 10000, cluster_uuid: 'c', cluster_name: 'Cluster' };
    const data: Overview = { latest: { ...metric, kind: 'cluster', status: 'green' },
      nodes: [{ ...metric, kind: 'node', node_id: 'n', node_name: 'Node A', cpu_percent: 30 }],
      pipelines: [], logstashNodes: [], indices: [], series: [], allocationNode: null, intervalMs: 10000, serverTime: 12000 };
    const navigate = jest.fn();
    act(() => { ReactDOM.render(<TopologyPage data={data} navigate={navigate} />, container); });
    expect(container.querySelectorAll('.smTopologyNode')).toHaveLength(2);
    const node = Array.from(container.querySelectorAll<HTMLButtonElement>('.smTopologyNode')).find(button => button.textContent!.includes('Node A'))!;
    act(() => { Simulate.click(node); });
    expect(container.querySelector('.smTopologyDetails')!.textContent).toContain('Node-ID');
    const details = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent!.includes('Monitoring-Details öffnen'))!;
    act(() => { Simulate.click(details); });
    expect(navigate).toHaveBeenCalledWith({ section: 'opensearch', view: 'nodes', entity: 'n', label: 'Node A' });
    const zoom = container.querySelector<HTMLButtonElement>('[aria-label="Topologie vergrößern"]')!;
    act(() => { Simulate.click(zoom); });
    expect(container.textContent).toContain('125 %');
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Topologie durchsuchen"]')!;
    act(() => { input.value = 'not-found'; Simulate.change(input); });
    expect(container.querySelectorAll('.smTopologyNode')).toHaveLength(0);
    expect(container.textContent).toContain('Keine Komponenten für diesen Filter.');
  });
});
