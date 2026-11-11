import ReactDOM from 'react-dom';
import type { AppMountParameters, CoreStart } from '../../../src/core/public';
import { MonitoringApp } from './components/monitoring_app';
import './styles.scss';

export function renderApp(core: CoreStart, params: AppMountParameters) {
  core.chrome.setBreadcrumbs([{ text: 'Stack Monitoring' }]);
  ReactDOM.render(<MonitoringApp http={core.http} />, params.element);
  return () => ReactDOM.unmountComponentAtNode(params.element);
}
