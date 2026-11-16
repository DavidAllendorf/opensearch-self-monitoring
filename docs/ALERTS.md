# Alerts (0.8.0)

Je Produkt gibt es einen Alerts-Tab: #/opensearch/alerts und #/logstash/alerts.
Die Auswertung liest dieselben geschuetzten Metriken wie die Uebersicht; keine
externen Dienste, E-Mails, neuen Schreibrechte, Alarmhistorie oder Quittierung.

## Konfiguration

Alle Schwellen stehen unter stack_monitoring.alerts in opensearch_dashboards.yml.
Die vollstaendige, kommentierte Beispielkonfiguration unter
config/opensearch_dashboards.yml.example ist massgeblich. Nicht angegebene Werte
behalten ihren Default. Dieselbe YAML auf alle Dashboards-Instanzen verteilen und
diese neu starten. Die Oberflaeche zeigt die tatsaechlich aktiven Serverwerte.
Ungeltige Schluessel, ungueltige Typen/Grenzen und widerspruechliche Werte verhindern
den Start. Gemeinsame Defaults: dashboards-plugin/common/alert_config.ts;
Schema: dashboards-plugin/server/config.ts.

Defaults: CPU/Heap/Dateisystem 85/95 %, OpenSearch-Queue 100/1.000,
Logstash-Worker 90/99 %, Backpressure 1/5, Primary-Grenze 3,
nicht zugewiesene Shards/Logstash-Ausfaelle/Ingest-Fehlerrate jeweils > 0.
Gelb warnt, Rot ist kritisch. Erfassung veraltet nach max(30 s, 3 Messintervalle).

## Primary-Shards und betroffene Nodes

Die Regel zaehlt Primary-Shards DESSELBEN Index (UUID) auf DERSELBEN Node:
mehr als primary_shards_per_index loest aus; genau die Grenze nicht.
Die Primaries verschiedener Indizes werden nie addiert. Replicas zaehlen nicht.
Dies ist eine Betriebsrichtlinie, kein OpenSearch-Limit. Mehrere identische
Kopien derselben Shard-ID auf einer Node werden dadurch nicht behauptet.

Collector 0.8.0 liefert kompakte Index-Zaehler separat von der grossen Shard-Liste.
Alle Routing-Eintraege werden gezaehlt, dann die 1.000 Indizes mit den meisten
Primaries je Node gespeichert. Fehlende oder begrenzte Zaehler werden als Grenze
der Auswertung angezeigt. Ein alter Collector liefert hier keinen gesunden Nullwert.

Warnungen derselben Regel und Schwere werden zusammengefasst, bei der Shard-Regel
zusaetzlich getrennt je Index-UUID. Die Spalte Betroffene Nodes listet Node-Namen
mit Links zu Details. Messwerte und Pipeline-Zuordnung bleiben in der Zeile erhalten.
Bei rein clusterweiten Anomalien, nicht zugewiesenen Shards oder unerreichbaren
APIs ist aus den verfuegbaren Daten keine bestimmte betroffene Node ableitbar;
die Seite nennt diese Einschraenkung anstelle einer erfundenen Liste.

## Anomalien und Aktualitaet

OpenSearch-Indexierungs-/Suchrate und Logstash-Outputrate werden heuristisch
verglichen. Defaults: bis 30 vorherige abgeschlossene Histogrammintervalle,
mindestens 8 gueltige Werte und 80 % Abdeckung. Das laufende unvollstaendige
Intervall wird nicht verwendet. Der letzte komplette Wert muss frisch sein.

Anstieg: > spike_ratio * Median UND > Median + mad_multiplier * MAD
UND > min_rate (Defaults 3, 6, 10/s). Rueckgang: < drop_ratio * Median, sofern
der Median mindestens min_rate betraegt (Defaults 0,2 und 10/s).
MAD ist die mediane absolute Abweichung. Alle diese Werte sind konfigurierbar.
Der gewaehlte Zeitraum bestimmt die Histogrammbreite; Lastwechsel koennen
berechtigte Hinweise ausloesen und sind kein sicherer Fehlernachweis.

Ressourcen-Schwellwerte gelten fuer den aktuellen Messwert ohne Glaettung oder
Rundung. Hinweise verschwinden nach Ende der Bedingung. Pause haelt den letzten
Stand; bei veralteten Daten oder API-Fehlern werden andere Regeln ausgesetzt.
Fehlende Metriken gelten nicht als gesund. Kumulative Fehlerzaehler werden nicht
als neue Fehler interpretiert. Regelcode: public/alerts.ts; Darstellung:
public/components/alerts_page.tsx. Tests und Build siehe DEVELOPMENT.md.
