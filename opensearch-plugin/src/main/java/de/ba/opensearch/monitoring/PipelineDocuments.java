package de.ba.opensearch.monitoring;

import org.opensearch.action.admin.cluster.node.stats.NodeStats;
import org.opensearch.common.metrics.OperationStats;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Explicit, bounded pipeline documents; never persist pipeline configuration or credentials. */
final class PipelineDocuments {
    static final int LIMIT = 1000;
    private PipelineDocuments() {}

    static List<Map<String, Object>> ingest(NodeStats node, long now, String clusterId, String clusterName) {
        List<Map<String, Object>> documents = new ArrayList<>();
        if (node.getIngestStats() == null) return documents;
        for (var pipeline : node.getIngestStats().getPipelineStats()) {
            if (documents.size() == LIMIT) break;
            var doc = MetricDocuments.base("pipeline", now, clusterId, clusterName);
            doc.put("pipeline_source", "ingest");
            doc.put("pipeline_id", pipeline.getPipelineId());
            doc.put("pipeline_uid", "ingest:" + node.getNode().getId() + ":" + pipeline.getPipelineId());
            doc.put("node_id", node.getNode().getId());
            doc.put("node_name", node.getNode().getName());
            doc.put("uptime_ms", node.getJvm().getUptime().millis());
            counters(doc, pipeline.getStats());
            List<Map<String, Object>> processors = new ArrayList<>();
            for (var processor : node.getIngestStats().getProcessorStats().getOrDefault(pipeline.getPipelineId(), List.of())) {
                if (processors.size() == 200) break;
                var metric = new java.util.LinkedHashMap<String, Object>();
                metric.put("name", processor.getName());
                metric.put("type", processor.getType());
                metric.put("stage", "processor");
                metric.put("events_out", Math.max(0L, processor.getStats().getCount() - processor.getStats().getFailedCount()));
                metric.put("failed", processor.getStats().getFailedCount());
                metric.put("time_ms", millis(processor.getStats()));
                processors.add(metric);
            }
            doc.put("processors", processors);
            documents.add(doc);
        }
        return documents;
    }

    private static void counters(Map<String, Object> doc, OperationStats stats) {
        doc.put("events_in_total", stats.getCount());
        doc.put("events_out_total", Math.max(0L, stats.getCount() - stats.getFailedCount()));
        doc.put("events_time_ms", millis(stats));
        doc.put("events_failed_total", stats.getFailedCount());
        doc.put("events_current", stats.getCurrent());
    }

    private static long millis(OperationStats stats) {
        return stats.getTimeUnit().toMillis(stats.getTotalTime());
    }

    static List<Map<String, Object>> logstash(Map<String, Object> stats, long now, String clusterId, String clusterName) {
        List<Map<String, Object>> documents = new ArrayList<>();
        String nodeId = text(stats, "id");
        var node = MetricDocuments.base("logstash", now, clusterId, clusterName);
        node.put("node_id", nodeId);
        node.put("node_name", text(stats, "name"));
        node.put("version", text(stats, "version"));
        node.put("status", text(stats, "status"));
        node.put("counter_epoch", text(stats, "ephemeral_id"));
        var jvm = object(stats.get("jvm"));
        node.put("uptime_ms", value(jvm, "uptime_in_millis"));
        node.put("heap_percent", value(object(jvm.get("mem")), "heap_used_percent"));
        node.put("cpu_percent", value(object(stats.get("process")), "cpu", "percent"));
        eventCounters(node, object(stats.get("events")));
        documents.add(node);
        for (var entry : object(stats.get("pipelines")).entrySet()) {
            if (documents.size() > LIMIT) break;
            var pipeline = object(entry.getValue());
            var doc = MetricDocuments.base("pipeline", now, clusterId, clusterName);
            doc.put("pipeline_source", "logstash");
            doc.put("pipeline_id", entry.getKey());
            doc.put("pipeline_uid", "logstash:" + nodeId + ":" + entry.getKey());
            doc.put("node_id", nodeId);
            doc.put("node_name", text(stats, "name"));
            doc.put("uptime_ms", value(jvm, "uptime_in_millis"));
            doc.put("counter_epoch", text(stats, "ephemeral_id") + ":" + text(pipeline, "ephemeral_id"));
            eventCounters(doc, object(pipeline.get("events")));
            var flow = object(pipeline.get("flow"));
            putFinite(doc, "worker_utilization", object(flow.get("worker_utilization")).get("current"));
            putFinite(doc, "queue_backpressure", object(flow.get("queue_backpressure")).get("current"));
            var queue = object(pipeline.get("queue"));
            doc.put("queue_events", value(queue, "events_count"));
            doc.put("queue_bytes", value(queue, "queue_size_in_bytes"));
            doc.put("queue_type", text(queue, "type"));
            var config = object(pipeline.get("pipeline"));
            doc.put("pipeline_workers", value(config, "workers"));
            doc.put("pipeline_batch_size", value(config, "batch_size"));
            List<Map<String, Object>> processors = new ArrayList<>();
            var plugins = object(pipeline.get("plugins"));
            for (String stage : List.of("inputs", "filters", "outputs")) {
                if (!(plugins.get(stage) instanceof List<?> entries)) continue;
                for (var raw : entries) {
                    if (processors.size() == 200) break;
                    var plugin = object(raw);
                    var events = object(plugin.get("events"));
                    processors.add(Map.of("name", text(plugin, "id"), "type", text(plugin, "name"),
                        "stage", stage, "events_in", value(events, "in"), "events_out", value(events, "out"),
                        "time_ms", value(events, "duration_in_millis")));
                }
            }
            doc.put("processors", processors);
            documents.add(doc);
        }
        return documents;
    }

    private static void eventCounters(Map<String, Object> doc, Map<String, Object> events) {
        doc.put("events_in_total", value(events, "in"));
        doc.put("events_out_total", value(events, "out"));
        doc.put("events_time_ms", value(events, "duration_in_millis"));
        // Logstash does not expose a universal failed-event counter.
    }

    private static void putFinite(Map<String, Object> doc, String key, Object value) {
        doc.put(key, value instanceof Number number && Double.isFinite(number.doubleValue()) ? number.doubleValue() : null);
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> object(Object value) {
        return value instanceof Map<?, ?> ? (Map<String, Object>) value : Map.of();
    }
    private static long value(Map<String, Object> map, String key) {
        return map.get(key) instanceof Number number ? number.longValue() : 0L;
    }
    private static long value(Map<String, Object> map, String key, String child) {
        return value(object(map.get(key)), child);
    }
    private static String text(Map<String, Object> map, String key) {
        return map.get(key) instanceof String text ? text : "";
    }
}
