package de.ba.opensearch.monitoring;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class LogstashEndpointTest {
    @Test void acceptsExplicitHttpAndHttpsBases() {
        assertEquals("http://logstash-01:9600", LogstashEndpoint.validate("http://logstash-01:9600/"));
        assertEquals("https://logstash-02.example/api", LogstashEndpoint.validate("https://logstash-02.example/api/"));
    }
    @Test void rejectsCredentialsAndNonHttpTargets() {
        for (String url : new String[]{"http://user:secret@host:9600", "file:///etc/passwd", "http://host?q=secret", "http://host#fragment"}) {
            assertThrows(IllegalArgumentException.class, () -> LogstashEndpoint.validate(url));
        }
    }
}
