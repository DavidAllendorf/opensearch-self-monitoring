# Uebernahme in eine Arbeitsumgebung

Java-Namensraum: `de.ba.opensearch.monitoring`, Gradle-Gruppe: `de.ba.opensearch`.
Plugin-IDs, API-Pfade und `.stack-monitoring-*` bleiben stabil. Es gibt keine
fest codierten privaten Dienste oder Zugangsdaten. Die bestehende Git-Historie
wird durch die Umbenennung nicht umgeschrieben. Apache-2.0-Lizenz beilegen.

## Installation

- Exakt OpenSearch und Dashboards 3.6.0; andere Plattformen separat bauen und testen.
- Java-Plugin 0.8.0 genau einmal auf einem Node des bestehenden Clusters installieren,
  empfohlen ein neuer coordinating-only Node (`node.roles: []`). Discovery und
  Transport-TLS regulaer fuer diesen Cluster konfigurieren. Kein eigener Cluster.
- Dashboard-Plugin 0.8.0 auf jeder Dashboards-Instanz installieren. Dieselben
  Alert-Werte auf allen Instanzen ausrollen. Benutzer brauchen Leserechte auf
  `.stack-monitoring-*`; keine Admin-Zugangsdaten im Plugin oder Repository.
- Mehrere Logstash-APIs am Collector ueber `stack_monitoring.logstash.urls`
  konfigurieren. HTTPS mit vertrauten Zertifikaten wird unterstuetzt;
  zusaetzliche API-Authentifizierung ist weiterhin nicht implementiert.

`config/opensearch_dashboards.yml.example` zeigt alle Defaults. Einzelne Werte
lassen sich ueberschreiben; fehlende Eintraege behalten ihren Default. Ungueltige
Schluessel, negative Werte, umgekehrte Warning/Critical-Grenzen und unmoegliche
Anomalie-Basen verhindern den Dashboards-Start mit einer Fehlermeldung.
Aenderungen erfordern einen Neustart der jeweiligen Dashboards-Instanz.
Ansible kann die YAML ausrollen; Paket-/Plugin-Installation bleibt separat.

## Entwicklung und Auslieferung

JDK 21, Node 22.22.0, Yarn 1.22.19 und den offiziellen Dashboards-3.6.0-Quellbaum
verwenden. `npm ci && npm test` prueft die reinen TypeScript-Funktionen,
`./gradlew :opensearch-plugin:test :opensearch-plugin:pluginZip` Java und das ZIP.
Im Dashboards-Quellbaum den Pluginordner unter `plugins/stack_monitoring/` ablegen.
Mit `yarn test:jest --roots plugins/stack_monitoring/server --runInBand --watch=false`
die echte Konfigurationsvalidierung pruefen; danach TypeScript-Pruefung und
offiziellen Plugin-Helpers-Build ausfuehren (DEVELOPMENT.md).

Die GitHub-Actions-Pipeline kann im eigenen Repository uebernommen werden.
Sie enthaelt keine Deployment-Zugangsdaten und erzeugt nur Build-Artefakte.
Zunaechst in einem separaten Testcluster pruefen. Das Release enthaelt beide
Plugin-ZIPs, Quellstand, Dokumentation, Beispielkonfiguration und SHA-256-Pruefsummen.
Rollout und Rollback stehen in DEPLOYMENT.md und DELIVERY.md.
