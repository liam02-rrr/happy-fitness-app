# SPEC.md – Persönliche Gym-App „Overload“

Version 1.0 · Stand 29.10.2026 · Arbeitstitel „Overload“ (änderbar)

---

## 0. Zweck

Eine persönliche iPhone-App (Web-App) für genau einen Nutzer (Liam). Sie löst zwei Probleme:
1. **Dokumentation:** Jedes Training schnell und vollständig erfassen, inklusive Drop Sets, Supersets und Komplexen.
2. **Progressive Overload:** Für jede Übung vorschlagen, mit welchem Gewicht und wie vielen Wiederholungen trainiert werden soll, basierend auf der Historie.

Ziel des Nutzers: Hypertrophie, langfristig auch Kraft. Training 3–4× pro Woche, Split ändert sich nach Muskelkater und ist **nicht** Teil der Logik.

---

## 1. Grundsätze

- **Daten bleiben auf dem Gerät.** Keine Cloud, kein Login. Backup nur durch manuellen Export als Datei.
- **Offline-fähig.** Im Gym gibt es oft kein Netz.
- **Wenig tippen.** Werte sind vorausgefüllt, der Nutzer bestätigt oder korrigiert mit −/+. Ein Satz soll mit **3–4 Taps** geloggt sein.
- **Alle Übungen sind gleichberechtigt.** Keine Bewegungsmuster-Hierarchie. Jede Übung (inkl. Gerät/Hersteller) hat ihre eigene Historie. Übergreifende Auswertungen laufen über Muskeln.
- **Gewichte werden nie zwischen Übungen übertragen.** 60 kg an Brustpresse A haben nichts mit Brustpresse B zu tun.
- **Algorithmus rechnet nur bei Bedarf**, nämlich beim Planen eines Trainings.
- **Alle Zahlen des Algorithmus sind einstellbar.**

---

## 2. Technik

| Thema | Entscheidung |
|---|---|
| Sprachen | HTML, CSS, JavaScript (ES-Module), kein Framework, kein Build |
| Speicherung | IndexedDB (eigener kleiner Wrapper in `js/db.js`), Schema mit Versionsnummer |
| Persistenz | Beim Start `navigator.storage.persist()` anfragen |
| Offline | Service Worker cacht alle App-Dateien (Cache-Version bei jedem Release erhöhen) |
| Installation | `manifest.webmanifest`, Icons, `apple-mobile-web-app-capable`, Statusleiste dunkel |
| Diagramme | Eigene SVG-Komponenten (bevorzugt, volle Kontrolle über Optik) oder eine kleine Bibliothek lokal in `vendor/` |
| Körperkarte | Eigene vereinfachte SVG-Grafik (Vorder- und Rückansicht), jeder Muskel als eigener Pfad mit `id` = Muskel-ID aus Abschnitt 5 |
| Fotos | Beim Speichern auf max. 1024 px Kantenlänge verkleinern, JPEG-Qualität 0,7, als Blob in IndexedDB |
| Hosting | GitHub-Repository → Cloudflare Pages (statisch) |

**Empfohlene Ordnerstruktur**
```
index.html
manifest.webmanifest
sw.js
css/tokens.css, css/base.css, css/components.css
js/app.js            (Start, Routing zwischen Tabs)
js/db.js             (IndexedDB, Migrationen, Backup)
js/models/           (Datenzugriff je Tabelle)
js/algorithm/        (reine Funktionen: progression.js, jumps.js, plateau.js, volume.js, time.js, readiness.js)
js/import/           (Parser für Notizen-Format)
js/ui/               (Screens und Komponenten)
js/charts/           (SVG-Diagramme, Körperkarte)
assets/icons/, assets/bodymap/
tests/tests.html, tests/*.test.js
import/notizen.txt   (Startdaten)
design/referenz.png  (Design-Referenz)
```

---

## 3. Design-System

Referenz: `design/referenz.png`. Übernehmen: fast schwarzer Hintergrund, Karten mit großen Radien und feinem Rand, Balkendiagramm mit hervorgehobenem aktuellem Balken und Wert-Bubble, Liniendiagramm, Pillen-Filter, Foto-Karten, schwebende Tab-Leiste mit aktivem Tab als Pille. **Statt Lime-Grün: Blau.**

**Tokens (`css/tokens.css`)**
| Token | Wert | Verwendung |
|---|---|---|
| `--bg` | `#0A0F1C` | Hintergrund |
| `--surface` | `#121A2B` | Karten |
| `--surface-2` | `#1A2438` | Karten innen, Eingabefelder |
| `--border` | `#24304A` | feine Ränder |
| `--accent` | `#3D7BFF` | Akzent, aktive Elemente |
| `--accent-soft` | `#7FA8FF` | Hervorhebungen, aktiver Balken |
| `--accent-dim` | `#1D3466` | inaktive Balken, Flächen |
| `--text` | `#E8ECF5` | Text |
| `--text-muted` | `#7C8699` | Nebentext |
| `--set-warmup` | `#5B6478` | Aufwärmsatz |
| `--set-volume` | `#3D7BFF` | Volumensatz |
| `--set-intense` | `#FF8A3D` | Intensivsatz |
| `--success` / `--warning` / `--danger` | `#3DDC97` / `#FFC24D` / `#FF5C6C` | Status |
| `--radius-card` | `20px` | |
| `--radius-pill` | `999px` | |
| Schrift | System-Schrift (`-apple-system`), Zahlen mit `font-variant-numeric: tabular-nums` | |

Regeln: Mindest-Tippfläche 44×44 px. Wichtige Aktionen im unteren Bildschirmdrittel (Daumenbereich). Dezente Übergänge (150–250 ms).

---

## 4. Datenmodell

Alle IDs sind UUIDs. Zeitangaben als ISO-Datum. Felder mit `?` sind optional.

### 4.1 `exercises` – Übungen
| Feld | Typ | Beschreibung |
|---|---|---|
| id | string | |
| name | string | z. B. „Latziehen“ |
| location? | string | Hersteller oder Ort, z. B. „Phoenix“, „oben“. Anzeige: „Latziehen · Phoenix“ |
| photo? | Blob | |
| category | `strength` \| `mobility` | |
| muscleGroup | Gruppen-ID | Hauptgruppe für die Auswahl (Abschnitt 5) |
| feel | Array `{muscleId, rating 1–5}` | „Wo spüre ich es?“ |
| type | `weight` \| `bodyweight` \| `assisted` \| `band` \| `level` \| `time` | siehe 4.7 |
| unilateral | boolean | Wdh. pro Seite |
| steps | Objekt | `weight`/`bodyweight`/`assisted` in kg: `{min, max, step}`; `assisted`/`band`/`level` mit Stufen: `{levels: [..], harderDirection: "up"\|"down"}` |
| setupTime | `short` \| `medium` \| `long` | Aufbauzeit |
| setupNotes? | string | z. B. „Sitz 4, Griff weit“ |
| backPlus | boolean | Rücken-Plus-Übung |
| tags? | string[] | Nice to have: Übungsfamilie, z. B. „Klimmzug“ |
| repRanges? | Objekt | Überschreibt Standard-Wiederholungsbereiche nur für diese Übung |
| archived | boolean | aus Auswahl ausgeblendet, Historie bleibt |
| createdAt | Datum | |

### 4.2 `sessions` – Trainings
| Feld | Typ | Beschreibung |
|---|---|---|
| id, date | | |
| muscleGroups | Gruppen-ID[] | Auswahl beim Start |
| timeMode | `short` \| `normal` \| `long` | |
| feeling | `strong` \| `normal` \| `tired` \| `weak` | |
| illness | `none` \| `recent` \| `current` | `recent` = in den letzten 10 Tagen angeschlagen |
| note? | string | |
| status | `planned` \| `active` \| `done` | |
| source | `app` \| `import` | |

### 4.3 `entries` – Übung innerhalb eines Trainings
| Feld | Typ | Beschreibung |
|---|---|---|
| id, sessionId, exerciseId, order | | |
| groupId? | string | gleiche ID = gleiche Gruppe |
| groupType? | `superset` \| `complex` | Komplex = mehrere Bewegungen, gleiches Gewicht, ohne Pause |
| groupPosition | number | 1 = allein oder erste Übung der Gruppe; ≥2 = vorermüdet |
| note? | string | Notiz pro Übung |
| suggestion? | Objekt | Was der Algorithmus vorgeschlagen hatte (Sätze, Begründung). Zur späteren Auswertung |

### 4.4 `sets` – Sätze
| Feld | Typ | Beschreibung |
|---|---|---|
| id, entryId, index | | Bei Supersets: index = Runde |
| setType | `warmup` \| `volume` \| `intense` \| `drop` | |
| dropFrom? | Satz-ID | Bei Drop: Vorgängersatz in der Kette |
| weight? | number | kg (bei `assisted` in kg: Assistenz; bei `bodyweight`: Zusatz) |
| level? | string/number | Stufe, Band, Variante |
| reps? | number | |
| seconds? | number | bei `time` |
| rir? | 0–5 | leer erlaubt |
| note? | string | z. B. „langsam“ |
| done | boolean | |

### 4.5 `bodyweight`
`{id, date, kg}` – unregelmäßige Einträge. Für Berechnungen gilt der letzte Wert vor dem Trainingsdatum.

### 4.6 `settings`
Ein Objekt mit allen Werten aus Abschnitt 8, plus `theme` und `lastBackupAt`.

### 4.7 Übungstypen
| Typ | Erfasst | Fortschritt | Effektive Last für 1RM |
|---|---|---|---|
| `weight` | kg × Wdh. | mehr kg / mehr Wdh. | kg |
| `bodyweight` | Zusatz-kg × Wdh. | mehr Zusatz / mehr Wdh. | Körpergewicht + Zusatz |
| `assisted` (kg) | Assistenz-kg × Wdh. | **weniger** Assistenz | Körpergewicht − Assistenz |
| `assisted` (Stufen) | Stufe × Wdh. | Stufe in Richtung „schwerer“ | keine (ordinal) |
| `band` | Band × Wdh. | schwächeres Band | keine (ordinal) |
| `level` | Stufe × Wdh. | schwerere Stufe | keine (ordinal) |
| `time` | Sekunden | länger | keine |

### 4.8 Nicht gespeichert, immer berechnet
Geschätztes 1RM, Leistungsindex, Volumen pro Muskel, Tage seit letztem Training, Plateau-Status, geschätzte Dauer, Effizienzwert.

---

## 5. Muskeln

### 5.1 Gruppen (Auswahl beim Start, Feld `muscleGroup`)
`chest` Brust · `shoulders` Schultern · `arms` Arme · `back` Rücken · `legs` Beine · `hips` Hüfte · `calves` Waden · `core` Core

### 5.2 Feinmuskeln (Spürgefühl, Körperkarte)
| Gruppe | Muskel-IDs |
|---|---|
| chest | `chest_upper` obere Brust, `chest_mid` mittlere Brust, `chest_lower` untere Brust |
| shoulders | `delt_front` vordere, `delt_side` seitliche, `delt_rear` hintere Schulter |
| back | `lats` Lat, `upper_back` oberer Rücken/Rhomboiden, `traps` oberer Trapez, `lower_back` unterer Rücken |
| arms | `biceps`, `triceps`, `forearms` Unterarm |
| legs | `quads` Quadrizeps, `hamstrings` Beinbeuger |
| hips | `glutes` Gesäß, `glute_med` Gesäß seitlich, `hip_flexors` Hüftbeuger, `adductors` Adduktoren |
| calves | `calves` Waden |
| core | `abs` gerade Bauchmuskeln, `obliques` schräge Bauchmuskeln, `deep_core` tiefe Rumpfmuskulatur |

---

## 6. Funktionen und Bildschirme

### 6.1 Tab-Leiste (schwebend, unten)
1. **Training** · 2. **Verlauf** · 3. **Übungen** · 4. **Statistik** · 5. **Einstellungen**

### 6.2 Tab „Training“

**Startbildschirm**
- Körperkarte „Erholung“: Muskeln eingefärbt nach Tagen seit letztem Training (frisch trainiert = gedimmt, lange her = hell). Reine Anzeige.
- Liste „Tage seit“ je Muskelgruppe.
- Button „Training starten“. Ist ein Training aktiv: „Training fortsetzen“.

**Ablauf „Training starten“**
1. **Muskelgruppen** wählen (Mehrfachauswahl, Pillen).
2. **Zeit** wählen: kurz / normal / lang.
3. **Tagesform**: Gefühl (stark / normal / müde / schwach), Krankheit (keine / letzte 10 Tage angeschlagen / aktuell leicht krank).
4. **Übungsauswahl**: alle nicht archivierten Übungen der gewählten Gruppen als Foto-Karten. Sortierung (Abschnitt 7.9). Darüber Vorschläge: 1× Rücken-Plus, Mobility je nach Zeitmodus. Antippen = auswählen.
5. **Planung**: Reihenfolge per Ziehen ändern. Übungen per Geste/Button zu **Superset** oder **Komplex** verbinden. Anzeige: geschätzte Dauer vs. gewählter Zeitmodus. Erst jetzt rechnet der Algorithmus die Vorschläge.
6. **Aktives Training** (siehe unten).
7. **Abschluss**: Notiz zum Training, Zusammenfassung (Übungen, Sätze, Fortschritte ▲●▼), Speichern.

**Aktives Training – Übungskarte**
- Foto, Name · Ort, Einstellungen (Sitzhöhe etc.), Notiz vom letzten Mal.
- Zeile „Letztes Mal“ (gleicher Kontext).
- Vorgeschlagene Sätze, farbig nach Satztyp, mit Begründung in einem Satz (z. B. „15 Wdh. erreicht → +5 kg“).
- Pro Satz: Gewicht/Stufe und Wdh. vorausgefüllt (−/+), RIR-Auswahl 0–5, Haken. Ziel: 3–4 Taps.
- Satz hinzufügen, Drop anhängen (eingerückte, absteigende Treppe), Satz löschen.
- Notiz pro Übung.
- **Superset**: farbige Klammer links über die Karten, Rundenanzeige „Runde 2/3“, nach jedem Satz springt der Fokus zur nächsten Übung der Gruppe.
- **Komplex**: eine Karte mit mehreren Bewegungen, ein gemeinsames Gewicht, Wdh. je Bewegung.
- **Pausentimer**: startet automatisch nach Haken, Standarddauer je Satztyp (Einstellungen), +15 s / −15 s / überspringen, deutliche visuelle Anzeige und Ton am Ende.
- Training jederzeit unterbrechbar, wird automatisch gespeichert.

### 6.3 Tab „Verlauf“
- Trainings chronologisch als Karten (Datum, Muskelgruppen, Dauer-Schätzung, Tagesform-Symbol, Anzahl Sätze).
- Detailansicht: alle Übungen mit Sätzen, Drops, Gruppen, Notizen. Nachträglich bearbeitbar.
- Möglichkeit, ein Training nachträglich anzulegen (für vergessene Einträge).

### 6.4 Tab „Übungen“
- Unterteilung oben: **Kraft** | **Mobility**. Darunter Pillen-Filter nach Muskelgruppe, Suchfeld.
- Foto-Karten mit Name · Ort, „zuletzt vor X Tagen“, kleinem Trendpfeil.
- **Übung anlegen** (in ca. 30 Sekunden): Foto, Name, Ort, Kategorie, Muskelgruppe, Typ, Gewichtsstufen bzw. Stufenliste, Aufbauzeit, Einstellungen, Rücken-Plus, „Wo spüre ich es?“ (Körperkarte antippen + Bewertung 1–5).
- **Detailansicht Übung**: Körperkarte mit hervorgehobenen Muskeln (aus Spürgefühl), Liniendiagramm geschätztes 1RM (bzw. Wdh./Stufe bei ordinalen Typen), Balkendiagramm Leistungsindex pro Einheit (aktuelle Einheit hervorgehoben mit Wert-Bubble), Historie aller Sätze, Plateau-Status.
- Archivieren statt löschen (Löschen nur mit Bestätigung, wenn keine Historie existiert).

### 6.5 Tab „Statistik“
- **Körperkarte Heatmap**: fraktionale Sätze je Feinmuskel im 10-Tage-Fenster.
- Balken je Muskelgruppe: Volumen 10 Tage vs. Zielbereich (Einstellungen).
- Plateau-Liste: Übungen mit Status „Plateau“ und vorgeschlagener Maßnahme.
- Körpergewicht-Verlauf (Liniendiagramm) + Button „Gewicht eintragen“.
- Trainingsfrequenz (Balken je 10-Tage-Fenster).

### 6.6 Tab „Einstellungen“
- Alle Schwellenwerte aus Abschnitt 8, gruppiert, mit „Auf Standard zurücksetzen“.
- Körpergewicht eintragen.
- **Backup exportieren** (JSON inkl. Fotos als Base64, Dateiname `overload-backup-JJJJ-MM-TT.json`, über das iOS-Teilen-Menü speicherbar).
- **Backup importieren** (vorher automatisches Sicherungs-Backup; Auswahl: ersetzen oder zusammenführen).
- **Notizen importieren** (Format Abschnitt 9) mit Vorschau und Fehlerliste vor dem Speichern.
- CSV-Export (Phase 4).
- Backup-Erinnerung: Hinweis auf dem Startbildschirm, wenn das letzte Backup älter als X Tage ist.

---

## 7. Algorithmus

Alle Funktionen sind rein und testbar. Alle Zahlen kommen aus den Einstellungen (Abschnitt 8, Standardwerte in Klammern).

### 7.1 Kontext
Vergleiche immer mit der letzten Ausführung derselben Übung **im gleichen Kontext**: `groupPosition = 1` (allein/erste) oder `≥ 2` (vorermüdet). Gibt es im gleichen Kontext keine Historie, nimm den anderen Kontext und markiere den Vorschlag als „unsicher“.

### 7.2 Satzschema (Standard)
- 1 Aufwärmsatz: ca. `warmupPct` (55 %) des Intensivgewichts, auf Gewichtsstufe gerundet. Nur bei der ersten Übung je Muskelgruppe Pflicht, sonst optional.
- 1 Volumensatz: `volumeRange` (12–15) Wdh. bei `volumeRIR` (2).
- `intenseSets` (2–3, Standard 3) Intensivsätze: `intenseRange` (6–8) Wdh. bei `intenseRIR` (1).
- Fehlt ein RIR-Wert, gilt `defaultRIR` (2).

### 7.3 Geschätztes 1RM und Leistungsindex
- Epley: `e1RM = Last × (1 + Wdh./30)`, nur für Sätze mit Wdh. ≤ `e1rmMaxReps` (12), nur Intensivsätze (bei Altdaten: die schwersten Sätze).
- Last = effektive Last laut Tabelle 4.7 (Körpergewicht = letzter Eintrag vor dem Training; fehlt er, keine 1RM-Berechnung für diese Typen).
- Bestwert pro Einheit = höchstes e1RM der Einheit.
- Leistungsindex = Bestwert / erster Bestwert dieser Übung × 100.
- Ordinale Typen (Stufen, Band, Variante, Zeit): Score = (Stufen-Rang × 100) + beste Wdh. bzw. Sekunden. Nur für Trend und Plateau, nicht für 1RM.

### 7.4 Progression (Doppelte Progression mit RIR)
Volumensatz:
- Letzter Volumensatz ≥ Obergrenze (15) Wdh. → eine Stufe schwerer. Sonst gleiches Gewicht, Ziel +1 Wdh.

Intensivsätze:
- Alle Intensivsätze ≥ Obergrenze (8) → steigern (Sprung-Strategie 7.5).
- Zusätzlich gemeldeter RIR ≥ Ziel-RIR + `doubleStepRIR` (2) → zwei Stufen, sofern die Sprung-Strategie das erlaubt.
- Bester Intensivsatz < Untergrenze (6) → Gewicht halten. Passiert das `dropAfterFails` (2) Mal in Folge → eine Stufe leichter.
- Sonst: Gewicht halten, Ziel +1 Wdh. im schwächsten Satz.

Nicht-kg-Typen: gleiche Logik, aber „Stufe schwerer“ = nächste Stufe in Richtung `harderDirection`, weniger Assistenz, schwächeres Band. `time`: alle Sätze erreichen Ziel → +`timeStep` (5 s).

### 7.5 Sprung-Strategie (relative Sprunggröße)
- `sprungProzent = Gewichtsschritt / e1RM dieser Übung × 100`
- `sprungWdh = sprungProzent / repPct` (`repPct` = 3,33 %, Epley-Näherung)

| sprungWdh | Strategie |
|---|---|
| ≤ `jumpNormal` (2) | Normal steigern |
| ≤ `jumpExtend` (4) | Erst Wdh. über die Obergrenze hinaus sammeln (bis Obergrenze + `extendReps` (2)), dann steigern |
| > `jumpExtend` | Teilsprung: nur der erste Intensivsatz mit neuem Gewicht, Rest mit altem. Jede Einheit, in der der Satz mit neuem Gewicht ≥ Untergrenze erreicht, kommt ein weiterer Satz mit neuem Gewicht dazu |

Ohne e1RM (zu wenig Daten): normal steigern.

### 7.6 Tagesform
| Auswahl | Wirkung (Standard) |
|---|---|
| Gefühl stark | normal, Steigerungen freigegeben |
| Gefühl normal | normal |
| Gefühl müde | Ziel-RIR +1, keine Doppelsprünge |
| Gefühl schwach | Last −`weakPct` (7,5 %), 1 Intensivsatz weniger |
| Krankheit „letzte 10 Tage“ | Last −`recentIllPct` (10 %), 1 Satz weniger pro Übung |
| Krankheit „aktuell leicht“ | nur Aufwärm- und Volumensatz, keine Intensivsätze |

Wirkungen kombinieren sich, die Last wird auf die nächste verfügbare Stufe abgerundet. Einheiten mit reduzierter Tagesform zählen **nicht** für die Plateau-Erkennung.

### 7.7 Plateau
- Vergleichbare Einheiten = gleiche Übung, gleicher Kontext, Tagesform normal oder stark.
- Plateau, wenn in den letzten `plateauSessions` (3) vergleichbaren Einheiten der Bestwert nicht um mehr als `plateauMinGain` (1 %) über dem vorherigen Bestwert lag.
- **Körpergewicht-Regel:** Bei Körpergewichtstypen wird mit effektiver Last gerechnet. Ist das Körpergewicht seit Beginn des Zeitraums gestiegen und die effektive Last dadurch höher, ist es kein Plateau. Hinweis anzeigen: „Körpergewicht +X kg seit [Datum], effektive Leistung gestiegen.“
- **Stufenleiter** (je weiterer Plateau-Einheit eine Stufe höher):
  1. Einen Intensivsatz mehr (Volumen-Hebel).
  2. Variation: andere Übung derselben Muskelgruppe mit ähnlichem Spürgefühl vorschlagen.
  3. Reaktiver Deload für eine Einheit: 1 Satz weniger pro Übung, Ziel-RIR +2.
- Das ist ein Vorschlag, keine Pflicht.

### 7.8 Volumen pro Muskel
- Harte Sätze = Volumen-, Intensivsätze. Eine Drop-Kette zählt als **ein** Satz. Aufwärmsätze zählen nicht.
- Fraktionale Zuordnung über Spürgefühl der Übung: Bewertung ≥ 4 → 1,0; 2–3 → 0,5; 1 → 0.
- Fenster: rollierende `volumeWindowDays` (10) Tage.
- Zielbereich pro Muskelgruppe: `volumeTargetMin`–`volumeTargetMax` (14–28) im 10-Tage-Fenster. Hochrechnung aus 10–20 Sätzen/Woche, Heuristik.

### 7.9 Übungsauswahl und Sortierung
- Standard: absteigend nach Tagen seit letzter Ausführung. Nie ausgeführte Übungen in eigenem Abschnitt „Neu“ am Ende.
- Zeitmodus kurz: absteigend nach Effizienzwert (7.10).
- Rücken-Plus-Vorschlag: 1 Übung mit `backPlus = true`, die nicht zur gewählten Muskelgruppe gehört, am längsten nicht ausgeführt.
- Mobility-Vorschlag: lang → 2, normal → 1 (optional), kurz → 0. Bevorzugt Übungen, deren Spürgefühl die gewählten Muskelgruppen trifft.

### 7.10 Zeit
- Geschätzte Dauer = Σ Aufbauzeit (kurz/mittel/lang = `setupShort`/`setupMedium`/`setupLong`: 1/3/5 Min.) + Σ Sätze × Satzdauer je Typ (`durWarmup` 1,5, `durVolume` 2, `durIntense` 3 Min., inklusive Pause).
- Superset/Komplex: Arbeitszeit aller Übungen der Runde + **eine** Pause pro Runde. Drop-Satz: +0,5 Min.
- Zielzeiten: `timeShort` (45), `timeNormal` (70), `timeLong` (100) Min.
- Effizienzwert = fraktionale Sätze der Übung / geschätzte Minuten.
- Modus kurz: Aufwärmsatz nur bei der ersten Übung je Muskelgruppe, 2 statt 3 Intensivsätze, Hinweis auf Supersets/Drop Sets für zeiteffizientes Arbeiten.
- Modus lang: volles Schema, optional +1 Intensivsatz bei der ersten Übung.
- Liegt die Schätzung über der Zielzeit: Warnung + Kürzungsvorschlag.

---

## 8. Einstellungen (Schwellenwerte mit Standard)

| Schlüssel | Standard | Bedeutung |
|---|---|---|
| warmupPct | 55 | % des Intensivgewichts |
| volumeRange | 12–15 | Wdh. Volumensatz |
| volumeRIR | 2 | |
| intenseRange | 6–8 | Wdh. Intensivsätze |
| intenseRIR | 1 | |
| intenseSets | 3 | |
| defaultRIR | 2 | wenn RIR fehlt |
| doubleStepRIR | 2 | RIR über Ziel für Doppelsprung |
| dropAfterFails | 2 | |
| e1rmMaxReps | 12 | |
| repPct | 3,33 | % Last pro Wdh. |
| jumpNormal | 2 | Sprung in Wdh. |
| jumpExtend | 4 | |
| extendReps | 2 | |
| timeStep | 5 | Sekunden |
| weakPct | 7,5 | |
| recentIllPct | 10 | |
| plateauSessions | 3 | |
| plateauMinGain | 1 | % |
| volumeWindowDays | 10 | |
| volumeTargetMin / Max | 14 / 28 | fraktionale Sätze pro Gruppe im Fenster |
| setupShort / Medium / Long | 1 / 3 / 5 | Minuten |
| durWarmup / durVolume / durIntense | 1,5 / 2 / 3 | Minuten inkl. Pause |
| restWarmup / restVolume / restIntense | 60 / 90 / 150 | Sekunden Pausentimer |
| timeShort / Normal / Long | 45 / 70 / 100 | Minuten |
| backupReminderDays | 7 | |

---

## 9. Import-Format (Notizen)

Datei: `import/notizen.txt`. Der Parser zeigt eine Vorschau und eine Fehlerliste mit Zeilennummern, bevor gespeichert wird. Unbekannte Übungen werden mit Typ und Gruppe aus der Zeile angelegt.

```
## JJJJ-MM-TT | Gruppe[, Gruppe] | gefuehl=normal | krankheit=keine
Name [@ Ort] | typ | gruppe | Sätze | notiz=...
```
- Zeilen mit `#` am Anfang (einfach) sind Kommentare.
- Typen: `gewicht`, `koerpergewicht`, `assistiert`, `band`, `stufe`, `zeit`
- Sätze durch ` ; ` getrennt.
- Satz-Token:
  - `40x8` = 40 kg × 8 Wdh.
  - `KGx12` = Körpergewicht × 12
  - `S11x6` = Stufe 11 × 6 Wdh. (bei `assistiert`/`stufe`)
  - `Bx8` = Band (Stärke unbekannt) × 8; `B12x8` = 12-kg-Band × 8
  - `30s` = 30 Sekunden
  - `@2` hinter dem Satz = RIR 2 (optional)
  - `(langsam)` hinter dem Satz = Satznotiz
  - `A>` vor dem Satz = Aufwärmsatz (optional; sonst automatische Zuordnung)
  - `->` verbindet Drop-Sätze: `45x7 -> 35x5 -> 25x8`
  - `12/10/10` = Wdh. je Bewegung im Komplex
- Gruppen:
```
[SUPERSET]
+ Übung A | ...
+ Übung B | ...
[/]
```
  Satz n von A und Satz n von B bilden Runde n. `[KOMPLEX] Name` funktioniert gleich, Sätze stehen dann nur bei der ersten Zeile mit `12/10/10`-Notation, weitere `+`-Zeilen listen nur die Bewegungen.
- **Automatische Satztyp-Zuordnung** (ohne `A>`): Sätze mit dem höchsten Gewicht (bzw. schwersten Stufe) der Übung = intensiv. Satz direkt davor mit ≥ 12 Wdh. = Volumen. Alles davor = Aufwärmen.
- Fehlende Tagesform → `normal` / `keine`. Fehlender RIR → `defaultRIR`.

---

## 10. Backup und Datensicherheit
- Export/Import wie in 6.6.
- Vor Import oder Schema-Migration: automatisches internes Backup.
- `navigator.storage.persist()` beim ersten Start.
- Backup-Erinnerung nach `backupReminderDays`.

---

## 11. Phasenplan mit Akzeptanzkriterien

### Phase 0 – Setup
- Repository-Grundgerüst, Tokens, leere Tabs mit schwebender Tab-Leiste.
- Manifest, Icons, Service Worker.
- Veröffentlicht über Cloudflare Pages.
**Fertig, wenn:** Die App lässt sich auf dem iPhone zum Homescreen hinzufügen, startet ohne Safari-Leiste und öffnet sich im Flugmodus.

### Phase 1 – MVP: Dokumentation
- Datenbank mit Schema v1 und Migrationsrahmen.
- Übungen anlegen/bearbeiten/archivieren (inkl. Foto, Spürgefühl als Auswahlliste; die Körperkarte kommt in Phase 3).
- Training starten (Muskelgruppen, Zeit, Tagesform), Übungen wählen (Sortierung „Tage seit“), Reihenfolge ändern, Supersets und Komplexe bilden.
- Aktives Training: Sätze loggen, Drop-Ketten, RIR, Notizen, Pausentimer, „Letztes Mal“-Anzeige (noch ohne Vorschläge: Werte vom letzten Mal vorausgefüllt).
- Verlauf mit Detail und Bearbeitung, nachträgliches Anlegen.
- Körpergewicht eintragen.
- Backup Export/Import.
**Fertig, wenn:**
- Ein Satz ist in 3–4 Taps geloggt.
- Ein komplettes Training mit Superset und Drop Set lässt sich erfassen und erscheint korrekt im Verlauf.
- Nach Schließen der App und Neustart des iPhones sind alle Daten vorhanden.
- Export → App-Daten löschen → Import stellt alles inkl. Fotos wieder her.

### Phase 2 – Algorithmus-Kern
- Module 7.1–7.6 inkl. Tests in `tests/tests.html`.
- Einstellungen-Tab mit allen Werten aus Abschnitt 8.
- Vorschläge in der Planung und auf der Übungskarte, mit einzeiliger Begründung.
- Notizen-Import (Abschnitt 9) mit Vorschau und Fehlerliste; Testdatei `import/notizen.txt`.
**Fertig, wenn:**
- Alle Tests grün.
- Nach Import von `notizen.txt` macht die App für jede importierte Übung einen nachvollziehbaren Vorschlag.
- Änderung eines Schwellenwerts ändert den Vorschlag sofort.

### Phase 3 – Grafiken
- Körperkarte (vorne/hinten) als SVG mit Muskel-IDs aus 5.2.
- Spürgefühl per Antippen auf der Körperkarte.
- Erholungskarte (Start), Heatmap (Statistik), Muskelanzeige auf Übungskarten.
- Linien- und Balkendiagramme im Stil der Referenz.
- Statistik-Tab komplett.
**Fertig, wenn:** Liam die Optik freigibt.

### Phase 4 – Extras
- Zeitmodus mit Dauer-Schätzung (7.10), Effizienz-Sortierung.
- Plateau-Erkennung und Stufenleiter (7.7) inkl. Körpergewicht-Regel.
- Rücken-Plus- und Mobility-Vorschläge (7.9).
- Volumen pro Muskel (7.8).
- CSV-Export, Backup-Erinnerung.
**Fertig, wenn:** Alle Funktionen aus Abschnitt 6 und 7 vorhanden sind und die Tests grün sind.

---

## 12. Nicht-Ziele
- Kein Login, keine Cloud-Synchronisation, keine Mehrnutzerfähigkeit.
- Kein App-Store.
- Kein festes Split- oder Programmsystem.
- Keine medizinische oder rückenbezogene Logik (Rücken-Plus ist nur ein Vorschlag).
- Kein Klimmzug-Zielmodus.

## 13. Hinweise zur Evidenz (für Kommentare im Code)
- Doppelte Progression und RIR-Steuerung sind als Prinzipien gut belegt; die konkreten Schwellenwerte sind Heuristiken.
- Drop Sets: gleiche Hypertrophie wie klassische Sätze bei weniger Zeit (Sødal et al. 2023), deshalb zählt eine Drop-Kette als ein Satz.
- Fraktionale Satzzählung nach Pelland et al. (direkt = 1, indirekt = 0,5).
- Deload reaktiv statt geplant (Coleman et al. 2024).
- Variation systematisch statt zufällig (Kassiano et al. 2022).
- Epley-Formel nur bis ca. 12 Wdh. verwenden.
