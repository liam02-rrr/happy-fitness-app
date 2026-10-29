# CLAUDE.md – Projektregeln Gym-App

Diese Datei liest du (Claude Code) zu Beginn jeder Sitzung. Die vollständige Spezifikation steht in `SPEC.md`.

## Über den Nutzer
- Liam ist der einzige Nutzer der App. Er programmiert zum ersten Mal mit Claude Code.
- Erkläre Schritte in einfachem Deutsch, ohne Fachjargon. Wenn Liam etwas selbst tun muss (GitHub, Cloudflare, iPhone), gib nummerierte Klick-Anleitungen.
- Frage nach, wenn eine Anforderung unklar ist. Immer nur eine Frage auf einmal.

## Arbeitsweise
1. **Phase für Phase.** Baue nur die Phase, die Liam freigegeben hat (siehe `SPEC.md`, Abschnitt 11). Fang nie mit der nächsten Phase an, bevor die aktuelle auf dem iPhone getestet ist.
2. **Erst planen, dann bauen.** Stelle vor jeder Phase kurz deinen Plan vor und warte auf Freigabe.
3. **Am Ende jeder Phase:** Liste die Akzeptanzkriterien auf, hake ab, was erfüllt ist, und gib Liam eine kurze Testanleitung für das iPhone.
4. **Kleine, nachvollziehbare Commits** mit deutscher Beschreibung.
5. Weiche nicht von `SPEC.md` ab, ohne zu fragen. Wenn du eine Verbesserung siehst, schlage sie vor.

## Technik (verbindlich)
- Reines HTML, CSS und JavaScript (ES-Module). **Kein Framework, kein Build-Schritt, kein npm-Zwang.** Die App muss als statische Dateien auf Cloudflare Pages laufen.
- Externe Bibliotheken nur, wenn wirklich nötig, und dann **lokal im Repository** ablegen (Ordner `vendor/`), nicht von einem CDN laden, damit die App offline funktioniert.
- Daten ausschließlich lokal im Gerät (IndexedDB). **Niemals Trainingsdaten an einen Server senden.** Keine Analyse-Tools, keine Tracker.
- Progressive Web App: `manifest.webmanifest` + Service Worker, offline nutzbar, auf dem iPhone-Homescreen installierbar.
- Zielgerät: iPhone, Safari, Hochformat, Breite 375–430 px. Mobile first.

## Code-Regeln
- Benutzeroberfläche komplett auf Deutsch. Code (Variablen, Funktionen) auf Englisch.
- Der Algorithmus liegt als **reine Funktionen** in `js/algorithm/` (keine DOM-Zugriffe, kein Datenbankzugriff). Dazu gibt es Tests in `tests/` (eine `tests.html`, die im Browser läuft und Ergebnisse anzeigt).
- **Alle Schwellenwerte und Zahlen des Algorithmus** kommen aus den Einstellungen (`SPEC.md`, Abschnitt 8), nie fest im Code.
- **Farben, Abstände, Radien nur über CSS-Variablen** in `css/tokens.css`.
- Berechnete Werte (1RM, Volumen, Plateau, Tage seit …) werden nie gespeichert, sondern immer aus den Rohdaten berechnet.
- Datenbank-Schema mit Versionsnummer. Jede Schema-Änderung braucht eine Migration, die bestehende Daten erhält.
- Vor jeder riskanten Datenänderung (Import, Migration) automatisch ein Backup im Gerät anlegen.

## Design
- Dunkles Design, Akzentfarbe Dunkelblau (Tokens in `SPEC.md`, Abschnitt 3).
- Design-Referenz: `design/referenz.png`. Übernimm Kartenstil, runde Ecken, Diagrammstil, Pillen-Filter und die schwebende Tab-Leiste. **Ersetze das Lime-Grün der Referenz durch die blaue Akzentfarbe.**
- Grafiken und Optik sind Liam sehr wichtig. Lieber eine Funktion weniger als eine unschöne.
