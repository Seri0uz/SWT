# Projektbericht: Philosophen-Wiki

## Aufgabe und Umsetzung

Der Testautomat spielt «Getting to Philosophy» mit Selenium WebDriver,
TypeScript und Google Chrome. Er öffnet einen Wikipedia-Artikel und folgt dem
ersten regelkonformen Link im Fliesstext. Links in Klammern, Kursivschrift,
Fussnoten, Infoboxen und Tabellen werden übersprungen.

Das Ziel ist die feste Philosophie-Adresse der gewählten Sprache. Für Deutsch ist
das `https://de.wikipedia.org/wiki/Philosophie`. «Objekt (Philosophie)» ist eine
Zwischenstation und zählt nicht als Erfolg. Die Anfangsseite zählt als Schritt 0;
standardmässig sind höchstens 100 gefolgte Links erlaubt.

## Bedienung

- `npm run gui`: lokale Weboberfläche mit Live-Seitenfolge und Sprachauswahl.
- `npm start -- Hund`: sichtbarer Einzellauf mit Hervorhebung der gewählten Links.
- `npm start -- Hund --headless`: Einzellauf ohne sichtbares Fenster und ohne Pause.
- `npm run batch -- woerter.txt`: deutsche Begriffe nacheinander prüfen und CSV schreiben.

## Grenzen und Fehlerbehandlung

Wikipedia-Inhalte verändern sich. Eine bestimmte Pfadlänge oder Laufzeit ist
daher kein dauerhaftes Qualitätsversprechen. Ein Lauf endet beim Ziel, einer
Schleife, einer Sackgasse, dem Schrittlimit oder einem Fehler.

Der Browser verwendet eine transparente Bot-Kennung mit Projektlink und lädt
keine Bilder. Wikimedia-Zugriffsbegrenzungen werden erkannt und ohne automatische
Wiederholungen gemeldet. Ein Batch startet danach keine weiteren Seitenaufrufe.

## Qualitätssicherung

`npm run build` prüft die TypeScript-Übersetzung. `npm test` prüft die Regeln und
Abläufe gegen kontrollierte lokale Seiten, einschliesslich der Weboberfläche.
Ein echter Wikipedia-Lauf wird separat mit `npm run test:live` ausgeführt.

Die Installation und vollständige Bedienung sind in der README beschrieben.
