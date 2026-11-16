# Native Auslieferung: Plugins 0.8.0 auf OpenSearch/Dashboards 3.6.0

Umgebungsneutrale Anleitung; Voraussetzungen und Uebernahme stehen in ADOPTION.md.

1. SHA256SUMS.txt pruefen und vorherige ZIPs sowie Dashboard-YAML fuer Rollback sichern.
2. Collector stoppen, altes stack-monitoring entfernen, stack-monitoring-0.8.0.zip
   installieren und nur diesen OpenSearch-Node wieder starten.
3. Dashboard-Plugin auf allen Dashboards-Instanzen kontrolliert nacheinander
   ersetzen. Gleiche optionale stack_monitoring.alerts-Werte aus der Beispiel-YAML
   ausrollen und Dashboards starten.
4. Anmeldung, frische Samples, Cluster-/Node-/Index-/Pipeline-Details und Alerts pruefen.
   Bei altem Bundle Browser-Cache leeren bzw. Strg+F5 und einen neuen Tab oeffnen.

0.8.0 aendert den Java-Namensraum auf de.ba.opensearch.monitoring. Deshalb muss
der Collector einmal neu starten. Andere Cluster-Nodes brauchen keinen Neustart.
Auf einem kombinierten Einzelknotenserver betrifft dies den gesamten OpenSearch-
Prozess. Spaetere reine Schwellen-Aenderungen erfordern nur Dashboards-Neustarts.

Das Mapping wird additiv um allocation_index_primaries ergaenzt. Alte Samples
bleiben lesbar; die neue Regel funktioniert nach einem frischen 0.8.0-Sample.
Pro Node bleiben die 1.000 Indizes mit den meisten Primaries sichtbar, unabhaengig
von der Shard-Detailtabelle. Begrenzungen werden angezeigt.

Keine Datenindizes, Benutzer oder TLS-Einstellungen fuer das Update loeschen oder
neu initialisieren. Fuer Rollback die vorherigen ZIPs bei gestoppten Diensten
installieren und die vorherige YAML wiederherstellen: Dashboard 0.7.0 kennt die
neuen Konfigurationsschluessel noch nicht. Das additive Mapping darf bleiben.
Installationsbefehle stehen in DELIVERY.md.
