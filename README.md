# SWT Übung: Testautomatisierung mit Selenium WebDriver & TypeScript

> **Hochschule Luzern (HSLU) – Modul SWT**  
> **Projekt:** Testautomat für das Spiel «Philosophen-Wiki» (Getting to Philosophy)  
> **Browser:** Google Chrome (Selenium WebDriver)

---

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
