# Native Auslieferung auf 3.6.0

## Produktionsstand 0.6.0

Am 12.11.2026 wurden beide Plugins auf 192.168.178.40 auf 0.6.0 aktualisiert.
OpenSearch/Dashboards bleiben auf 3.6.0. Neu sind Shard Activity, eine kompaktere
Standardansicht und funktionierende Zusatzdiagramme auch in der Cluster-Uebersicht.
Die neuen Recovery-/Shard-Felder wurden additiv im vorhandenen Tagesindex ergaenzt;
bestehende Monitoring-Daten bleiben erhalten. 0.5.0 bleibt als Plugin-Rollback erhalten.

## Release 0.5.0 fuer die eigene Installation

0.5.0 wird als Paket fuer die einmalige Installation auf einem dedizierten
Collector-Node bereitgestellt. Dieser Node muss dem ueberwachten Cluster angehoeren;
seine Rolle ist frei waehlbar, empfohlen ist `node.roles: []` (coordinating-only).
Andere OpenSearch-Nodes brauchen das Java-Plugin nicht. Das Dashboard-Plugin wird
auf allen Dashboards-Instanzen dieses Clusters installiert. Installation und Updates
erfordern nur deren jeweilige Neustarts. Details und Umzugshinweise: DELIVERY.md.

Mehrere lokale oder entfernte Logstash-Instanzen werden mit
`stack_monitoring.logstash.urls` explizit konfiguriert. Die Authentifizierung der
Arbeitsumgebung ist noch offen; zusaetzliche API-Authentifizierung ist in 0.5.0
nicht implementiert. HTTPS mit regulaerer Zertifikatspruefung wird unterstuetzt.

Entwicklung und Integrationstest erfolgten zunaechst mit separaten nativen
Testprozessen, ohne produktive Neustarts. Am 12.11.2026 wurde 0.5.0 auf ausdruecklichen
Wunsch auch auf 192.168.178.40 installiert: Java- und Dashboard-Plugin jeweils
0.5.0, OpenSearch/Dashboards weiterhin 3.6.0. Auf diesem kombinierten Testserver
laufen Collector und Cluster-Manager im selben Prozess; dessen Neustart war
fuer das Plugin-Update einmalig erforderlich. Dies aendert nicht die Empfehlung
fuer einen separaten Collector in der Arbeitsumgebung.

Anmeldung ueber Pangolin, lokale Logstash-main-Pipeline, Node-/Shard-Details,
fortlaufende Metriken und gruener Clusterstatus wurden nach der Installation
geprueft. Die vorhandenen 0.4.0-Pakete bleiben fuer einen Plugin-Rollback erhalten.
Die Arbeitsumgebung wird nicht automatisch beliefert.

## Bisheriger Produktionsstand 0.4.0

Ziel: 192.168.178.40, OpenSearch und OpenSearch Dashboards 3.6.0, Pluginversion 0.4.0.
Installation ohne Container.

Artefakte auf dem Server:

- /opt/opensearch-self-monitoring/releases/0.4.0/stack-monitoring-0.4.0.zip
- /opt/opensearch-self-monitoring/releases/0.4.0/stackMonitoring-3.6.0.zip

0.4.0 ergaenzt lokale Index- und Shardtabellen in jeder OpenSearch-Node-Ansicht.
Neue Node-Felder werden additiv im vorhandenen Metrikmapping ergaenzt.
Die vorherigen 0.3.0-ZIPs bleiben fuer einen Plugin-Rollback erhalten.

0.3.0 ergaenzt Produktnavigation, Detailseiten, Ingest- und lokale Logstash-
Pipelines. Das heutige Metrikmapping wird additiv erweitert; bestehende
Monitoring-Dokumente bleiben erhalten.

Die alten Plugins wurden bei gestoppten Diensten entfernt und die neu gebauten
3.6-Plugins mit den offiziellen Installern installiert. Dashboards bleibt im
privaten Netzwerk auf Port 5601 und ueber Pangolin unter
https://opensearch.home-da.de/app/stackMonitoring erreichbar.
Die vorhandene native Anmeldung bleibt bestehen; Zugangsdaten stehen nicht im Git.

## Plattformmigration

Ein neueres Datenverzeichnis darf nicht direkt mit einer aelteren OpenSearch-Version
geoeffnet werden. Logs, Monitoring-Historie, gespeicherte Objekte, Mappings, Aliase
und benutzerdefinierte Templates wurden deshalb logisch exportiert und in einer
frischen 3.6-Datenablage wiederhergestellt. Die Dokumentzahlen wurden vor dem
Paketwechsel verglichen. Dashboards 3.6 migriert die gespeicherten Objekte selbst.
Plattforminterne Seed-Indizes werden neu erzeugt.

Alle neun Security-Konfigurationstypen wurden separat uebernommen. Nur die
Audit-Kategorien CLUSTER_SETTINGS_CHANGED und INDEX_SETTINGS_CHANGED wurden aus
den Audit-Filterlisten entfernt, weil 3.6 diese Namen nicht kennt.

Private Sicherungen auf dem Server liegen unter /opt/opensearch-migration-3.6/:
final-export, security-backup, security-3.6 und rollback-3.9 mit den originalen
Daten, Konfigurationen und 3.9-Paketen. Sie enthalten sensible Daten und gehoeren
nicht ins Git.

Fuer einen Plattform-Rollback alle vier Dienste stoppen, 3.6-Plugins entfernen,
originale 3.9-Pakete und Konfigurationen wiederherstellen, das originale gesicherte
Datenverzeichnis zuruecksetzen und die 0.1.0-Plugins installieren.
Nach dem Start die persistente Einstellung cluster.blocks.read_only mit dem
Admin-Zertifikat auf null setzen und Dashboards, Logstash und Filebeat starten.
Spaeter neu eingegangene Daten muessen bei einem Rollback separat uebernommen werden.

Entwicklung und regulaere Updates: DEVELOPMENT.md und DELIVERY.md.
Historische Auslieferung: DEPLOYMENT-3.9.md.
