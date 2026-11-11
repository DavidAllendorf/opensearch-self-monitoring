package de.allendorf.opensearch.monitoring;

import org.opensearch.action.admin.cluster.node.stats.NodeStats;
import org.opensearch.action.admin.indices.stats.CommonStats;
import org.opensearch.action.admin.indices.stats.IndexStats;
import java.util.LinkedHashMap;
import java.util.Map;

/** A small, versioned schema instead of persisting the entire evolving stats response. */
final class MetricDocuments {
    private MetricDocuments() {}

    static Map<String, Object> base(String kind, long now, String clusterId, String clusterName) {
        Map<String, Object> doc = new LinkedHashMap<>();
        doc.put("schema_version", 2);
        doc.put("timestamp", now);
        doc.put("kind", kind);
        doc.put("cluster_uuid", clusterId);
        doc.put("cluster_name", clusterName);
        return doc;
    }

    static void indexCounters(Map<String, Object> doc, CommonStats primary, CommonStats total) {
        doc.put("docs", primary.getDocs() == null ? 0L : primary.getDocs().getCount());
        doc.put("store_bytes", primary.getStore() == null ? 0L : primary.getStore().getSizeInBytes());
        doc.put("index_total", primary.getIndexing() == null ? 0L : primary.getIndexing().getTotal().getIndexCount());
        doc.put("index_time_ms", primary.getIndexing() == null ? 0L : primary.getIndexing().getTotal().getIndexTime().millis());
        doc.put("search_total", total.getSearch() == null ? 0L : total.getSearch().getTotal().getQueryCount());
        doc.put("search_time_ms", total.getSearch() == null ? 0L : total.getSearch().getTotal().getQueryTime().millis());
    }

    static Map<String, Object> index(IndexStats index, long now, String clusterId, String clusterName) {
        Map<String, Object> doc = base("index", now, clusterId, clusterName);
        doc.put("index_name", index.getIndex());
        doc.put("index_uuid", index.getUuid());
        doc.put("shards", index.getShards().length);
        indexCounters(doc, index.getPrimaries(), index.getTotal());
        return doc;
    }

    static Map<String, Object> node(NodeStats node, long now, String clusterId, String clusterName) {
        Map<String, Object> doc = base("node", now, clusterId, clusterName);
        doc.put("node_id", node.getNode().getId());
        doc.put("node_name", node.getNode().getName());
        doc.put("roles", node.getNode().getRoles().stream().map(role -> role.roleName()).sorted().toList());
        doc.put("version", node.getNode().getVersion().toString());
        doc.put("cpu_percent", node.getOs().getCpu().getPercent());
        doc.put("heap_percent", node.getJvm().getMem().getHeapUsedPercent());
        doc.put("heap_used_bytes", node.getJvm().getMem().getHeapUsed().getBytes());
        doc.put("heap_max_bytes", node.getJvm().getMem().getHeapMax().getBytes());
        doc.put("uptime_ms", node.getJvm().getUptime().millis());
        doc.put("disk_total_bytes", node.getFs().getTotal().getTotal().getBytes());
        doc.put("disk_available_bytes", node.getFs().getTotal().getAvailable().getBytes());
        var stats = node.getIndices();
        doc.put("docs", stats.getDocs().getCount());
        doc.put("store_bytes", stats.getStore().getSizeInBytes());
        doc.put("index_total", stats.getIndexing().getTotal().getIndexCount());
        doc.put("index_time_ms", stats.getIndexing().getTotal().getIndexTime().millis());
        doc.put("search_total", stats.getSearch().getTotal().getQueryCount());
        doc.put("search_time_ms", stats.getSearch().getTotal().getQueryTime().millis());
        long rejected = 0, queue = 0;
        for (var pool : node.getThreadPool()) { rejected += pool.getRejected(); queue += pool.getQueue(); }
        doc.put("rejected_total", rejected);
        doc.put("thread_pool_queue", queue);
        long gcMillis = 0;
        for (var gc : node.getJvm().getGc()) gcMillis += gc.getCollectionTime().millis();
        doc.put("gc_time_ms", gcMillis);
        return doc;
    }

    static void rates(Map<String, Object> current, Map<String, Object> previous) {
        long elapsed = previous == null ? 0 : number(current, "timestamp") - number(previous, "timestamp");
        // Node counters are scoped to a JVM; a restart invalidates even an increasing counter.
        if (previous != null && current.containsKey("uptime_ms") && number(current, "uptime_ms") < number(previous, "uptime_ms")) previous = null;
        if (previous != null && current.containsKey("counter_epoch") && !current.get("counter_epoch").equals(previous.get("counter_epoch"))) previous = null;
        for (String kind : new String[]{"index", "search"}) {
            Long oldCount = previous == null ? null : number(previous, kind + "_total");
            Long oldTime = previous == null ? null : number(previous, kind + "_time_ms");
            current.put(kind + "_rate", MetricMath.rate(number(current, kind + "_total"), oldCount, elapsed));
            current.put(kind + "_latency_ms", MetricMath.latency(number(current, kind + "_time_ms"), oldTime, number(current, kind + "_total"), oldCount));
        }
        for (String field : new String[]{"events_in", "events_out", "events_failed"}) {
            if (!current.containsKey(field + "_total")) continue;
            current.put(field + "_rate", MetricMath.rate(number(current, field + "_total"),
                previous == null ? null : number(previous, field + "_total"), elapsed));
        }
        if (current.containsKey("events_time_ms")) current.put("events_latency_ms", MetricMath.latency(
            number(current, "events_time_ms"), previous == null ? null : number(previous, "events_time_ms"),
            number(current, "events_in_total"), previous == null ? null : number(previous, "events_in_total")));
    }

    static long number(Map<String, Object> doc, String key) { return ((Number) doc.getOrDefault(key, 0)).longValue(); }
}
