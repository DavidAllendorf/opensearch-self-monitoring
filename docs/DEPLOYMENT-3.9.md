# Produktiver Rollout 0.1.0

Am 11.11.2026 auf `192.168.178.40` nativ installiert.

- OpenSearch 3.9.0: `stack-monitoring` 0.1.0.
- OpenSearch Dashboards 3.9.0: `stackMonitoring` 0.1.0.
- Unveraenderte, zuvor gepruefte ZIP-Pakete; SHA-256 vor Installation kontrolliert.
- Erfassung ohne zusaetzliche Konfiguration alle 10 Sekunden; sieben UTC-Tagesindizes.
- Die vorhandene native Anmeldung als `admin` und TLS bleiben aktiv.
- Pakete und Installationsskript: `/opt/opensearch-self-monitoring/releases/0.1.0/`.

## Zugriff

<https://opensearch.home-da.de/app/stackMonitoring>

Mit dem bestehenden Benutzer anmelden. Bei einem noch geoeffneten Browser-Tab
nach dem Plugin-Rollout die Seite neu laden.

## Abnahme

- Zwei aufeinanderfolgende Live-Samples einschliesslich berechneter Raten.
- Dashboards-API liefert Cluster, Knoten, Indizes und Verlauf des Clusters `logging`.
- Anmeldung und grafische Live-Ansicht ueber Pangolin im integrierten Browser geprueft.
- Neues Logereignis ueber Filebeat und Logstash erfolgreich in OpenSearch angekommen.
- Clusterstatus gruen; OpenSearch, Dashboards, Logstash und Filebeat aktiv.
- Die fuer die Pruefung erzeugte Logdatei wurde entfernt.

Die Plugin-Installation wurde einmalig per SSH vorgenommen. Das bestehende
Ansible bleibt auf das Verteilen normaler Konfigurationen beschraenkt.

