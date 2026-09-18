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

## Bring!-Übergabe

Es gibt keinen Backend-Server und keine Zugangsdaten im Repository. Ausgewählte Zutaten werden über das native Teilen-Menü an die Bring!-App übergeben; falls das Gerät dies nicht unterstützt, kopiert Rezapp die formatierte Einkaufsliste. Für importierte Rezepte mit öffentlicher Quell-URL verwendet die App zusätzlich den offiziellen Bring!-Rezept-Deep-Link mit der ausgewählten Portionszahl.

Eine direkte Anmeldung und Veränderung einer persönlichen Bring!-Liste ist aus einer reinen GitHub-Pages-App nicht möglich: Bring! bietet dafür keine öffentliche Shopping-List-API und blockiert Aufrufe der inoffiziellen Konto-API per CORS. Rezapp fordert deshalb keine Bring!-Zugangsdaten mehr an.
