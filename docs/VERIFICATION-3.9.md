# Pruefprotokoll

Stand: 11.11.2026, Version 0.1.0, Zielplattform 3.9.0.

## Geprueft

- Java-Compilation mit JDK 21 gegen die veroeffentlichten OpenSearch-3.9.0-APIs.
- Java-Unit-Tests: Raten, Zaehler-Resets, Latenz, UTC und enge Retention-Loeschgrenzen.
- TypeScript-Unit-Tests: Zeitbucket-Grenzen, Abfragefilter und fehlende Werte.
- Native Integration auf Debian 13 mit echtem OpenSearch 3.9.0 und aktiver
  OpenSearch Security, eigener Cluster auf Ports 19200/19300, eigene Datenpfade.
- Der interne Collector schreibt ohne Benutzerpasswort bei aktiver Security.
- Mehrere aufeinanderfolgende Samples, Cluster-/Knotendokumente und Indexdetails
  fuer einen Testindex mit fuenf Dokumenten sowie berechnete Raten.
- Retention im echten Cluster: abgelaufener eigener Tagesindex entfernt;
  ein aehnlich benannter Backup-Index und ein fremder Index blieben bestehen.
- Dashboards-Typpruefung gegen den offiziellen 3.9.0-Quellbaum ohne Fehler.
- Browser-Bundle und installierbares Dashboards-ZIP mit den offiziellen
  `@osd/plugin-helpers` gebaut, ohne eigene Nachbildung des Bundleformats.
- ZIP auf einer separaten nativen Dashboards-3.9.0-Instanz geladen.
- API mit echtem Login: Monitoring-Leser erhaelt Daten, ein Nutzer ohne
  Indexrechte erhaelt HTTP 403. Ungueltige Zeitraeume und Entity-Anfragen
  werden mit HTTP 400 abgelehnt. History bleibt auf weniger als 125 Buckets begrenzt.
- Integrierter Browser: Login, Clusterkarten, vier Zeitdiagramme, Knotentabelle,
  Knotendetail, Indextabelle, Indexverlauf und Pause erfolgreich bedient.
- Testkonten und Testindizes wurden entfernt, die separaten Testinstanzen gestoppt.

Eine Live-Installation auf dem eigentlichen Logging-Cluster ist nicht Teil dieser
isolierten Pruefung.

Nicht geprueft: Mehrknoten-Failover, Lasttests mit vielen Indizes, andere
Plattformversionen und externe Authentifizierungsprovider. Die CI-Definition
ist mitgeliefert; ein erfolgreicher GitHub-CI-Lauf wird hier nicht behauptet.
