# Auslieferung und Betrieb

## Release

Ein Release besteht aus zwei ZIPs und SHA-256-Pruefsummen. Eine sinnvolle Pipeline
fuehrt Quelltests aus, baut beide Plugins und prueft sie auf einem separaten
nativen OpenSearch-/Dashboards-Paar. Danach ein Git-Tag setzen und dieselben
geprueften ZIPs ausliefern. Die mitgelieferte GitHub-Actions-Datei baut beide
Artefakte; ein automatisches Deployment auf Benutzer-Server findet nicht statt.

Beide Plugins stehen auf 0.8.0, die Plattform-Kompatibilitaet ist exakt 3.6.0.
Die neue Primary-Regel erfordert die Index-Zaehler des Collectors 0.8.0; fuer
dieses Update beide ZIPs ersetzen und Collector sowie Dashboards neu starten.
Spaetere reine Schwellen-Aenderungen in opensearch_dashboards.yml erfordern nur
Dashboards-Neustarts. Dieselbe Konfiguration auf allen Dashboards-Instanzen ausrollen.
Der Installer meldet eine ausgehende Socket-Berechtigung fuer frei konfigurierbare
Logstash-Hosts und -Ports. Der Code fragt nur die administrativ konfigurierten
HTTP(S)-Basis-URLs ab. Dies oeffnet keinen eingehenden Port und aendert keine Firewall.
Das ZIP nicht fuer andere Plattformversionen umbenennen oder dessen Manifest
manuell passend machen.

## Native Installation

Das Java-Plugin **genau einmal** auf dem vorgesehenen Collector-Node installieren.
Er ist ein normaler OpenSearch-Node im bestehenden Cluster, empfohlen
`node.roles: []` (coordinating-only). Die Erfassung funktioniert auch mit anderen
Rollen; eine Cluster-Manager-Rolle ist nicht erforderlich. Clustername, Discovery
und Transport-TLS muessen zum bestehenden Cluster passen. Auf dem neuen Collector
keinen separaten Single-Node-Cluster initialisieren und keine erneute
`cluster.initial_cluster_manager_nodes`-Bootstrap-Konfiguration setzen.

Das Dashboard-Plugin auf **allen OpenSearch-Dashboards-Instanzen** des Clusters
installieren. Nur der Collector und die Dashboards-Instanzen muessen fuer die
Plugin-Installation neu gestartet werden; die uebrigen OpenSearch-Nodes nicht.

```sh
systemctl stop opensearch
/usr/share/opensearch/bin/opensearch-plugin install --batch file:///pfad/stack-monitoring-0.8.0.zip
systemctl start opensearch

systemctl stop opensearch-dashboards
/usr/share/opensearch-dashboards/bin/opensearch-dashboards-plugin install file:///pfad/stackMonitoring-3.6.0.zip --allow-root
systemctl start opensearch-dashboards
```

Ein dedizierter Collector traegt keine Datenshards und nimmt nicht an Manager-Wahlen
teil. Sein Neustart unterbricht die Erfassung, nicht den Betrieb der anderen Nodes.
Bei einer kombinierten Einzelknoteninstallation startet dagegen weiterhin der
einzige OpenSearch-Prozess neu. Dashboards-Updates nacheinander ausrollen.
Nach einem Plugin-Update den Browser vollstaendig neu laden (Strg+F5), weil
Dashboards-Bundlepfade zwischen Pluginversionen gleich bleiben koennen.
Erfassung startet automatisch. Datenquelle und Indexmuster muessen nicht
manuell angelegt werden. Danach `/app/stackMonitoring` oeffnen.

Die Installation ist ein einmaliger Paket-/Plugin-Schritt; sie gehoert nicht
in das bestehende reine Konfigurations-Ansible. Optionale Einstellungen koennen
spaeter ueber dessen `opensearch.yml` verteilt werden.

## Security

Die Erfassung arbeitet als interner NodeClient auf dem Collector-Node, ohne
Benutzer-Impersonation und ohne gespeichertes Admin-Passwort. Das benoetigt
Vertrauen in den installierten Java-Code wie bei anderen Server-Plugins.

Die Dashboards-API verwendet ausschliesslich `asCurrentUser`. Sie bietet keinen
privilegierten Leseproxy. `admin` darf standardmaessig lesen. Fuer andere Nutzer
eine Rolle mit `read` auf `.stack-monitoring-*` vergeben, zum Beispiel ueber
die Security REST API:

```json
{
  "cluster_permissions": [],
  "index_permissions": [{
    "index_patterns": [".stack-monitoring-*"],
    "allowed_actions": ["read"]
  }],
  "tenant_permissions": []
}
```

Diese Rolle heisst zum Beispiel `self_monitoring_reader`; sie wird vom
Administrator normalen Dashboards-Nutzern zusaetzlich zu deren Login-Rechten
zugewiesen. Metriken enthalten Cluster-, Knoten- und Indexnamen und koennen
infrastrukturelle Informationen offenlegen. Keine anonymen Leserechte vergeben.

## Update und Rueckbau

Genau einen aktiven Collector betreiben. Es gibt keine automatische Wahl,
Leader-Sperre oder Ausfalluebernahme. Bei einem Collector-Ausfall fehlen neue
Samples bis zu dessen Rueckkehr; die vorhandenen Metriken bleiben gespeichert.

Migration von 0.4.0 oder aelter: den bisherigen Collector vor Aktivierung des
neuen beenden/deaktivieren. Diese alten Versionen haben nur eine statische
`stack_monitoring.enabled`-Einstellung und koennen nicht im laufenden Prozess
entladen werden. Liegt die alte Installation auf einem Manager, erfordert ihr
Rueckbau daher gegebenenfalls einmalig dessen kontrollierten Neustart. Ein neuer
Arbeitscluster ohne alte Installation braucht ausschliesslich den neuen Collector.
Danach betreffen Plugin-Updates nur diesen Collector und die Dashboards-Instanzen.

Bei einem Update zuerst Kompatibilitaet und Archiv-Pruefsummen pruefen,
Plugin bei gestopptem Dienst entfernen und das neue ZIP installieren. Die
Installer unterstuetzen keinen beliebigen Austausch laufender Java-Klassen.
Vorheriges ZIP fuer einen Rollback behalten.

```sh
systemctl stop opensearch
/usr/share/opensearch/bin/opensearch-plugin remove stack-monitoring
# optional neues ZIP installieren
systemctl start opensearch

systemctl stop opensearch-dashboards
/usr/share/opensearch-dashboards/bin/opensearch-dashboards-plugin remove stackMonitoring --allow-root
systemctl start opensearch-dashboards
```

Vor Entfernung des Java-Plugins alle `stack_monitoring.*`-Einstellungen entfernen,
sonst kann OpenSearch wegen unbekannter Einstellungen nicht starten.
Eine Deinstallation loescht keine Metrikindizes. Aufbewahrung wird nur bei aktiver
Erfassung durchgesetzt; nach Entfernung verbleibende Indizes bewusst verwalten.

## Diagnose

```sh
journalctl -u opensearch -n 100 --no-pager
journalctl -u opensearch-dashboards -n 100 --no-pager
curl --cacert /etc/opensearch/certs/root-ca.pem -u admin \
  'https://localhost:9200/.stack-monitoring-*/_count?expand_wildcards=open,hidden'
```

- Keine Daten: Ist genau ein Collector installiert, aktiviert und Mitglied des Clusters?
- HTTP 403: Leserechte des angemeldeten Nutzers auf die versteckten Indizes pruefen.
- Alte Daten: Collector, Cluster-Verbindung, Logs, Schreibblockaden und freien Speicher pruefen.
- Ein Index fehlt: Erfassungsgrenze beachten; eigene Monitoring-Indizes sind ausgeschlossen.
- Grosse Cluster: Intervall erhoehen und Last messen. Jeder Poll fragt Cluster-Stats
  ab und schreibt etwa `1 + Knoten + min(Indizes, Limit)` Dokumente.

Die Aufbewahrung erfolgt einmal pro UTC-Tag nach einem erfolgreichen Sample.
Bei sieben Tagen bleiben heute und sechs vorherige Tagesindizes. Nur exakt
benannte `.stack-monitoring-YYYY-MM-DD`-Indizes vor der Grenze werden geloescht.
