package de.allendorf.opensearch.monitoring;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.opensearch.ExceptionsHelper;
import org.opensearch.ResourceAlreadyExistsException;
import org.opensearch.action.admin.cluster.health.ClusterHealthRequest;
import org.opensearch.action.admin.cluster.node.stats.NodesStatsRequest;
import org.opensearch.action.admin.indices.create.CreateIndexRequest;
import org.opensearch.action.admin.indices.delete.DeleteIndexRequest;
import org.opensearch.action.admin.indices.stats.IndicesStatsRequest;
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
        if (!cluster.state().nodes().isLocalNodeElectedClusterManager()) {
            previous.clear();
            return;
        }
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
        var nodesRequest = new NodesStatsRequest().clear().addMetrics("os", "jvm", "fs", "thread_pool").indices(true);
        nodesRequest.timeout(timeout);
        var nodes = client.admin().cluster().nodesStats(nodesRequest).actionGet(timeout);
        var indices = client.admin().indices().stats(new IndicesStatsRequest()
            .indices("*", "-" + MonitoringSettings.INDEX_PREFIX + "*")
            .clear().docs(true).store(true).indexing(true).search(true)).actionGet(timeout);
        if (!nodes.failures().isEmpty() || indices.getFailedShards() > 0) {
            throw new IllegalStateException("Partial stats response; refusing to record misleading totals");
        }
        List<Map<String, Object>> documents = new ArrayList<>();
        for (var node : nodes.getNodes()) documents.add(MetricDocuments.node(node, now, clusterId, clusterName));
        int maxIndices = MonitoringSettings.MAX_INDICES.get(settings);
        indices.getIndices().values().stream().sorted(java.util.Comparator.comparing(i -> i.getIndex()))
            .limit(maxIndices).forEach(index -> documents.add(MetricDocuments.index(index, now, clusterId, clusterName)));

        var summary = MetricDocuments.base("cluster", now, clusterId, clusterName);
        summary.put("status", health.getStatus().toString().toLowerCase(java.util.Locale.ROOT));
        summary.put("nodes", health.getNumberOfNodes());
        summary.put("data_nodes", health.getNumberOfDataNodes());
        summary.put("active_shards", health.getActiveShards());
        summary.put("unassigned_shards", health.getUnassignedShards());
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
        // Leadership can change while stats requests are in flight.
        if (stopped || !cluster.state().nodes().isLocalNodeElectedClusterManager()) return;
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
        return doc.get("kind") + ":" + doc.getOrDefault("node_id", doc.getOrDefault("index_uuid", doc.get("cluster_uuid")));
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
