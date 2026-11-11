package de.allendorf.opensearch.monitoring;

import org.opensearch.SpecialPermission;
import org.opensearch.common.xcontent.XContentHelper;
import org.opensearch.common.xcontent.json.JsonXContent;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.security.AccessController;
import java.security.PrivilegedAction;
import java.util.Map;

/** Optional local-only discovery. No configurable URL, credentials, redirects or remote proxy. */
final class LocalLogstash {
    private static final int MAX_BYTES = 4 * 1024 * 1024;
    private LocalLogstash() {}

    @SuppressWarnings("removal")
    static Map<String, Object> read() {
        SpecialPermission.check();
        return AccessController.doPrivileged((PrivilegedAction<Map<String, Object>>) () -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) URI.create("http://127.0.0.1:9600/_node/stats").toURL().openConnection();
                connection.setConnectTimeout(1000);
                connection.setReadTimeout(1500);
                connection.setInstanceFollowRedirects(false);
                if (connection.getResponseCode() != 200) return null;
                try (var stream = connection.getInputStream()) {
                    byte[] bytes = stream.readNBytes(MAX_BYTES + 1);
                    if (bytes.length > MAX_BYTES) return null;
                    return XContentHelper.convertToMap(JsonXContent.jsonXContent, bytes, 0, bytes.length, false);
                }
            } catch (IOException | RuntimeException unavailable) {
                return null; // A missing local Logstash must never interrupt OpenSearch collection.
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }
}
