# Stack-Topologie

Unter **Stack Monitoring > Topologie** erscheinen die Komponenten des aktuellen
Samples in fuenf Spalten: Logstash-Server, deren Pipelines, OpenSearch-Cluster,
OpenSearch-Nodes und deren Ingest-Pipelines. Keine neue Bibliothek, kein APM,
Tracing oder externer Dienst erforderlich. Die Karte verwendet dieselbe
geschuetzte Overview-API und Aktualisierung wie die vorhandenen Ansichten.

## Bedienung und Bedeutung

- Komponenten anklicken: Messwerte, stabile IDs und verlinkte Monitoring-Details.
- Suche nach Node, Pipeline, ID oder Rolle. Direkte Nachbarn der Treffer bleiben
  sichtbar. Zoom 50 bis 200 Prozent; die Karte ist auch per Tastatur scrollbar.
- Maximal 160 Komponenten gleichzeitig rendern. Bei mehr Treffern weist die
  Oberflaeche auf ausgelassene Komponenten hin; Suche grenzt die Ansicht ein.
- Durchgezogene Linien bedeuten **Zugehoerigkeit**, keine TCP-Verbindung und
  keinen gemessenen Datenfluss. Insbesondere zeigen Cluster-Node-Linien keine
  Transportverbindungen, Replikation oder Routing einzelner Dokumente.
- Gestrichelte Pfeile bedeuten **konfigurierte Datenfluss-Zuordnung**. Sie
  bestaetigen keine aktive Verbindung oder erfolgreiche Zustellung.
- Farben verwenden die Ressourcen-/Pipeline-Schwellen unter
  `stack_monitoring.alerts`: CPU, Heap, Dateisystembelegung, Threadpool-Queue,
  Worker-Auslastung, Backpressure und Ingest-Fehlerrate. Clusterzustand,
  unzugewiesene Shards und fehlgeschlagene Logstash-Abfragen fliessen ebenfalls
  ein. Dies ersetzt nicht die vollstaendige Alerts-Seite mit Anomalien und
  Primary-Shard-Regeln. Grau bedeutet fehlende Bewertungsdaten oder veraltete
  Samples. Fehlende Raten werden nicht als Null dargestellt.

## Optionale Logstash-Ziele

Ohne Konfiguration werden alle bereits erfassten Komponenten und ihre
Zugehoerigkeiten angezeigt. Entfernte Logstash-Server muessen weiterhin in der
bestehenden Collector-Konfiguration `stack_monitoring.logstash.urls` stehen;
es gibt keinen Netzwerk-Scan. Die API-Statistiken verraten keine verlaesslichen
Output-Hosts. Gleich hohe Raten oder ein Output-Typ `opensearch` beweisen kein Ziel.

Fuer bekannte Verbindungen auf **allen Dashboards-Instanzen** in die vorhandene
Konfiguration einfuegen (bestehende `stack_monitoring.alerts` beibehalten):

```yaml
stack_monitoring:
  topology:
    links:
      - logstash_node_id: "LOGSTASH-NODE-UUID"
        pipeline_id: "main"
        target_cluster_uuid: "OPENSEARCH-CLUSTER-UUID"
```

IDs stehen im Detailbereich der Karte. Es gelten exakte IDs, keine Anzeigenamen,
Wildcards oder URLs. Gleichnamige Pipelines auf verschiedenen Nodes bleiben
getrennt. Maximal 500 Eintraege. Doppelte Zuordnungen ergeben nur einen Pfeil.
Eintraege ohne passende aktuelle Pipeline oder mit anderer Cluster-UUID werden
als nicht aufloesbar gemeldet; es werden keine fremden Cluster erfunden.
Die Karte ist auf den gerade ueberwachten Cluster beschraenkt. Die Zuordnungen
sind deklarative Angaben und werden mit der Overview-API an Monitoring-Leser
ausgeliefert. Keine Zugangsdaten oder vertraulichen URLs eintragen.

## Auslieferung und Grenzen

Nur das **Dashboard-Plugin (0.9.0)** hat sich fuer diese Funktion geaendert. Es nutzt
die vorhandenen Metriken des Collectors 0.8.0 auf OpenSearch 3.6.0. Das Java-Plugin
und dessen Mapping bleiben unveraendert. Ein OpenSearch-Neustart ist nicht
erforderlich. Dashboard-Plugin wie in DELIVERY.md beschrieben bauen und auf
allen Dashboards-Nodes ersetzen, diese kontrolliert neu starten. Aenderungen
an der optionalen YAML-Konfiguration erfordern ebenfalls einen Dashboards-Neustart.

Keine automatische Erkennung von Logstash-Output-Adressen, Pipeline-zu-Pipeline-
Verbindungen, Index-Zielen, physischen Hosts oder Dashboards-Instanzen. Die Karte
stellt den letzten Sample-Zustand dar, keine historische Topologie des gesamten
ausgewaehlten Zeitraums. Fehlende APIs, Erfassungslimits und Sample-Luecken koennen
zu fehlenden Komponenten fuehren. Nicht erreichbare Logstash-Ziele lassen sich
aus den bisherigen Metriken nur zaehlen, nicht individuell benennen.
