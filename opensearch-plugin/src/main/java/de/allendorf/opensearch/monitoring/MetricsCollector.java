package de.allendorf.opensearch.monitoring;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.opensearch.ExceptionsHelper;
import org.opensearch.ResourceAlreadyExistsException;
import org.opensearch.action.admin.cluster.health.ClusterHealthRequest;
import org.opensearch.action.admin.cluster.node.stats.NodesStatsRequest;
import org.opensearch.action.admin.indices.create.CreateIndexRequest;
import org.opensearch.action.admin.indices.delete.DeleteIndexRequest;
import org.opensearch.action.admin.indices.mapping.put.PutMappingRequest;
import org.opensearch.action.admin.indices.stats.IndicesStatsRequest;
import org.opensearch.action.admin.indices.recovery.RecoveryRequest;
import org.opensearch.action.support.IndicesOptions;
import org.opensearch.action.bulk.BulkRequest;
import org.opensearch.action.index.IndexRequest;
import org.opensearch.cluster.service.ClusterService;
import org.opensearch.common.lifecycle.AbstractLifecycleComponent;
import org.opensearch.common.settings.Settings;
import org.opensearch.common.unit.TimeValue;
import org.opensearch.common.util.concurrent.ThreadContext;
import org.opensearch.common.xcontent.XContentType;
import org.opensearch.threadpool.Scheduler;
import org.opensearch.threadpool.ThreadPool;
import org.opensearch.transport.client.Client;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** One bounded worker; no overlapping polls, no work on transport or scheduler threads. */
final class MetricsCollector extends AbstractLifecycleComponent {
    private static final Logger LOG = LogManager.getLogger(MetricsCollector.class);
    private final Client client;
    private final ClusterService cluster;
    private final ThreadPool threads;
    private final Settings settings;
    private final TimeValue timeout;
    private final List<String> logstashUrls;
    private final Map<String, Map<String, Object>> previous = new HashMap<>();
    private Scheduler.Cancellable schedule;
    private volatile boolean stopped;
    private String preparedIndex;
    private LocalDate lastCleanup;

    MetricsCollector(Client client, ClusterService cluster, ThreadPool threads, Settings settings) {
        this.client = client;
        this.cluster = cluster;
        this.threads = threads;
        this.settings = settings;
        this.timeout = MonitoringSettings.TIMEOUT.get(settings);
        this.logstashUrls = MonitoringSettings.LOGSTASH_URLS.get(settings).stream().distinct().toList();
        if (logstashUrls.size() > 16) throw new IllegalArgumentException("At most 16 Logstash URLs may be configured");
    }

    @Override protected void doStart() {
        stopped = false;
        if (MonitoringSettings.ENABLED.get(settings)) {
            schedule = threads.scheduleWithFixedDelay(this::poll, MonitoringSettings.INTERVAL.get(settings), MonitoringSettings.EXECUTOR);
        }
    }

    @Override protected void doStop() { stopped = true; if (schedule != null) schedule.cancel(); }
    @Override protected void doClose() { doStop(); }

    private void poll() {
        if (stopped) return;
        // Do not inherit a browser user's identity into background collection.
        // The internal NodeClient is authenticated as a local node by OpenSearch Security.
        try (ThreadContext.StoredContext ignored = threads.getThreadContext().stashContext()) {
            collect();
        } catch (Exception error) {
            previous.clear();
            preparedIndex = null; // Retry index creation if it was removed externally.
            LOG.warn("Stack monitoring sample failed; collection will retry on the next interval", error);
        }
    }

    private void collect() throws IOException {
        long now = System.currentTimeMillis();
        var state = cluster.state();
        String clusterId = state.metadata().clusterUUID();
        if ("_na_".equals(clusterId)) return;
        String clusterName = state.getClusterName().value();
        var health = client.admin().cluster().health(new ClusterHealthRequest().timeout(timeout)).actionGet(timeout);
        var nodesRequest = new NodesStatsRequest().clear().addMetrics("os", "jvm", "fs", "thread_pool", "ingest").indices(true);
        nodesRequest.timeout(timeout);
        var nodes = client.admin().cluster().nodesStats(nodesRequest).actionGet(timeout);
        var indices = client.admin().indices().stats(new IndicesStatsRequest()
            .indices("*", "-" + MonitoringSettings.INDEX_PREFIX + "*")
            .clear().docs(true).store(true).indexing(true).search(true)).actionGet(timeout);
        if (!nodes.failures().isEmpty() || indices.getFailedShards() > 0) {
            throw new IllegalStateException("Partial stats response; refusing to record misleading totals");
        }
        List<Map<String, Object>> documents = new ArrayList<>();
        var shardStats = NodeAllocations.statsByAllocation(indices.getShards());
        for (var node : nodes.getNodes()) {
            var document = MetricDocuments.node(node, now, clusterId, clusterName);
            NodeAllocations.add(document, state, shardStats);
            documents.add(document);
            documents.addAll(PipelineDocuments.ingest(node, now, clusterId, clusterName));
        }
        int maxIndices = MonitoringSettings.MAX_INDICES.get(settings);
        indices.getIndices().values().stream().sorted(java.util.Comparator.comparing(i -> i.getIndex()))
            .limit(maxIndices).forEach(index -> {
                var doc = MetricDocuments.index(index, now, clusterId, clusterName);
                var routing = state.routingTable().index(index.getIndex());
                if (routing != null) doc.put("status", !routing.allPrimaryShardsActive() ? "red"
                    : routing.shardsMatchingPredicateCount(shard -> !shard.active()) > 0 ? "yellow" : "green");
                documents.add(doc);
            });

        var summary = MetricDocuments.base("cluster", now, clusterId, clusterName);
        if (MonitoringSettings.LOGSTASH_ENABLED.get(settings)) {
            var seen = new java.util.HashSet<String>();
            int failed = 0;
            for (String url : logstashUrls) {
                var logstash = LogstashEndpoint.read(url);
                if (logstash == null || !(logstash.get("id") instanceof String id) || id.isBlank()) { failed++; continue; }
                if (seen.add(id)) documents.addAll(PipelineDocuments.logstash(logstash, now, clusterId, clusterName));
            }
            summary.put("logstash_available", !seen.isEmpty());
            summary.put("logstash_targets", logstashUrls.size());
            summary.put("logstash_failed_targets", failed);
        }
        summary.put("status", health.getStatus().toString().toLowerCase(java.util.Locale.ROOT));
        summary.put("nodes", health.getNumberOfNodes());
        summary.put("data_nodes", health.getNumberOfDataNodes());
        summary.put("active_shards", health.getActiveShards());
        summary.put("active_primary_shards", health.getActivePrimaryShards());
        summary.put("initializing_shards", health.getInitializingShards());
        summary.put("relocating_shards", health.getRelocatingShards());
        summary.put("unassigned_shards", health.getUnassignedShards());
        collectRecoveries(summary, now);
        summary.put("indices", indices.getIndices().size());
        summary.put("sampled_indices", Math.min(maxIndices, indices.getIndices().size()));
        summary.put("interval_ms", MonitoringSettings.INTERVAL.get(settings).millis());
        MetricDocuments.indexCounters(summary, indices.getPrimaries(), indices.getTotal());
        summary.put("cpu_percent", nodes.getNodes().stream().mapToInt(n -> n.getOs().getCpu().getPercent()).filter(v -> v >= 0).average().orElse(0));
        long heapUsed = 0, heapMax = 0, diskAvailable = 0, diskTotal = 0;
        for (var doc : documents) {
            if (!"node".equals(doc.get("kind"))) continue;
            heapUsed += MetricDocuments.number(doc, "heap_used_bytes");
            heapMax += MetricDocuments.number(doc, "heap_max_bytes");
            diskAvailable += MetricDocuments.number(doc, "disk_available_bytes");
            diskTotal += MetricDocuments.number(doc, "disk_total_bytes");
        }
        summary.put("heap_percent", heapMax == 0 ? 0.0 : heapUsed * 100.0 / heapMax);
        summary.put("disk_available_bytes", diskAvailable);
        summary.put("disk_total_bytes", diskTotal);
        documents.add(summary);

        Map<String, Map<String, Object>> next = new HashMap<>();
        for (var doc : documents) {
            String key = identity(doc);
            MetricDocuments.rates(doc, previous.get(key));
            next.put(key, doc);
        }
        // The one explicitly installed collector runs independently of node roles or manager elections.
        if (stopped) return;
        String index = MonitoringSettings.INDEX_PREFIX + MetricMath.utcDate(now);
        ensureIndex(index);
        BulkRequest bulk = new BulkRequest().timeout(timeout);
        for (var doc : documents) bulk.add(new IndexRequest(index).id(now + ":" + identity(doc)).source(doc));
        var result = client.bulk(bulk).actionGet(timeout);
        if (result.hasFailures()) throw new IllegalStateException("Metrics bulk write failed: " + result.buildFailureMessage());
        previous.clear();
        previous.putAll(next);
        cleanup(MetricMath.utcDate(now));
    }

    private static String identity(Map<String, Object> doc) {
        return doc.get("kind") + ":" + doc.getOrDefault("pipeline_uid", doc.getOrDefault("node_id", doc.getOrDefault("index_uuid", doc.get("cluster_uuid"))));
    }

    private void collectRecoveries(Map<String, Object> summary, long now) {
        try {
            var request = new RecoveryRequest("*").indicesOptions(IndicesOptions.lenientExpandOpenHidden());
            request.detailed(false);
            request.activeOnly(false);
            var response = client.admin().indices().recoveries(request).actionGet(timeout);
            if (response.getFailedShards() > 0) throw new IllegalStateException("Partial recovery response");
            var states = response.shardRecoveryStates().values().stream().flatMap(List::stream).toList();
            RecoveryDocuments.add(summary, states, now - MonitoringSettings.RETENTION.get(settings) * 86_400_000L);
        } catch (Exception error) {
            summary.put("recoveries_available", false);
            LOG.warn("Shard activity unavailable for this sample; other metrics are still collected", error);
        }
    }

    private void ensureIndex(String name) throws IOException {
        if (name.equals(preparedIndex)) return;
        String mapping;
        try (var stream = getClass().getResourceAsStream("/metrics-mapping.json")) {
            if (stream == null) throw new IOException("Missing metrics mapping resource");
            mapping = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
        try {
            client.admin().indices().create(new CreateIndexRequest(name)
                .settings(Settings.builder().put("index.number_of_shards", 1).put("index.auto_expand_replicas", "0-1")
                    .put("index.hidden", true).put("index.refresh_interval", "5s"))
                .mapping(mapping, XContentType.JSON)).actionGet(timeout);
        } catch (Exception error) {
            if (!(ExceptionsHelper.unwrapCause(error) instanceof ResourceAlreadyExistsException)) throw error;
            // Additive schema upgrade: retain all existing fields and documents in today's index.
            client.admin().indices().putMapping(new PutMappingRequest(name).source(mapping, XContentType.JSON)).actionGet(timeout);
        }
        preparedIndex = name;
    }

    private void cleanup(LocalDate today) {
        if (today.equals(lastCleanup)) return;
        LocalDate cutoff = today.minusDays(MonitoringSettings.RETENTION.get(settings) - 1L);
        List<String> expired = new ArrayList<>();
        for (String name : cluster.state().metadata().indices().keySet()) {
            if (MetricMath.expired(name, cutoff)) expired.add(name);
        }
        if (!expired.isEmpty()) client.admin().indices().delete(new DeleteIndexRequest(expired.toArray(String[]::new))).actionGet(timeout);
        lastCleanup = today;
    }
}
