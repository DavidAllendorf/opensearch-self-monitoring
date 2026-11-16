# Alerts (Dashboard 0.7.0)

Unter OpenSearch und Logstash gibt es jeweils einen direkt verlinkbaren Alerts-Tab:
`#/opensearch/alerts` bzw. `#/logstash/alerts`. Er verwendet dieselben lesegeschuetzten
Monitoring-Daten wie die Uebersicht. Keine neuen Endpunkte, Schreibrechte, externen
Dienste, E-Mails oder Konfiguration. Kein OpenSearch-Alerting- oder ML-Plugin erforderlich.

## Regeln

| Messwert | Warnung | Kritisch |
| --- | --- | --- |
| Node CPU / JVM Heap | >= 85 % | >= 95 % |
| OpenSearch-Dateisystem belegt | >= 85 % | >= 95 % |
| Primary-Shards pro OpenSearch-Node | > 3 | - |
| OpenSearch Threadpool-Queue (gesamt) | >= 100 | >= 1.000 |
| Clusterstatus | Gelb | Rot |
| Nicht zugewiesene Shards | > 0 | Bei rotem Cluster |
| Logstash API-Ausfaelle | - | > 0 Ziele |
| Ingest-Pipeline-Fehlerrate | > 0/s | - |
| Logstash Worker-Auslastung | >= 90 % | >= 99 % |
| Logstash Queue Backpressure | >= 1 | >= 5 |
| Keine frischen Collector-Daten | - | Alter > max(30 s, 3 Messintervalle) |

Primary-Shards umfassen System- und Monitoring-Indizes. Die Grenze 3 ist eine
ausdruecklich gewuenschte Betriebsrichtlinie, kein OpenSearch-Limit oder allgemeiner
Ratschlag zur Shard-Anzahl. Auch ein gesunder Einzelknotencluster kann sie ausloesen.
Prozentwerte werden vor dem Vergleich nicht gerundet. Momentane Ressourcen-Schwellwerte
werden nicht zeitlich geglaettet und koennen kurze Lastspitzen anzeigen. Kumulative
Fehlerzaehler werden nicht als neue Fehler interpretiert.

## Anomalien

Die OpenSearch-Indexierungs-/Suchrate und die Logstash-Outputrate werden auf
heuristische Abweichungen geprueft, ohne ML-Modell. Basis ist der Verlauf des
ausgewaehlten Zeitraums: bis zu 30 vorherige abgeschlossene Histogrammintervalle.
Mindestens 8 gueltige Werte und mindestens 80 % Datenabdeckung sind erforderlich.
Das aktuelle unvollstaendige Intervall wird ausgeschlossen. Der letzte komplette
Wert darf nicht aelter als eine Intervallbreite plus max(30 s, 3 Messintervalle) sein.

- Anstieg: > 3-facher Median, > Median + 6-fache mediane absolute Abweichung
  (MAD) und > 10 Operationen/s.
- Rueckgang: < 20 % des Medians, sofern der Median mindestens 10/s betraegt.

Der Zeitbereich bestimmt die Histogrammbreite und damit die Bedeutung der
Abweichung. Bei 15 Minuten dauert der Start typischerweise etwa 3 Minuten;
bei laengeren Zeitbereichen sind mehr historische Daten notwendig. Geplante
Lastwechsel koennen Hinweise ausloesen; sie sind kein sicherer Fehlernachweis.

## Verhalten und Wartung

Hinweise werden mit jedem Poll neu berechnet und verschwinden bei nicht mehr
erfuellter Bedingung. Keine Historie, Quittierung oder Hintergrundausfuehrung bei
geschlossenem Browser. Pausieren haelt auch die Alert-Auswertung auf dem letzten
geladenen Stand. Veraltete Daten erzeugen ausschliesslich einen Erfassungsalarm;
andere Bedingungen werden bis zur naechsten Messung ausgesetzt. Fehlende Daten
und Grenzen der Auswertung werden separat angezeigt und gelten nicht als gesund.

Schweregradfilter, Textsuche und Links fuehren zu den vorhandenen Detailansichten.
Die reinen Regelfunktionen stehen in `dashboards-plugin/public/alerts.ts`, die
Darstellung in `public/components/alerts_page.tsx`. Schwellen und Beschreibungen
bei Aenderungen gemeinsam aktualisieren, anschliessend `npm test` und den
Dashboard-TypeScript-/Plugin-Helpers-Build ausfuehren. Der Java-Collector 0.6.0
liefert bereits alle benoetigten Werte; fuer 0.7.0 muss nur Dashboards neu starten.
