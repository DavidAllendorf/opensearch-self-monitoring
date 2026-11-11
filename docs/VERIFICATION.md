# Verifikation fuer OpenSearch 3.6.0

Pluginversion 0.3.0 wurde gegen OpenSearch und OpenSearch Dashboards 3.6.0 gebaut.
Historische Ergebnisse stehen in VERIFICATION-3.9.md.

- Java: Gradle-Tests und Plugin-ZIP gegen echte 3.6.0-Abhaengigkeiten.
- Dashboard: sechs Quelltests, TypeScript-Pruefung im 3.6.0-Quellbaum und offizieller Plugin-Helpers-Build mit Node 22.22.0.
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
