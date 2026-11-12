package de.allendorf.opensearch.monitoring;

import org.opensearch.cluster.metadata.IndexNameExpressionResolver;
import org.opensearch.cluster.service.ClusterService;
import org.opensearch.common.settings.Setting;
import org.opensearch.common.settings.Settings;
import org.opensearch.core.common.io.stream.NamedWriteableRegistry;
import org.opensearch.core.xcontent.NamedXContentRegistry;
import org.opensearch.env.Environment;
import org.opensearch.env.NodeEnvironment;
import org.opensearch.plugins.Plugin;
import org.opensearch.repositories.RepositoriesService;
import org.opensearch.script.ScriptService;
import org.opensearch.threadpool.ExecutorBuilder;
import org.opensearch.threadpool.FixedExecutorBuilder;
import org.opensearch.threadpool.ThreadPool;
import org.opensearch.transport.client.Client;
import org.opensearch.watcher.ResourceWatcherService;
import java.util.Collection;
import java.util.List;
import java.util.function.Supplier;

/** OpenSearch metrics use NodeClient; optional Logstash targets use read-only HTTP(S). */
public final class StackMonitoringPlugin extends Plugin {
    @Override public List<Setting<?>> getSettings() { return MonitoringSettings.all(); }

    @Override public List<ExecutorBuilder<?>> getExecutorBuilders(Settings settings) {
        return List.of(new FixedExecutorBuilder(settings, MonitoringSettings.EXECUTOR, 1, 1, "stack_monitoring"));
    }

    @Override public Collection<Object> createComponents(
        Client client, ClusterService clusterService, ThreadPool threadPool,
        ResourceWatcherService resourceWatcherService, ScriptService scriptService,
        NamedXContentRegistry registry, Environment environment, NodeEnvironment nodeEnvironment,
        NamedWriteableRegistry writeableRegistry, IndexNameExpressionResolver resolver,
        Supplier<RepositoriesService> repositories
    ) {
        return List.of(new MetricsCollector(client, clusterService, threadPool, environment.settings()));
    }
}
