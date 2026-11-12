# Verifikation fuer OpenSearch 3.6.0

Pluginversion 0.6.0 wurde gegen OpenSearch und OpenSearch Dashboards 3.6.0 gebaut.
Historische Ergebnisse stehen in VERIFICATION-3.9.md.

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
