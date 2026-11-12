package de.allendorf.opensearch.monitoring;

import org.junit.jupiter.api.Test;
import org.opensearch.Version;
import org.opensearch.cluster.node.DiscoveryNode;
import org.opensearch.cluster.routing.RecoverySource;
import org.opensearch.cluster.routing.ShardRouting;
import org.opensearch.cluster.routing.UnassignedInfo;
import org.opensearch.core.common.transport.TransportAddress;
import org.opensearch.core.index.shard.ShardId;
import org.opensearch.indices.recovery.RecoveryState;
import java.net.InetAddress;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;

class RecoveryDocumentsTest {
    private RecoveryState recovery(boolean done) {
        var node = new DiscoveryNode("target", "target-id", new TransportAddress(InetAddress.getLoopbackAddress(), 9300), Map.of(), Set.of(), Version.CURRENT);
        var routing = ShardRouting.newUnassigned(new ShardId("logs", "uuid", 0), true,
            RecoverySource.EmptyStoreRecoverySource.INSTANCE, new UnassignedInfo(UnassignedInfo.Reason.INDEX_CREATED, "test"))
            .initialize("target-id", null, -1);
        var state = new RecoveryState(routing, node, null);
        if (done) for (var stage : List.of(RecoveryState.Stage.INDEX, RecoveryState.Stage.VERIFY_INDEX,
                RecoveryState.Stage.TRANSLOG, RecoveryState.Stage.FINALIZE, RecoveryState.Stage.DONE)) {
            if (stage == RecoveryState.Stage.FINALIZE) state.getIndex().setFileDetailsComplete();
            state.setStage(stage);
        }
        return state;
    }
    @Test void exportsProgressWithoutFileNamesOrInventedTranslogTotals() {
        var state = recovery(false);
        state.getIndex().addFileDetail("private-segment-name", 100, false);
        state.getIndex().addRecoveredBytesToFile("private-segment-name", 20);
        Map<String, Object> summary = new HashMap<>();
        RecoveryDocuments.add(summary, List.of(state), 0);
        var row = (Map<?, ?>) ((List<?>) summary.get("recoveries")).get(0);
        assertEquals(true, row.get("primary"));
        assertEquals("target", row.get("target_node"));
        assertEquals(100L, row.get("bytes_total"));
        assertEquals(20L, row.get("bytes_recovered"));
        assertFalse(row.containsKey("translog_total"));
        assertFalse(row.toString().contains("private-segment-name"));
    }
    @Test void keepsActiveRecoveriesBeforeCompletedRowsWhenBounded() {
        var states = new ArrayList<>(java.util.Collections.nCopies(RecoveryDocuments.LIMIT, recovery(true)));
        states.add(recovery(false));
        Map<String, Object> summary = new HashMap<>();
        RecoveryDocuments.add(summary, states, 0);
        assertEquals(RecoveryDocuments.LIMIT + 1, summary.get("recovery_total"));
        assertEquals(RecoveryDocuments.LIMIT, summary.get("recovery_sampled"));
        assertEquals("INIT", ((Map<?, ?>) ((List<?>) summary.get("recoveries")).get(0)).get("stage"));
        RecoveryDocuments.add(summary, states, System.currentTimeMillis() + 1000);
        assertEquals(1, summary.get("recovery_total"));
    }
}
