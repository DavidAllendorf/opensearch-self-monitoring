# Entwicklung

## Verzeichnisstruktur

```text
opensearch-plugin/       Java: Zeitsteuerung, Stats, Mapping, Speicherung
dashboards-plugin/      TypeScript: geschuetzte API und React-Oberflaeche
scripts/                Build-Hilfe und Integrationstest gegen einen echten Cluster
docs/                   Architektur, Entwicklung und Auslieferung
```

`MetricMath` enthaelt reine Berechnungen, `MetricDocuments` normalisiert die
Stats, `MetricsCollector` steuert den Ablauf. Im Frontend sind Registrierung,
Abfragen, Formatierung, Diagramme und Ansicht getrennt. Es gibt keine eigenen
Laufzeitbibliotheken im Server-Plugin und keine zusaetzliche Diagrammbibliothek.

Der native Integrationstest fuer die Collector-Architektur braucht zwei Nodes
eines separaten Testclusters: einen Manager/Data-Node ohne Monitoring-Plugin und
einen coordinating-only Node mit dem Plugin. So wird eine versehentliche neue
Abhaengigkeit von der Manager-Rolle sichtbar. Dazu HTTP(S)-Logstash-APIs mit
verschiedenen UUIDs und definierten Event-Raten bereitstellen; Alias-URL,
Weiterleitung und nicht erreichbares Ziel mitpruefen. In der Dashboards-API muss
der Durchsatz ueber Nodes addiert werden, ohne mehrere Samples je Zeitbucket
mehrfach zu zaehlen. Produktions-Nodes fuer diesen Test nicht neu starten.

## OpenSearch-Plugin bauen

JDK 21 und ein gesetztes `JAVA_HOME` reichen. Der Wrapper ist versioniert:

```sh
./gradlew :opensearch-plugin:test :opensearch-plugin:pluginZip
```

Ergebnis: `opensearch-plugin/build/distributions/stack-monitoring-0.8.0.zip`.
Unter Windows `gradlew.bat` verwenden. `gradle.properties` legt die beiden
Versionsnummern fest. OpenSearch-Abhaengigkeiten sind `compileOnly`; Plattform-
JARs werden nicht doppelt ins Plugin gepackt.

## Dashboards-Plugin entwickeln und bauen

Empfohlen: Linux/WSL, Node **22.22.0**, Yarn **1.22.19**, mindestens 8 GB RAM fuer
den Build und etwa 8 GB freien Speicher. Den Quellbaum einmalig vorbereiten:

```sh
git clone --depth 1 --branch 3.6.0 https://github.com/opensearch-project/OpenSearch-Dashboards.git
cd OpenSearch-Dashboards
corepack prepare yarn@1.22.19 --activate
yarn osd bootstrap
```

Das Bootstrap als normaler Benutzer ausfuehren. Es baut die internen Werkzeuge
des offiziellen Projekts. Das Release-Paket von Dashboards enthaelt diese
Entwicklungswerkzeuge nicht.

Aus diesem Repository:

```sh
bash scripts/build-dashboards.sh /absoluter/pfad/OpenSearch-Dashboards
```

Das Skript verwendet einen eigenen temporaeren Plugin-Ordner.
Vor dem Bundle-Build prueft es TypeScript und die echte Dashboard-Konfigurations-
Schema-Laufzeit mit Jest; dieselben Checks laufen damit in GitHub Actions.
Fertiges ZIP: `artifacts/stackMonitoring-3.6.0.zip`. Es enthaelt vorkompilierte Browser-Bundles
und transpilierten Servercode. Ein Server braucht zum Installieren keinen Build.

Fuer interaktive Entwicklung stattdessen `dashboards-plugin/` nach
`OpenSearch-Dashboards/plugins/stack_monitoring/` kopieren und dort mit
`yarn start` arbeiten. Alle relativen Core-Imports setzen diese Verzeichnistiefe
voraus. Ein eigener Dev-Cluster ist dringend sinnvoll; keine Optimizer-Builds
im laufenden Dashboards-Prozess.

## Tests

```sh
npm ci
npm test
./gradlew :opensearch-plugin:test
```

Die Java-Tests pruefen Zaehler-Resets, Zeitberechnung, Null-Baselines und die
engen Loeschgrenzen. Die TypeScript-Tests pruefen begrenzte History-Abfragen,
exakte Entity-Filter und fehlende Messwerte.
Die Alerts-Regeln werden ohne React in `public/alerts.ts` getestet: exakte
Schwellengrenzen, fehlende/veraltete Daten, Produkttrennung, Pipeline-Identitaet
und Anomalien mit Datenluecken bzw. unvollstaendigen Zeitintervallen.

Nach Installation auf einem Entwicklungscluster prueft ein echter Integrationstest
die gesamte Erfassung. Er legt einen zufaellig benannten Testindex an und entfernt
nur diesen anschliessend. Das Passwort wird interaktiv abgefragt:

```sh
python3 scripts/smoke_test.py --url https://localhost:9200 --ca /pfad/root-ca.pem --user admin
```

Alternativ mit Clientzertifikat: `--cert /pfad/admin.pem --key /pfad/admin-key.pem`.
Keine Zugangsdaten in Quelltext, Shell-Historie oder Git ablegen.

## Neue Metrik ergaenzen

1. Stats-Auswahl und `MetricDocuments` erweitern; Einheiten festlegen.
2. Das explizite Mapping und die TypeScript-Typen anpassen.
3. API-Abfrage und Diagramm oder Tabelle erweitern.
4. Zaehler-Reset und fehlende Werte testen, dann einen echten Cluster pruefen.

Additive Schemaaenderungen werden beim Vorbereiten des Tagesindex mit Put-Mapping
ergaenzt. Inkompatible Feldtypen benoetigen weiterhin eine Migration oder einen
neuen Indexpraefix. Alte Dokumente enthalten neue Felder nicht; die UI muss fehlende Werte behandeln.
Bei einem Versionswechsel beide ZIPs neu bauen und gegen exakt diese
OpenSearch-/Dashboards-Version testen.
