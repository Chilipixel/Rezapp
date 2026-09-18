# Rezapp

Eine installierbare, vollständig clientseitige PWA für eine private Rezeptbibliothek. Rezepte, Bilder, Einstellungen und Einkaufsdaten werden ausschließlich im Browser in IndexedDB gespeichert.

Die App ist unter der MIT-Lizenz frei nutzbar und verteilbar.

Beim Rezeptimport wird eine Seite zuerst direkt im Browser gelesen. Verhindert die Quellseite dies per CORS, sendet die App ausschließlich den öffentlichen Rezeptlink an den [Jina Reader](https://jina.ai/reader/) und wertet dessen HTML-Antwort lokal aus. Persönliche App-Daten werden dabei nicht übertragen.

## Lokal starten

Da ES-Module und Service Worker einen HTTP-Ursprung benötigen, den Ordner `dist` mit einem beliebigen statischen Webserver ausliefern, zum Beispiel:

```sh
python3 -m http.server 4173 --directory dist
```

Danach `http://localhost:4173` öffnen.

## GitHub Pages

Der Workflow `.github/workflows/deploy-pages.yml` veröffentlicht den Inhalt von `dist` bei jedem Push auf `main`. In den Repository-Einstellungen unter **Pages → Build and deployment** als Quelle **GitHub Actions** auswählen.

## Datenschutz und Bring!

Es gibt keinen Backend-Server und keine Zugangsdaten im Repository. Bring! stellt keine offizielle öffentliche Browser-API bereit. Deshalb ist die Integration in `dist/src/services/bringService.js` gekapselt und nutzt derzeit das native Teilen-Menü beziehungsweise die Zwischenablage; ein direkter Login-Test erklärt die Browser-/CORS-Einschränkung. Lokal eingegebene Bring!-Daten werden wie gewünscht nur in IndexedDB gespeichert und sind im JSON-Backup enthalten.
