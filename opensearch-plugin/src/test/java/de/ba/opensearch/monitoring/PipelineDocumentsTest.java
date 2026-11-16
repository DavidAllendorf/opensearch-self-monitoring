package de.ba.opensearch.monitoring;

import org.junit.jupiter.api.Test;
import java.util.LinkedHashMap;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class PipelineDocumentsTest {
    @Test void normalizesOnlyMetricsAndPreservesMissingFlowValues() {
        var stats = Map.<String, Object>of("id", "node-a", "name", "test", "ephemeral_id", "boot-1",
            "pipelines", Map.of("main", Map.of("events", Map.of("in", 10, "out", 8, "duration_in_millis", 40),
                "flow", Map.of("worker_utilization", Map.of("current", "Infinity")),
                "plugins", Map.of("outputs", java.util.List.of(Map.of("id", "out-1", "name", "opensearch",
                    "password", "must-not-be-exported", "events", Map.of("out", 8)))))));
        var documents = PipelineDocuments.logstash(stats, 1000, "cluster", "logging");
        assertEquals(2, documents.size());
        var pipeline = documents.get(1);
        assertEquals("logstash:node-a:main", pipeline.get("pipeline_uid"));
        assertEquals(8L, pipeline.get("events_out_total"));
        assertNull(pipeline.get("worker_utilization"));
        assertFalse(pipeline.containsKey("events_failed_total"));
        assertFalse(pipeline.toString().contains("must-not-be-exported"));
    }

    @Test void pipelineReloadInvalidatesIncreasingCounters() {
        var before = new LinkedHashMap<String, Object>(Map.of("timestamp", 1000L, "counter_epoch", "old", "events_out_total", 10L, "events_time_ms", 20L));
        var after = new LinkedHashMap<String, Object>(Map.of("timestamp", 2000L, "counter_epoch", "new", "events_out_total", 100L, "events_time_ms", 300L));
        MetricDocuments.rates(after, before);
        assertNull(after.get("events_out_rate"));
        assertNull(after.get("events_latency_ms"));
    }

    @Test void computesPipelineRatesAndDoesNotInventFailures() {
        var before = new LinkedHashMap<String, Object>(Map.of("timestamp", 1000L, "events_in_total", 10L, "events_out_total", 8L, "events_time_ms", 20L));
        var after = new LinkedHashMap<String, Object>(Map.of("timestamp", 3000L, "events_in_total", 20L, "events_out_total", 18L, "events_time_ms", 60L));
        MetricDocuments.rates(after, before);
        assertEquals(5.0, after.get("events_out_rate"));
        assertEquals(4.0, after.get("events_latency_ms"));
        assertFalse(after.containsKey("events_failed_rate"));
    }
}
