package de.allendorf.opensearch.monitoring;

import org.opensearch.cluster.routing.RecoverySource;
import org.opensearch.indices.recovery.RecoveryState;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Bounded snapshots of current shard-copy recoveries; not a complete recovery-event ledger. */
final class RecoveryDocuments {
    static final int LIMIT = 200;
    private RecoveryDocuments() {}

    static void add(Map<String, Object> summary, List<RecoveryState> states, long cutoff) {
        var relevant = states.stream().filter(state -> state.getStage() != RecoveryState.Stage.DONE
                || state.getTimer().stopTime() >= cutoff)
            .sorted(Comparator.comparing((RecoveryState state) -> state.getStage() == RecoveryState.Stage.DONE)
                .thenComparing(Comparator.comparingLong((RecoveryState state) -> state.getTimer().startTime()).reversed()))
            .toList();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (var state : relevant.subList(0, Math.min(LIMIT, relevant.size()))) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("index_name", state.getShardId().getIndexName());
            row.put("index_uuid", state.getShardId().getIndex().getUUID());
            row.put("shard_id", state.getShardId().id());
            row.put("primary", state.getPrimary());
            row.put("stage", state.getStage().toString());
            row.put("recovery_type", state.getRecoverySource().getType().toString());
            row.put("start_ms", state.getTimer().startTime());
            row.put("stop_ms", state.getTimer().stopTime());
            row.put("time_ms", state.getTimer().time());
            if (state.getSourceNode() != null) row.put("source_node", state.getSourceNode().getName());
            row.put("target_node", state.getTargetNode().getName());
            row.put("files_recovered", state.getIndex().recoveredFileCount());
            row.put("files_total", state.getIndex().totalRecoverFiles());
            row.put("files_reused", state.getIndex().reusedFileCount());
            row.put("bytes_recovered", state.getIndex().recoveredBytes());
            row.put("bytes_total", state.getIndex().totalRecoverBytes());
            if (state.getIndex().recoveredBytesPercent() >= 0) row.put("bytes_percent", state.getIndex().recoveredBytesPercent());
            row.put("translog_recovered", state.getTranslog().recoveredOperations());
            if (state.getTranslog().totalOperations() >= 0) row.put("translog_total", state.getTranslog().totalOperations());
            if (state.getRecoverySource() instanceof RecoverySource.SnapshotRecoverySource snapshot) {
                row.put("repository", snapshot.snapshot().getRepository());
                row.put("snapshot", snapshot.snapshot().getSnapshotId().getName());
            }
            rows.add(row);
        }
        summary.put("recoveries_available", true);
        summary.put("recovery_total", relevant.size());
        summary.put("recovery_sampled", rows.size());
        summary.put("recoveries", rows);
    }
}
