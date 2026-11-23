# OpenSearch Self Monitoring

Zwei native Plugins fuer **OpenSearch 3.6.0** und **OpenSearch Dashboards 3.6.0**.
Aktuell: Dashboard-Plugin **0.9.0**, Java-Collector unveraendert **0.8.0**.
Der Cluster erfasst seine eigenen Metriken und speichert sie selbst. Es werden
keine Container, externen Collector-Dienste oder Zugangsdaten fuer die Erfassung
benoetigt. Eigenstaendige Implementierung unter Apache-2.0.

## Funktionen

- Gemeinsamer Topologie-Tab fuer OpenSearch und Logstash: automatische
  Zugehoerigkeiten, Ressourcenfarben, Suche, Zoom und verlinkte Details.
  Optionale deklarierte Logstash-Datenfluesse; siehe [Topologie](docs/TOPOLOGY.md).

- Clusterzustand, Knoten, Indizes, Shards, Dokumente und primaerer Speicher.
- Indexierungs- und Suchraten sowie mittlere Zeit je Shard-Operation.
- CPU, JVM Heap, Dateisystem, GC-Zeit, Threadpool-Queues und Ablehnungen.
- Zeitverlaeufe fuer Cluster, einzelne Knoten und einzelne Indizes.
- Durchsuchbare Tabellen, Zeitraumauswahl, automatische Aktualisierung,
  Pause und eine Warnung bei veralteten Messwerten.
- Produktnavigation fuer OpenSearch und Logstash mit Uebersicht-, Nodes-,
  Indizes- und Pipeline-Tabs sowie direkt verlinkbaren Detailansichten.
- Ingest-Pipeline- und Prozessorstatistiken pro OpenSearch-Node.
- Konfigurierbare lokale oder entfernte Logstash-APIs: Event-Durchsatz, JVM, CPU,
  Pipeline-Worker, Queues und Inputs/Filter/Outputs.
- Node-Details mit lokalen Indizes und Shard-Kopien: Shard-ID, Primary/Replica,
  Routing-Zustand, Verschiebungsquelle/-ziel sowie lokale Dokumente und Daten.
- Shard Activity in der Cluster-Uebersicht: laufende und kuerzlich abgeschlossene
  Recoveries mit Phase, Quelle/Ziel, Primary/Replica und Uebertragungsfortschritt.
- Kompakte Standardansicht und sichtbar zusaetzliche Diagramme ueber
  „Erweiterte Metriken“, direkt bei den jeweiligen Diagrammen.
- Alerts-Tab je Produkt: Ressourcen-Schwellwerte, Primary-Shard-Richtlinie,
  Cluster-/Pipeline-Probleme und heuristische Durchsatz-Anomalien. Nur aktuelle
  Hinweise, keine Benachrichtigungen oder externen Anbindungen; siehe [Regeln](docs/ALERTS.md).
- Primary-Regel je Index und Node, gruppierte Warnungen mit betroffenen Nodes
  und alle Schwellen in `opensearch_dashboards.yml` konfigurierbar.

Die Oberflaeche wird unter **Stack Monitoring** registriert, auch in der neuen
Navigation unter **Data administration**. Direkter Pfad: `/app/stackMonitoring`.

## Ohne Konfiguration starten

1. Das OpenSearch-ZIP **genau einmal auf einem dedizierten Collector-Node** des bestehenden Clusters installieren. Nur diesen Node neu starten.
2. Das Dashboards-ZIP **auf allen Dashboards-Instanzen dieses Clusters** installieren und diese kontrolliert nacheinander neu starten.
3. Als Administrator anmelden und **Stack Monitoring** oeffnen.

Nach etwa zwei Erfassungsintervallen erscheinen auch die berechneten Raten.
Die OpenSearch-Erfassung nutzt intern dieselben Aktionen wie Cluster Health,
Nodes Stats und Indices Stats, ohne HTTP-Aufruf oder Admin-Passwort. Nur die
optionale Logstash-Erfassung liest dessen lokale HTTP-Monitoring-API.
Der Collector sammelt unabhaengig von seiner Node-Rolle und vom gewaehlten
Cluster-Manager. Empfohlen ist ein eigener coordinating-only Node mit
`node.roles: []`. Er muss Mitglied des ueberwachten Clusters sein, kein eigener
separater OpenSearch-Cluster. Andere OpenSearch-Nodes brauchen dieses Plugin
nicht und muessen fuer dessen Installation oder Updates nicht neu gestartet werden.
Es gibt keine automatische Collector-Wahl oder Ausfalluebernahme. Genau eine
aktive Installation betreiben; mehrere aktive Collector erzeugen parallele Messungen.

Standard: **10 Sekunden Abstand zwischen Erfassungen**, **7 UTC-Tagesindizes**,
maximal **1.000 Indexdetails** pro Erfassung. Die Arbeit einer Erfassung kommt
zum Zeitabstand hinzu. Cluster-Gesamtwerte bleiben vom Indexdetail-Limit unberuehrt.

## Dokumentation

- [Entwicklung und reproduzierbarer Build](docs/DEVELOPMENT.md)
- [Uebernahme in eine Arbeitsumgebung](docs/ADOPTION.md)
- [Alle Dashboard-Schwellwerte mit Defaults](config/opensearch_dashboards.yml.example)
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

In `opensearch.yml` ausschliesslich auf dem Collector-Node; danach diesen neu starten:

```yaml
stack_monitoring.enabled: true
stack_monitoring.interval: 10s
stack_monitoring.request_timeout: 5s
stack_monitoring.retention_days: 7
stack_monitoring.max_indices: 1000
stack_monitoring.logstash.enabled: true
stack_monitoring.logstash.urls:
  - "http://127.0.0.1:9600"
```

Das kleinste Intervall ist 5 Sekunden. Die Logstash-URLs sind explizite
Administratoreinstellungen; es gibt keine Passwortfelder. Die Einstellungen sind statisch, damit kleine
Installationen einfach nachvollziehbar bleiben.

## Umfang

Das Plugin ueberwacht **den eigenen OpenSearch-Cluster und bis zu 16 Logstash-API-Ziele**.
Ohne Konfiguration wird nur `http://127.0.0.1:9600` am Collector gelesen.
Fuer mehrere Logstash-Server deren HTTP(S)-Basis-URLs konfigurieren, zum Beispiel:

```yaml
stack_monitoring.logstash.urls:
  - "http://logstash-01.intern:9600"
  - "https://logstash-02.intern:9600"
```

Die API muss vom Collector erreichbar sein. `/_node/stats` wird angehaengt;
keine Zugangsdaten in URLs schreiben. HTTPS verwendet normale Zertifikats- und
Hostnamenpruefung mit dem JVM-Truststore. Eigene CAs muessen dort vertraut sein.
Zusaetzliche API-Authentifizierung (Basic Auth, Bearer oder Clientzertifikate)
ist noch nicht implementiert. Das Plugin aendert keine Logstash-Firewall oder
API-Konfiguration und bietet keinen Browser-Proxy. Bei Nichterreichbarkeit oder
HTTP 401/403 wird das Ziel als fehlgeschlagen angezeigt; andere Ziele und die
OpenSearch-Erfassung laufen weiter. Mit `stack_monitoring.logstash.enabled: false`
werden alle Logstash-Abfragen deaktiviert.

Die Gestaltung orientiert sich an der Navigation des Elastic Stack Monitoring;
es ist eine eigene Implementierung mit OpenSearch-/EUI-Komponenten.
Kein Beats-Monitoring, Alerting oder externer Verfuegbarkeitstest.
Bei einem vollstaendigen Clusterausfall kann der Cluster keine neuen Messungen
mehr schreiben. Bereits gespeicherte Messungen bleiben erhalten.

Fachliche Grundlagen:
[OpenSearch-Plugin-Einstieg](https://opensearch.org/blog/my-first-steps-in-opensearch-plugins/),
[Dashboards-Plugin-Einstieg](https://opensearch.org/blog/dashboards-plugins-intro/),
[Nodes Stats](https://docs.opensearch.org/latest/api-reference/nodes-apis/nodes-stats/).
