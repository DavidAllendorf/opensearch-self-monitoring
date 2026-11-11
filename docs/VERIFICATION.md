# Verifikation fuer OpenSearch 3.6.0

Pluginversion 0.2.0 wurde gegen OpenSearch und OpenSearch Dashboards 3.6.0 gebaut.
Historische Ergebnisse stehen in VERIFICATION-3.9.md.

- Java: Gradle-Tests und Plugin-ZIP gegen echte 3.6.0-Abhaengigkeiten.
- Dashboard: vier Quelltests, TypeScript-Pruefung im 3.6.0-Quellbaum und offizieller Plugin-Helpers-Build mit Node 22.22.0.
- Native Testinstanzen: beide ZIPs installiert; automatische Erfassung, Cluster-, Knoten-, Indexdaten und Zeitreihen erfolgreich abgefragt.
- Berechtigungen: Lesebenutzer bekommt Daten, Benutzer ohne Indexrechte 403; ungueltige Abfragen bekommen 400.
- Browser: Dashboard 3.6.0 mit Kennzahlen, Diagrammen und Tabellen geladen.
- Datenmigration: logischer Export aus 3.9.0, Import in frische 3.6.0-Datenablage; Dokumentzahlen aller uebernommenen Indizes abgeglichen.

Fuer 3.6 waren neben Versionsangaben React-Imports fuer dessen JSX-Build und
das Entfernen der dort nicht vorhandenen NavLink-Eigenschaft euiIconType erforderlich.
Ein blosses Umbenennen vorhandener 3.9-ZIPs reicht nicht.
