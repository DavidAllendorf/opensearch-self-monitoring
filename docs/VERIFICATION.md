# Verifikation fuer OpenSearch 3.6.0

Beide Plugins stehen auf 0.8.0 fuer OpenSearch/Dashboards 3.6.0.
Historische Ergebnisse stehen in VERIFICATION-3.9.md.

## 0.8.0

- 28 TypeScript-Quelltests erfolgreich: Primary-Regel je Index-UUID und Node,
  keine Summierung verschiedener Indizes/Replicas, gruppierte Hinweise mit
  allen betroffenen Nodes, konfigurierbare Ressourcen-/Shard-/Anomalie-Grenzen.
- 15 Java-Tests im Namensraum de.ba erfolgreich; JAR ohne alte persoenliche
  Pakete. Begrenzte Index-Zaehler behalten die hoechsten Primary-Konzentrationen
  und bleiben unabhaengig vom Shard-Zeilenlimit korrekt.
- Zwei Tests mit der echten Dashboards-Konfigurationsschema-Laufzeit: Defaults,
  Teilueberschreibungen, unbekannte Schluessel, negative/ungueltige Werte und
  widerspruechliche Grenzwerte. TypeScript und offizieller 3.6.0-Build erfolgreich.
- Native Installation beider 0.8.0-Plugins, de.ba-Einstiegspunkt und gruener
  Cluster geprueft. Alle gespeicherten Primary-Zaehler mit nativer Shard-API
  verglichen; vier Primaries eines leeren Testindex korrekt erfasst.
- Authentifizierte Dashboard-API liefert temporaere YAML-Teilueberschreibungen
  und ergaenzte Defaults. Index-Zaehler nur bei Alerts-Abfrage im Node-Payload;
  grosse Shard-Arrays bleiben aus der Uebersichtsantwort ausgeschlossen.
- Nach Rueckkehr zu den urspruenglichen Defaults zeigt der Browser eine Warnung
  fuer den vier-Primary-Testindex, mit betroffener Node und funktionierendem
  Node-Link. Die zahlreichen Primaries anderer Indizes werden nicht addiert.
  Testindex anschliessend gezielt entfernt; temporaere YAML-Ueberschreibungen
  und Cache-Header entfernt, Originalkonfiguration bytegleich wiederhergestellt.
- Browser nach Entfernung des Testindex: keine ausgeloeste Regel, trotz der
  weiterhin vorhandenen zahlreichen Primaries verschiedener Indizes. Dadurch
  ist der fruehere Fehlalarm auf die Gesamtzahl beseitigt.

## Historisch: Alerts 0.7.0 (damals Gesamt-Primaries pro Node)

- 24 TypeScript-Quelltests erfolgreich: darunter 10 neue Tests fuer strikte
  Primary-Grenze (> 3), ungerundete Ressourcen-Schwellwerte, fehlende Werte,
  veraltete Samples, Produkttrennung, Pipeline-Raten statt kumulativer Fehler,
  eindeutige Pipeline-Identitaet sowie Anomalien bei unvollstaendigen Buckets,
  Datenluecken, variabler Basis und fehlender Historie.
- Der Java-Collector bleibt unveraendert auf 0.6.0; keine neuen Mappings,
  API-Routen, Berechtigungen oder Laufzeitabhaengigkeiten fuer die Alerts.
- TypeScript-Pruefung im offiziellen 3.6.0-Quellbaum und Plugin-Helpers-Build
  mit Node 22.22.0 erfolgreich. Das fertige ZIP wurde auf dem nativen Server
  installiert; Dashboards 0.7.0 bereit, OpenSearch-Prozess-ID unveraendert,
  neue Collector-Samples und gruener Cluster bestaetigt.
- Browser ueber Pangolin: OpenSearch-Alerts mit realen 22 Primary-Shards,
  Schweregradfilter, Textsuche inklusive Leerzustand und Link zur betroffenen
  Node geprueft. Die Shard-Detailansicht bestaetigt 22 Primary- und 0 Replica-Kopien.
  Logstash-Alerts zeigen korrekt keine ausgeloeste Regel. Ausklappbare Regeln
  und Layout visuell geprueft; Screenshot im Auslieferungsworkspace gespeichert.
- Beim kontrollierten Dashboards-Neustart pausierte die Alert-Auswertung bei
  API-Fehlern und nahm nach Wiederherstellung wieder auf. Der alte Browser-Cache
  wurde fuer die Pruefung verworfen; die temporaere Cache-Header-Konfiguration
  ist entfernt und die urspruengliche YAML bytegleich wiederhergestellt.

## Bisherige Pruefungen 0.6.0 und aelter

- Java: Gradle-Tests und Plugin-ZIP gegen echte 3.6.0-Abhaengigkeiten.
- Dashboard: 14 Quelltests, TypeScript-Pruefung im 3.6.0-Quellbaum und offizieller Plugin-Helpers-Build mit Node 22.22.0.
- 0.6.0: Zusatzdiagramme fuer alle angebotenen Ansichten, Zeitfilter fuer DONE-
  Recoveries und Erhaltung lange laufender Recoveries, Priorisierung/Begrenzung
  der Recovery-Zeilen, Fortschritt ohne Dateinamen und ohne erfundene Translog-Werte.
- Auf dem Zielserver: gespeicherte Recovery-Zuordnungen gegen die native Recovery-
  API verglichen; lokale Logstash-Pipeline, Node-/Shard-Details, Anmeldung und
  Filebeat-Logstash-OpenSearch-Zustellung erfolgreich, Cluster gruen.
- Browser 0.6.0: Cluster-Uebersicht von vier auf zehn Diagramme erweitert und
  wieder eingeklappt; Logstash-Uebersicht erhaelt ihr Zusatzdiagramm. In der
  Node-Shard-Tabelle wird kein wirkungsloser Diagrammschalter mehr angeboten.
  Recovery-Filter mit korrektem Leerzustand sowie kompakte, mehrzeilige Zellen
  und die gesamte Standardansicht visuell geprueft.
- Neue Tests pruefen explizite HTTP(S)-Basis-URLs, die Ablehnung von URL-Zugangsdaten,
  Gesamt-Durchsatz mehrerer Logstash-Instanzen und fehlende Werte statt falscher Nullen.
- Native 0.5.0-Pruefung ohne Produktionsneustart: separater Zweiknotencluster,
  Manager/Data-Node ohne Monitoring-Plugin und coordinating-only Collector mit
  Plugin. Vollstaendige Cluster-, Node- und Shard-Metriken werden fortlaufend erfasst.
- Zwei simulierte Logstash-APIs auf abweichenden Ports, eine ueber HTTP und eine
  ueber HTTPS mit vertrauter Test-CA. Eine Alias-URL derselben UUID wird nicht
  doppelt erfasst. Weiterleitung und unerreichbares Ziel werden als Fehler
  gezaehlt, ohne die anderen Ziele oder OpenSearch-Metriken zu unterbrechen.
- Separate native Dashboards-Instanz mit 0.5.0, verbunden ausschliesslich mit
  dem coordinating-only Collector: Login, zwei Logstash-Instanzen, Teilfehler,
  korrekter Gesamt-Durchsatz (etwa 9 Events/s statt 18 bei zwei Samples im
  Zeitbucket) und bestehende Node-/Shard-Detail-API erfolgreich geprueft.
- Shard-Tests: Primary/Replica, Relocation-Quelle und -Ziel, vollstaendige Zaehler
  bei begrenzten Zeilen, lokale Indexsummen, fehlende Stats und Index-UUID-Identitaet.
- 0.4.0 auf dem nativen Ziel: Node-Snapshot gegen das echte Cluster-Routing
  abgeglichen, einschliesslich System- und Monitoring-Shards. Detailantworten
  stimmen in Node-ID, Cluster-UUID und Zeitstempel mit dem Uebersichtssample ueberein.
  Grosse Shard-Arrays werden nur fuer den ausgewaehlten Node zurueckgegeben.
- Die neue Node-Detailabfrage funktioniert mit der Monitoring-Leserolle und
  weist Nutzer ohne Leserechte mit 403 ab.
- Browserpruefung 0.4.0: lokale Indexliste, Seitenwechsel und Aktualisierung,
  Indexsuche von Seite 2, Klick vom Index zu seinen Shards sowie Filter nach
  Index, Primary/Replica und Zustand. Shard-IDs, P/R-Badges und Zustandsanzeigen
  wurden mit den echten Node-Daten geprueft.
- Java-Pipeline-Tests: keine Konfiguration oder Zugangsdaten in Metriken,
  Infinity als fehlender Wert, korrekte Raten und Verwerfen der Basis bei Pipeline-Neustarts.
- Native Testinstanzen: beide ZIPs installiert; automatische Erfassung, Cluster-, Knoten-, Indexdaten und Zeitreihen erfolgreich abgefragt.
- Berechtigungen: Lesebenutzer bekommt Daten, Benutzer ohne Indexrechte 403; ungueltige Abfragen bekommen 400.
- Browser: Dashboard 3.6.0 mit Kennzahlen, Diagrammen und Tabellen geladen.
- 0.3.0 auf dem nativen Ziel: echte Logstash-main-Pipeline mit Beats-Input und
  OpenSearch-Output; temporaere Ingest-Pipeline mit erfolgreichem und absichtlich
  fehlgeschlagenem Event, beide Prozessoren und Fehlerzaehler geprueft.
- Produkt-/Untertabs, Node- und Indexdetail, Ingest- und Logstash-Pipelinedetail
  sowie Browser-Zurueck im integrierten Browser geprueft. Testpipeline und
  Testindex werden nach der Pruefung entfernt.
- Berechtigungstest auf dem Ziel: Leser erfolgreich, unberechtigter Nutzer 403,
  ungueltige Abfragen 400. Testbenutzer und Testrollen danach entfernt.
- Datenmigration: logischer Export aus 3.9.0, Import in frische 3.6.0-Datenablage; Dokumentzahlen aller uebernommenen Indizes abgeglichen.

Fuer 3.6 waren neben Versionsangaben React-Imports fuer dessen JSX-Build und
das Entfernen der dort nicht vorhandenen NavLink-Eigenschaft euiIconType erforderlich.
Ein blosses Umbenennen vorhandener 3.9-ZIPs reicht nicht.
