import { StackMonitoringServerPlugin } from './plugin';
import type { PluginInitializerContext } from '../../../src/core/server';
import { configSchema } from './config';
export const config = { schema: configSchema };
export function plugin(context: PluginInitializerContext) { return new StackMonitoringServerPlugin(context); }
