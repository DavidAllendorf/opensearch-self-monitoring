package de.allendorf.opensearch.monitoring;

import org.opensearch.action.admin.indices.stats.CommonStats;
import org.opensearch.action.admin.indices.stats.ShardStats;
import org.opensearch.cluster.ClusterState;
import org.opensearch.cluster.routing.ShardRouting;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Routing is authoritative for placement; missing or concurrently moved shard stats stay absent. */
final class NodeAllocations {
    static final int LIMIT = 10_000;
    private NodeAllocations() {}

    static Map<String, CommonStats> statsByAllocation(ShardStats[] stats) {
        Map<String, CommonStats> result = new HashMap<>();
        for (var shard : stats) result.put(key(shard.getShardRouting()), shard.getStats());
        return result;
    }

    static void add(Map<String, Object> node, ClusterState state, Map<String, CommonStats> stats) {
        var routingNode = state.getRoutingNodes().node((String) node.get("node_id"));
        List<ShardRouting> shards = new ArrayList<>();
        if (routingNode != null) routingNode.forEach(shards::add);
        shards.sort(Comparator.comparing(ShardRouting::getIndexName).thenComparingInt(ShardRouting::id)
            .thenComparing(shard -> !shard.primary()).thenComparing(NodeAllocations::key));
        summarize(node, shards, stats, state);
    }

    static void summarize(Map<String, Object> node, List<ShardRouting> shards,
                          Map<String, CommonStats> stats, ClusterState state) {
        var indices = new HashSet<String>();
        int primaries = 0;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (var shard : shards) {
            indices.add(shard.shardId().getIndex().getUUID());
            if (shard.primary()) primaries++;
            if (rows.size() == LIMIT) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("index_name", shard.getIndexName());
            row.put("index_uuid", shard.shardId().getIndex().getUUID());
            row.put("shard_id", shard.id());
            row.put("primary", shard.primary());
            row.put("state", shard.state().toString());
            row.put("allocation_id", shard.allocationId().getId());
            row.put("relocation_target", shard.isRelocationTarget());
            if (shard.relocatingNodeId() != null) {
                row.put("relocating_node_id", shard.relocatingNodeId());
                var peer = state.nodes().get(shard.relocatingNodeId());
                if (peer != null) row.put("relocating_node_name", peer.getName());
            }
            var counters = stats.get(key(shard));
            if (counters != null) {
                if (counters.getDocs() != null) row.put("docs", counters.getDocs().getCount());
                if (counters.getStore() != null) row.put("store_bytes", counters.getStore().getSizeInBytes());
            }
            rows.add(row);
        }
        node.put("allocation_shards", shards.size());
        node.put("allocation_primaries", primaries);
        node.put("allocation_replicas", shards.size() - primaries);
        node.put("allocation_indices", indices.size());
        node.put("allocation_sampled_shards", rows.size());
        node.put("allocations", rows);
    }

    private static String key(ShardRouting shard) {
        return shard.shardId().getIndex().getUUID() + ":" + shard.id() + ":" + shard.currentNodeId()
            + ":" + (shard.allocationId() == null ? "" : shard.allocationId().getId());
    }
}
