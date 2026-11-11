package de.allendorf.opensearch.monitoring;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

/** Pure calculations, kept separate from OpenSearch and scheduling. */
public final class MetricMath {
    private MetricMath() {}

    /** A missing baseline or a counter reset is a gap, never a negative rate. */
    public static Double rate(long current, Long previous, long elapsedMillis) {
        if (previous == null || current < previous || elapsedMillis <= 0) return null;
        return (current - previous) * 1000.0 / elapsedMillis;
    }

    public static Double latency(long timeMillis, Long previousTime, long count, Long previousCount) {
        if (previousTime == null || previousCount == null || timeMillis < previousTime || count <= previousCount) return null;
        return (timeMillis - previousTime) * 1.0 / (count - previousCount);
    }

    public static LocalDate utcDate(long timestamp) {
        return Instant.ofEpochMilli(timestamp).atZone(ZoneOffset.UTC).toLocalDate();
    }

    public static boolean expired(String name, LocalDate cutoff) {
        if (!name.startsWith(MonitoringSettings.INDEX_PREFIX)) return false;
        try {
            return LocalDate.parse(name.substring(MonitoringSettings.INDEX_PREFIX.length())).isBefore(cutoff);
        } catch (java.time.format.DateTimeParseException ignored) {
            return false; // Never delete an index whose name we do not own exactly.
        }
    }
}
