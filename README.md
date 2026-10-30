# SWT Übung: Testautomatisierung mit Selenium WebDriver & TypeScript

> **Hochschule Luzern (HSLU) – Modul SWT**  
> **Projekt:** Testautomat für das Spiel «Philosophen-Wiki» (Getting to Philosophy)  
> **Browser:** Google Chrome (Selenium WebDriver)

---

## Weboberfläche

```bash
npm run gui
```

Danach **http://127.0.0.1:3000** im Browser öffnen. Anfangswort eingeben,
Wikipedia-Sprache wählen und **Lauf starten** anklicken. Die Oberfläche zeigt die
Seitenfolge live, die Laufzeit, die Anzahl gefolgter Links (Schritte). Jeder Artikel
lässt sich in einem neuen Tab öffnen. Unterstützt werden Deutsch, Englisch,
Französisch, Italienisch, Spanisch, Portugiesisch und Niederländisch; das Ziel
wird passend zur Sprache gewählt. Wie beim CLI-Lauf genügt es, wenn der
Artikeltitel den Zielbegriff enthält (z. B. «Objekt (Philosophie)»).

Voraussetzungen: Node.js, die Projekt-Abhängigkeiten (`npm install`) und Google
Chrome für den bestehenden Selenium-Bot. Es ist keine separate GUI-Installation
und kein Frontend-Build nötig. Selenium kann beim ersten Start einen passenden
ChromeDriver herunterladen; dafür ist Internetzugriff nötig. Der Server ist nur
lokal erreichbar. Mit `Ctrl+C` beenden. Einen anderen Port wählt man mit
`PORT=3001 npm run gui`.

Ein Lauf endet beim Ziel, einer Schleife, einer Sackgasse, einem Fehler oder nach
100 Schritten. Es läuft höchstens ein Bot gleichzeitig. Beim Schliessen des Tabs
läuft ein gestarteter Bot bis zu einem dieser Abbruchpunkte weiter.

Prüfung der lokalen Serverlogik ohne Wikipedia-Zugriff: `npm run test:gui`.

## Wörter aus einer TXT-Datei ausführen

```bash
npm run batch -- woerter.txt
```

Die Datei enthält einen Artikeltitel pro Zeile, zum Beispiel:

```text
Hund
Philosophie
```

Zusätzlich wird **loesungen.csv** im aktuellen Verzeichnis erstellt (eine vorhandene
Datei wird überschrieben). Ein eigener Ausgabepfad ist optional:

```bash
npm run batch -- woerter.txt meine-loesungen.csv
```

Die CSV enthält die Spalten `Wort,Schritte,Zeit (s),Status`, verwendet Kommas als
Trennzeichen und UTF-8. Zeiten haben einen Dezimalpunkt.

Für jedes Wort erscheint eine Ergebniszeile mit **Schritten**, **Zeit in Sekunden**
und **Status**. Schritte sind die gefolgten Links; die Anfangsseite zählt als 0.
Beispiel: 11 besuchte Seiten entsprechen 10 Schritten. Die Zeit wird für jeden Lauf separat
gemessen. Die Wörter werden nacheinander auf der deutschen Wikipedia verarbeitet,
ohne sichtbares Browserfenster. Leerzeilen werden ignoriert. Ein Titel darf aus
mehreren Wörtern bestehen. Zielerkennung und Schrittlimit entsprechen der GUI.

Dateipfade mit Leerzeichen in Anführungszeichen setzen. Optional die Ergebnisse
als tabulatorgetrennte Textdatei speichern:

```bash
npm run --silent batch -- "meine woerter.txt" > ergebnisse.txt
```

Fehlerdetails erscheinen separat im Terminal. Nach einem fehlgeschlagenen Lauf
werden die übrigen Wörter trotzdem verarbeitet. Exit-Code 0 bedeutet, dass alle
Wörter das Ziel erreicht haben; andernfalls wird Exit-Code 1 zurückgegeben.

## 🚀 Ausführung

### 1. Test im sichtbaren Browser anzeigen (Live-Klicks & Highlights)
Öffnet Google Chrome als echtes Fenster. Eine Infoleiste oben zeigt die aktuelle Seite, der Automat scrollt sanft zum gewählten Link, hebt ihn **leuchtend gelb/rot** hervor, pausiert kurz und klickt ihn an:
```bash
npm run test:visible
```
*(Oder alternativ über den Demo-Befehl: `npm run demo`)*

### 2. Schneller Hintergrund-Test (Headless)
Führt den Test ohne sichtbares Fenster blitzschnell im Hintergrund aus (z.B. für CI/CD Pipelines):
```bash
npm test
```

### 3. Beliebige Startbegriffe ausprobieren
```bash
npx tsx src/index.ts "Albert_Einstein"
npx tsx src/index.ts "Kaffee"
npx tsx src/index.ts "Schweiz"
```

---

## Automatisierte Prüfungen

```bash
npm run build
npm run test:all
```

Die Tests prüfen die tatsächliche Linkauswahl mit Selenium/Chrome gegen lokale,
kontrollierte HTML-Seiten. Dadurch hängen die erwarteten Ergebnisse nicht von
Wikipedia-Änderungen ab. Abgedeckt sind Klammern, Kursivschrift, ausgeblendete
Links, Fussnoten, Infoboxen, URL-Filter und Sprachtreue sowie Zielerkennung,
Weiterleitungen, Schleifen, Sackgassen, Schrittlimits und Browserfehler.
Hinzu kommen Tests für GUI-Schnittstelle, TXT-Dateien, CSV-Escaping und CLI-Fehler.
Chrome/ChromeDriver müssen verfügbar sein; Selenium kann sie beim ersten Lauf
herunterladen. Die Testseiten selbst benötigen keinen Wikipedia-Zugriff.

Nur die Spielregeln: `npm run test:rules`. Der bestehende Befehl `npm test`
bleibt der echte Wikipedia-Lauf. Dessen Pfad und Laufzeit können sich ändern.

Die Projektregel ist bewusst: Jeder Artikeltitel mit «Philosophie» zählt als
Ziel, also auch «Objekt (Philosophie)». Ein Schritt ist ein gefolgter Link. Die
Anfangsseite zählt als 0; n Schritte erlauben höchstens n+1 besuchte Seiten.
Ein Ziel auf dem n-ten Schritt zählt noch als Erfolg.

## 🎯 Spielregeln («Getting to Philosophy»)

1. Eine beliebige Wikipedia-Seite aufrufen (z.B. `Bananen`).
2. Den **ersten Link** im Artikeltext auswählen, der:
   - **nicht kursiv** ist (weder `<i>`, `<em>` noch CSS `font-style: italic`),
   - **nicht in Klammern** steht (z.B. runde `(...)` oder eckige `[...]` Klammern).
3. Fussnoten/Einzelnachweise (`[1]`, `[2]`), Infoboxen, Tabellen, Navigationsleisten und Spezialseiten (`Hilfe:`, `Datei:`) werden ignoriert.
4. Den Link anklicken und den Vorgang wiederholen, bis:
   - die Seite **PHILOSOPHIE** (oder ein Titel mit «Philosophie») erreicht wird, oder
   - ein Zyklus (Endlosschleife) erkannt wird, oder
   - das Schrittlimit $n$ (Standard: 30) erreicht ist.

---

## 📂 Projektstruktur

```
├── src/
│   ├── philosophy-bot.ts   # Kernlogik des Selenium-Testautomaten (DOM-Traversal, Klammer-Stack, Filter, Banner)
│   ├── test.ts             # Test-Runner für `npm test` und `npm run test:visible`
│   └── index.ts            # CLI & Demo-Einstiegspunkt für freie Begriffswahl
├── CHEF_REPORT.md          # Umfassender Management-Report (Tool-Vergleich, Kosten, Fallen, Rollen)
├── package.json            # npm Konfiguration & Scripts
├── tsconfig.json           # TypeScript Konfiguration
└── README.md               # Dokumentation
```
