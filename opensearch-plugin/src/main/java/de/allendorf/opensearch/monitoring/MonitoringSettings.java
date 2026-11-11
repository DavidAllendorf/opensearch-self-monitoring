package de.allendorf.opensearch.monitoring;

import org.opensearch.common.settings.Setting;
import org.opensearch.common.unit.TimeValue;
import java.util.List;

public final class MonitoringSettings {
    public static final String INDEX_PREFIX = ".stack-monitoring-";
    public static final String EXECUTOR = "stack_monitoring";
    public static final Setting<Boolean> ENABLED = Setting.boolSetting("stack_monitoring.enabled", true, Setting.Property.NodeScope);
    public static final Setting<TimeValue> INTERVAL = Setting.timeSetting("stack_monitoring.interval", TimeValue.timeValueSeconds(10), TimeValue.timeValueSeconds(5), Setting.Property.NodeScope);
    public static final Setting<TimeValue> TIMEOUT = Setting.timeSetting("stack_monitoring.request_timeout", TimeValue.timeValueSeconds(5), TimeValue.timeValueSeconds(1), Setting.Property.NodeScope);
    public static final Setting<Integer> RETENTION = Setting.intSetting("stack_monitoring.retention_days", 7, 1, 365, Setting.Property.NodeScope);
    public static final Setting<Integer> MAX_INDICES = Setting.intSetting("stack_monitoring.max_indices", 1000, 1, 10000, Setting.Property.NodeScope);

    private MonitoringSettings() {}
    public static List<Setting<?>> all() { return List.of(ENABLED, INTERVAL, TIMEOUT, RETENTION, MAX_INDICES); }
}
