package de.allendorf.opensearch.monitoring;

import org.junit.jupiter.api.Test;
import org.opensearch.cluster.ClusterState;
import org.opensearch.cluster.routing.RecoverySource;
import org.opensearch.cluster.routing.ShardRouting;
import org.opensearch.cluster.routing.UnassignedInfo;
import org.opensearch.core.index.shard.ShardId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class NodeAllocationsTest {
    private ShardRouting started(int id, boolean primary) {
        return ShardRouting.newUnassigned(new ShardId("logs", "index-uuid", id), primary,
            primary ? RecoverySource.EmptyStoreRecoverySource.INSTANCE : RecoverySource.PeerRecoverySource.INSTANCE,
            new UnassignedInfo(UnassignedInfo.Reason.INDEX_CREATED, "test"))
            .initialize("node-a", null, -1).moveToStarted();
    }

    @Test void distinguishesPrimaryReplicaAndRelocationTargetWithoutInventingStats() {
        var source = started(0, true).relocate("node-b", -1);
        Map<String, Object> node = new HashMap<>();
        NodeAllocations.summarize(node, List.of(source, started(1, false)), Map.of(), ClusterState.EMPTY_STATE);
        assertEquals(2, node.get("allocation_shards"));
        assertEquals(1, node.get("allocation_primaries"));
        assertEquals(1, node.get("allocation_replicas"));
        assertEquals(1, node.get("allocation_indices"));
        var rows = (List<?>) node.get("allocations");
        var first = (Map<?, ?>) rows.get(0);
        assertEquals("RELOCATING", first.get("state"));
        assertEquals("node-b", first.get("relocating_node_id"));
        assertFalse(first.containsKey("docs"));
        assertFalse(first.containsKey("store_bytes"));

        NodeAllocations.summarize(node, List.of(source.getTargetRelocatingShard()), Map.of(), ClusterState.EMPTY_STATE);
        var target = (Map<?, ?>) ((List<?>) node.get("allocations")).get(0);
        assertEquals("INITIALIZING", target.get("state"));
        assertEquals(true, target.get("relocation_target"));
        assertEquals("node-a", target.get("relocating_node_id"));
    }

    @Test void rowLimitDoesNotTruncateSummaryCounts() {
        var shards = new ArrayList<ShardRouting>();
        for (int id = 0; id <= NodeAllocations.LIMIT; id++) shards.add(started(id, true));
        Map<String, Object> node = new HashMap<>();
        NodeAllocations.summarize(node, shards, Map.of(), ClusterState.EMPTY_STATE);
        assertEquals(NodeAllocations.LIMIT + 1, node.get("allocation_shards"));
        assertEquals(NodeAllocations.LIMIT + 1, node.get("allocation_primaries"));
        assertEquals(NodeAllocations.LIMIT, ((List<?>) node.get("allocations")).size());
    }
}
