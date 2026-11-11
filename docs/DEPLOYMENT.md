# Native Auslieferung auf 3.6.0

Ziel: 192.168.178.40, OpenSearch und OpenSearch Dashboards 3.6.0, Pluginversion 0.2.0.
Installation ohne Container.

Artefakte auf dem Server:

- /opt/opensearch-self-monitoring/releases/0.2.0/stack-monitoring-0.2.0.zip
- /opt/opensearch-self-monitoring/releases/0.2.0/stackMonitoring-3.6.0.zip

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
