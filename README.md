# Philosophen-Wiki

Selenium-Bot mit TypeScript und Google Chrome für «Getting to Philosophy».
Er folgt dem ersten gültigen Link im Artikeltext bis zum festen Philosophie-Artikel
der gewählten Wikipedia-Sprache.

## Installation und Start

Voraussetzungen: Node.js und Google Chrome.

```bash
npm install
npm run gui
```

Die Oberfläche unter [127.0.0.1:3000](http://127.0.0.1:3000) öffnen.
Anfangswort eingeben, Sprache wählen und den Lauf starten. Angezeigt werden
Seitenfolge, gefolgte Links und Laufzeit. Mit `Ctrl+C` den Server beenden.
Ein anderer Port ist mit `PORT=3001 npm run gui` möglich.

Der Server ist nur lokal erreichbar und führt höchstens einen Lauf gleichzeitig
aus. Ein gestarteter Lauf läuft auch nach dem Schliessen des Tabs bis zu seinem
Abbruchpunkt weiter.

## Spielregeln

Der Bot berücksichtigt Links in Absätzen des Artikeltexts. Ausgeschlossen sind:

- Links in Klammern oder Kursivschrift.
- Versteckte Links, Fussnoten, Infoboxen, Tabellen und Navigationshinweise.
- Externe Links, andere Wikipedia-Sprachen, Namensräume, Abfragen und Fragmente.

Als Erfolg zählt ausschliesslich die fest hinterlegte Zieladresse der Startsprache,
z. B. `https://de.wikipedia.org/wiki/Philosophie` oder
`https://en.wikipedia.org/wiki/Philosophy`. «Objekt (Philosophie)» genügt nicht.
Unterstützt sind Deutsch, Englisch, Französisch, Italienisch, Spanisch,
Portugiesisch und Niederländisch. Die Adressen stehen in `src/wiki-targets.ts`.

Die Anfangsseite zählt als Schritt 0. Ein Schritt entspricht einem gefolgten Link.
Alle Einstiege erlauben standardmässig höchstens 100 Schritte. Ein Ziel auf dem
letzten erlaubten Schritt zählt als Erfolg. Weitere Abbruchgründe sind eine
Schleife, kein gültiger Folgelink, eine Zugriffsbegrenzung oder ein Browserfehler.

## Einzelnen Lauf ausführen

```bash
npm start -- Hund
npm start -- --headless "Albert Einstein"
npm start -- https://en.wikipedia.org/wiki/Dog --headless
```

Ohne `--headless` öffnet sich ein sichtbarer Browser mit Banner und Hervorhebung.
Die Pause von 1,2 Sekunden hilft beim Mitverfolgen. Headless-Läufe und die GUI
arbeiten ohne künstliche Pause. `npm run demo` ist ein Alias für den sichtbaren
CLI-Einstieg. Weitere Optionen zeigt `npm start -- --help`.

Chrome lädt keine Bilder. CSS und JavaScript bleiben für die Auswertung der
Linkregeln aktiv. Der Browser identifiziert sich als `SWTPhilosophyBot/1.0` mit
Projektlink entsprechend der [Wikimedia User-Agent Policy](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy).
Bei einer Wikimedia-Fehlerseite mit «429 – Too many requests» beendet der Bot den
Lauf ohne automatische Wiederholungen. Die Antwort allein zeigt nicht, ob die
Anfragenzahl oder die Client-Kennung ausschlaggebend ist.

## Wörter aus einer TXT-Datei verarbeiten

```bash
npm run batch -- woerter.txt
npm run batch -- "meine woerter.txt" meine-loesungen.csv
```

Ein deutscher Artikeltitel pro Zeile; Leerzeilen werden ignoriert. Für jedes Wort
erscheint eine tabulatorgetrennte Ergebniszeile im Terminal. Zusätzlich wird eine
UTF-8-CSV mit den Spalten `Wort,Schritte,Zeit (s),Status` geschrieben. Zeiten haben
einen Dezimalpunkt. Standardausgabe ist `loesungen.csv`; vorhandene Ausgabedateien
werden überschrieben. Die generierte Standarddatei wird nicht versioniert.

Die Wörter laufen nacheinander. Einzelne Fehler verhindern die übrigen Läufe
nicht. Nach einer Wikimedia-Zugriffsbegrenzung werden die restlichen Wörter als
«Nicht ausgeführt (Anfragelimit)» protokolliert, ohne weitere Seiten abzurufen.
Nicht ausgeführte oder nicht messbare Schritte erscheinen als `–`.
Fehlerdetails stehen separat im Terminal. Exit-Code 0 bedeutet, dass alle Wörter
das Ziel erreicht haben; andernfalls wird Exit-Code 1 zurückgegeben.

## Prüfen

```bash
npm run build
npm test
```

`npm test` führt die automatisierten Tests gegen lokale Testseiten aus. Geprüft
werden Linkregeln, feste Zieladressen, Abbruchgründe, Browser-Konfiguration,
CLI-Argumente, Batch-Ausgabe sowie Server und Oberfläche. Chrome muss verfügbar
sein. Selenium kann beim ersten Start einen passenden ChromeDriver herunterladen;
dafür ist Internetzugriff nötig. Die Testseiten benötigen keinen Wikipedia-Zugriff.

Ein echter Wikipedia-Lauf wird ausdrücklich separat gestartet:

```bash
npm run test:live
npm run test:visible
```

Standardstart ist «Bananen». Optional: `START_URL=https://de.wikipedia.org/wiki/Hund`.
Die aktuelle Wikipedia-Seitenfolge und Laufzeit sind keine festen Testerwartungen.
