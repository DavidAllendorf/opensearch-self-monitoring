package de.allendorf.opensearch.monitoring;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import static org.junit.jupiter.api.Assertions.*;

class MetricMathTest {
    @Test void ratesUseActualElapsedTimeAndTreatResetsAsGaps() {
        assertEquals(5.0, MetricMath.rate(200, 100L, 20_000));
        assertNull(MetricMath.rate(20, 100L, 10_000));
        assertNull(MetricMath.rate(200, null, 10_000));
        assertNull(MetricMath.rate(200, 100L, 0));
    }

    @Test void latencyIsTimeSpentPerCompletedOperationNotPerPoll() {
        assertEquals(2.0, MetricMath.latency(120, 100L, 30, 20L));
        assertNull(MetricMath.latency(120, 100L, 20, 20L));
        assertNull(MetricMath.latency(10, 100L, 30, 20L));
    }

    @Test void retentionOnlyDeletesExactOwnedDailyIndicesBeforeCutoff() {
        var cutoff = LocalDate.of(2026, 11, 5);
        assertTrue(MetricMath.expired(".stack-monitoring-2026-11-04", cutoff));
        assertFalse(MetricMath.expired(".stack-monitoring-2026-11-05", cutoff));
        assertFalse(MetricMath.expired("logs-2020-01-01", cutoff));
        assertFalse(MetricMath.expired(".stack-monitoring-not-a-date", cutoff));
        assertFalse(MetricMath.expired(".stack-monitoring-2020-01-01-backup", cutoff));
    }

    @Test void dailyBucketsAlwaysUseUtc() {
        assertEquals(LocalDate.of(2026, 11, 11), MetricMath.utcDate(java.time.Instant.parse("2026-11-11T23:59:59Z").toEpochMilli()));
    }
}
