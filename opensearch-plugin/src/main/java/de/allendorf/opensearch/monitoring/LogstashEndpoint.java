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

/** Read only explicitly configured Logstash APIs; no redirects, inline credentials or browser proxy. */
final class LogstashEndpoint {
    private static final int MAX_BYTES = 4 * 1024 * 1024;
    private LogstashEndpoint() {}

    static String validate(String baseUrl) {
        var uri = URI.create(baseUrl);
        if (!("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) || uri.getHost() == null
            || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null) {
            throw new IllegalArgumentException("Logstash URLs must be HTTP(S) base URLs without credentials, query or fragment");
        }
        return baseUrl.replaceAll("/+$", "");
    }

    @SuppressWarnings("removal")
    static Map<String, Object> read(String baseUrl) {
        SpecialPermission.check();
        return AccessController.doPrivileged((PrivilegedAction<Map<String, Object>>) () -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) URI.create(baseUrl + "/_node/stats").toURL().openConnection();
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
                return null; // An unavailable Logstash must never interrupt OpenSearch collection.
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }
}
