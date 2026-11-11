import type { AppMountParameters, CoreSetup, CoreStart, Plugin } from '../../../src/core/public';
import { DEFAULT_NAV_GROUPS } from '../../../src/core/public';

export class StackMonitoringPlugin implements Plugin {
  public setup(core: CoreSetup) {
    core.application.register({
      id: 'stackMonitoring',
      title: 'Stack Monitoring',
      category: { id: 'management', label: 'Management', order: 9000 },
      order: 9000,
      async mount(params: AppMountParameters) {
        const [start] = await core.getStartServices();
        const { renderApp } = await import('./render_app');
        return renderApp(start as CoreStart, params);
      },
    });
    core.chrome.navGroup.addNavLinksToGroup(DEFAULT_NAV_GROUPS.dataAdministration, [
      { id: 'stackMonitoring', order: 20 },
    ]);
  }
  public start() {}
  public stop() {}
}
