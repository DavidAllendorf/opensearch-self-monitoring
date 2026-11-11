# OpenSearch Self Monitoring

Zwei native Plugins fuer **OpenSearch 3.6.0** und **OpenSearch Dashboards 3.6.0**.
Der Cluster erfasst seine eigenen Metriken und speichert sie selbst. Es werden
keine Container, externen Collector-Dienste oder Zugangsdaten fuer die Erfassung
benoetigt. Eigenstaendige Implementierung unter Apache-2.0.

## Funktionen

- Clusterzustand, Knoten, Indizes, Shards, Dokumente und primaerer Speicher.
- Indexierungs- und Suchraten sowie mittlere Zeit je Shard-Operation.
- CPU, JVM Heap, Dateisystem, GC-Zeit, Threadpool-Queues und Ablehnungen.
- Zeitverlaeufe fuer Cluster, einzelne Knoten und einzelne Indizes.
- Durchsuchbare Tabellen, Zeitraumauswahl, automatische Aktualisierung,
  Pause und eine Warnung bei veralteten Messwerten.
- Produktnavigation fuer OpenSearch und Logstash mit Uebersicht-, Nodes-,
  Indizes- und Pipeline-Tabs sowie direkt verlinkbaren Detailansichten.
- Ingest-Pipeline- und Prozessorstatistiken pro OpenSearch-Node.
- Automatische Erkennung des lokalen Logstash: Event-Durchsatz, JVM, CPU,
  Pipeline-Worker, Queues und Inputs/Filter/Outputs.
- Node-Details mit lokalen Indizes und Shard-Kopien: Shard-ID, Primary/Replica,
  Routing-Zustand, Verschiebungsquelle/-ziel sowie lokale Dokumente und Daten.

Die Oberflaeche wird unter **Stack Monitoring** registriert, auch in der neuen
Navigation unter **Data administration**. Direkter Pfad: `/app/stackMonitoring`.

## Ohne Konfiguration starten

1. Das OpenSearch-ZIP auf den Knoten installieren und OpenSearch neu starten.
2. Das Dashboards-ZIP auf Dashboards installieren und Dashboards neu starten.
3. Als Administrator anmelden und **Stack Monitoring** oeffnen.

Nach etwa zwei Erfassungsintervallen erscheinen auch die berechneten Raten.
Die OpenSearch-Erfassung nutzt intern dieselben Aktionen wie Cluster Health,
Nodes Stats und Indices Stats, ohne HTTP-Aufruf oder Admin-Passwort. Nur die
optionale Logstash-Erfassung liest dessen lokale HTTP-Monitoring-API.
Nur der gewaehlte Cluster-Manager sammelt. Deshalb auf allen fuer diese Rolle
geeigneten Knoten installieren, empfohlen einheitlich auf allen Knoten.

Standard: **10 Sekunden Abstand zwischen Erfassungen**, **7 UTC-Tagesindizes**,
maximal **1.000 Indexdetails** pro Erfassung. Die Arbeit einer Erfassung kommt
zum Zeitabstand hinzu. Cluster-Gesamtwerte bleiben vom Indexdetail-Limit unberuehrt.

## Dokumentation

- [Entwicklung und reproduzierbarer Build](docs/DEVELOPMENT.md)
- [Installation, Updates, Rollen und Betrieb](docs/DELIVERY.md)
- [Architektur, Datenmodell und Grenzen](docs/ARCHITECTURE.md)
- [Durchgefuehrte Pruefungen](docs/VERIFICATION.md)

Schneller Einstieg in die Quelltests:

```sh
npm ci
npm test
./gradlew :opensearch-plugin:test :opensearch-plugin:pluginZip
```

Die Java-Builds benoetigen JDK 21. Der Dashboards-Build verwendet die offiziellen
Plugin-Helpers und einen vorbereiteten Dashboards-Quellbaum; Details stehen in
der Entwicklungsdokumentation.

## Optionale Einstellungen

In `opensearch.yml`, auf allen Cluster-Manager-Knoten gleich; danach neu starten:

```yaml
stack_monitoring.enabled: true
stack_monitoring.interval: 10s
stack_monitoring.request_timeout: 5s
stack_monitoring.retention_days: 7
stack_monitoring.max_indices: 1000
stack_monitoring.logstash.enabled: true
```

Das kleinste Intervall ist 5 Sekunden. Es gibt keine frei konfigurierbaren HTTP-Ziele oder
Passwortfelder. Die Einstellungen sind bewusst statisch, damit kleine
Installationen einfach nachvollziehbar bleiben.

## Umfang

Version 0.3.0 ueberwacht **OpenSearch selbst und ein lokales Logstash**.
Logstash wird ausschliesslich am gewaehlten Cluster-Manager ueber
`http://127.0.0.1:9600/_node/stats` abgefragt. Bei einem Rollenwechsel kann
damit eine andere lokale Logstash-Instanz erscheinen. Fuer fremde Hosts,
authentifizierte Logstash-APIs oder Ferncluster ist ein separater Collector
erforderlich. Die lokale API wird weder im Netzwerk freigegeben noch als
Browser-Proxy angeboten. Mit `stack_monitoring.logstash.enabled: false`
laesst sich diese Abfrage abschalten.

Die Gestaltung orientiert sich an der Navigation des Elastic Stack Monitoring;
es ist eine eigene Implementierung mit OpenSearch-/EUI-Komponenten.
Kein Beats-Monitoring, Alerting oder externer Verfuegbarkeitstest.
Bei einem vollstaendigen Clusterausfall kann der Cluster keine neuen Messungen
mehr schreiben. Bereits gespeicherte Messungen bleiben erhalten.

Fachliche Grundlagen:
[OpenSearch-Plugin-Einstieg](https://opensearch.org/blog/my-first-steps-in-opensearch-plugins/),
[Dashboards-Plugin-Einstieg](https://opensearch.org/blog/dashboards-plugins-intro/),
[Nodes Stats](https://docs.opensearch.org/latest/api-reference/nodes-apis/nodes-stats/).
