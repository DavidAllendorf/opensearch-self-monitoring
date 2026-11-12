import type { ShardRecovery } from '../common/types';

export function visibleRecoveries(rows: ShardRecovery[], minutes: number, now: number, activeOnly: boolean): ShardRecovery[] {
  return rows.filter(row => row.stage !== 'DONE' || (!activeOnly && row.stop_ms >= now - minutes * 60000));
}
