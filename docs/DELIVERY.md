# Auslieferung und Betrieb

## Release

Ein Release besteht aus zwei ZIPs und SHA-256-Pruefsummen. Eine sinnvolle Pipeline
fuehrt Quelltests aus, baut beide Plugins und prueft sie auf einem separaten
nativen OpenSearch-/Dashboards-Paar. Danach ein Git-Tag setzen und dieselben
geprueften ZIPs ausliefern. Die mitgelieferte GitHub-Actions-Datei baut beide
Artefakte; ein automatisches Deployment auf Benutzer-Server findet nicht statt.

Der Pluginstand ist 0.4.0, die Plattform-Kompatibilitaet exakt 3.6.0.
Der Installer meldet die neue Socket-Berechtigung fuer 127.0.0.1:9600.
Sie gehoert zur optionalen lokalen Logstash-Erfassung, nicht zu einer Freigabe
des Logstash-Ports ins Netzwerk. Auf dem Ziel muss dessen lokale Monitoring-API
erreichbar sein; anderenfalls bleibt die Logstash-Ansicht ohne aktuelle Daten.
Das ZIP nicht fuer andere Plattformversionen umbenennen oder dessen Manifest
manuell passend machen.

## Native Installation

ZIPs auf den Zielserver kopieren. Mit administrativen Rechten, auf jedem
OpenSearch-Knoten beziehungsweise jeder Dashboards-Instanz:

```sh
systemctl stop opensearch
/usr/share/opensearch/bin/opensearch-plugin install --batch file:///pfad/stack-monitoring-0.4.0.zip
systemctl start opensearch

systemctl stop opensearch-dashboards
/usr/share/opensearch-dashboards/bin/opensearch-dashboards-plugin install file:///pfad/stackMonitoring-3.6.0.zip --allow-root
systemctl start opensearch-dashboards
```

Eine Einzelknoteninstallation hat waehrend des OpenSearch-Neustarts eine
Unterbrechung. In einem groesseren Cluster kontrolliert nacheinander ausrollen.
Nach einem Plugin-Update den Browser vollstaendig neu laden (Strg+F5), weil
Dashboards-Bundlepfade zwischen Pluginversionen gleich bleiben koennen.
Erfassung startet automatisch. Datenquelle und Indexmuster muessen nicht
manuell angelegt werden. Danach `/app/stackMonitoring` oeffnen.

Die Installation ist ein einmaliger Paket-/Plugin-Schritt; sie gehoert nicht
in das bestehende reine Konfigurations-Ansible. Optionale Einstellungen koennen
spaeter ueber dessen `opensearch.yml` verteilt werden.

## Security

Die Erfassung arbeitet als interner NodeClient auf dem Cluster-Manager, ohne
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

- Keine Daten: Plugin auf dem gewaehlten Cluster-Manager installiert/aktiviert?
- HTTP 403: Leserechte des angemeldeten Nutzers auf die versteckten Indizes pruefen.
- Alte Daten: Cluster-Manager, Logs, Schreibblockaden und freien Speicher pruefen.
- Ein Index fehlt: Erfassungsgrenze beachten; eigene Monitoring-Indizes sind ausgeschlossen.
- Grosse Cluster: Intervall erhoehen und Last messen. Jeder Poll fragt Cluster-Stats
  ab und schreibt etwa `1 + Knoten + min(Indizes, Limit)` Dokumente.

Die Aufbewahrung erfolgt einmal pro UTC-Tag nach einem erfolgreichen Sample.
Bei sieben Tagen bleiben heute und sechs vorherige Tagesindizes. Nur exakt
benannte `.stack-monitoring-YYYY-MM-DD`-Indizes vor der Grenze werden geloescht.
