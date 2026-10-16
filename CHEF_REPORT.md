# Management-Report & Präsentationsleitfaden für den Chef
## Auftrag: Testautomatisierung des Kassenschlagers «Philosophen-Wiki» mit Selenium

---

## 1. Executive Summary (Für die Chefetage)

* **Status:** Der Testautomat für unser Computerspiel «Philosophen-Wiki» wurde erfolgreich entwickelt, getestet und ist voll funktionsfähig.
* **Ergebnis:** Mit dem Startbegriff **«Bananen»** navigiert der Automat vollautomatisch in **14 Klicks** durch Wikipedia und erreicht zuverlässig die Zielseite **«Objekt (Philosophie)»**.
* **Technologie:** **Selenium WebDriver** mit **TypeScript / Node.js** auf Basis von **Google Chrome**.
* **Ausführung:** Ein einziger Befehl (`npm test`) startet den Testlauf und liefert ein vollständiges Qualitätsprotokoll. Für Live-Demos vor dem Team oder Kunden steht ein visueller Präsentationsmodus (`npm run demo`) bereit, bei dem der Browser sichtbar geöffnet wird und die ausgewählten Links farbig aufleuchten.

---

## 2. Tool-Evaluation: Warum das empfohlene Tool eine Falle war («Kaltes Wasser»)

In der Aufgabenstellung wurde auf **Selenium IDE** (ein Browser-Plugin mit Record & Playback, Screenshot aus 2014) verwiesen. Bei der praktischen Umsetzung wurde sofort klar, warum der Dozent uns «ins kalte Wasser geworfen» hat:

### 2.1 Selenium IDE (Browser-Extension / Record & Replay) – Die Sackgasse
* **Funktionsweise:** Klicks und Tastatureingaben werden wie ein Makro aufgezeichnet und starr wieder abgespielt.
* **Warum es für unser Spiel scheitert:**
  1. **Keine dynamische Logik:** Unser Spiel erfordert Regeln (*«erster Link, der nicht kursiv ist und nicht in Klammern steht»*). Ein Record-Tool klickt immer denselben statischen Link an, kann aber keine dynamischen DOM-Bedingungen prüfen.
  2. **Keine Schleifen / Zielprüfung:** Die Frage *«Wiederhole, bis das Wort Philosophie im Titel steht»* ist mit reinem Record & Playback nicht lösbar.
  3. **Brüchigkeit (Flakiness):** Ändert ein Wikipedia-Autor nur ein Wort im ersten Absatz, schlägt das starre Makro sofort fehl.

### 2.2 Selenium WebDriver (Codebasiert mit TypeScript) – Die richtige Lösung
* **Vorteile:**
  * Vollwertiger Programmiercode: Wir können den DOM-Baum dynamisch durchsuchen, Klammern-Tiefen (`parensDepth`) Zeichen für Zeichen zählen und CSS-Styles (`font-style: italic`) live auswerten.
  * Robustheit: Intelligente Wartezeiten (`WebDriverWait`), Zykluserkennung (verhindert Endlosschleifen) und saubere Fehlerbehandlung.
  * CI/CD-fähig: Lässt sich nahtlos in automatisierte Build-Pipelines (z.B. GitHub Actions, GitLab CI) integrieren.

### 2.3 Moderner Ausblick: Selenium vs. Playwright vs. Cypress
| Kriterium | Selenium IDE | Selenium WebDriver (Unsere Wahl) | Playwright (Modern Alternative) | Cypress |
| :--- | :--- | :--- | :--- | :--- |
| **Typ** | No-Code / Browser-Plugin | Programmier-Framework | Modernes E2E-Framework | Entwickler-zentriertes Tool |
| **Dynamische Logik** | ❌ Nahezu unmöglich | ✅ Exzellent (TypeScript) | ✅ Exzellent (TypeScript) | ✅ Gut |
| **Performance** | Langsam | Schnell (Headless) | Extrem schnell | Mittel |
| **Wartbarkeit** | Sehr schlecht | Hoch | Sehr hoch | Hoch |
| **Marktverbreitung** | Historisch / Veraltet | Weltweiter Industrie-Standard | Stark wachsend (State-of-the-Art) | Beliebt bei Frontendlern |

---

## 3. Kostenanalyse für den Chef (TCO – Total Cost of Ownership)

Unser Chef fragte: *«Was kostet uns das?»*  
Hier ist die ehrliche, transparente betriebswirtschaftliche Aufstellung:

### 3.1 Direkte Lizenzkosten: 0.00 CHF
* **Selenium WebDriver:** 100 % Open Source unter der **Apache 2.0 Lizenz**. Keine Anschaffungs-, Subskriptions- oder Lizenzkosten.
* **Node.js, TypeScript, Google Chrome:** Kostenlos nutzbar.

### 3.2 Infrastrukturkosten: Minimal bis moderat
* **Lokale Ausführung / Entwickler-Rechner:** 0 CHF Zusatzkosten.
* **CI/CD Integration (automatische Tests bei jedem Git-Commit):**
  * GitHub Actions / GitLab CI: Meist in den kostenlosen Freikontingenten (bis zu 2'000 Minuten/Monat) enthalten.
* **Optionale Cloud-Browser-Farmen (z.B. BrowserStack / Sauce Labs):**
  * Falls wir auf 50 verschiedenen Browsern/Handys parallel testen wollen: ca. **\$29 – \$199 / Monat**. Für unser Philosophen-Wiki aktuell **nicht notwendig**.

### 3.3 Der wahre Kostentreiber: Personalkosten & Testwartung (Maintenance)
> **Wichtig für den Chef:** In der Software-Qualitätssicherung gilt die Faustregel:  
> **20 % der Kosten entstehen bei der Ersterstellung – 80 % der Kosten fliessen in die laufende Pflege!**

* **Warum?** Webseiten und UIs verändern sich ständig. Wenn Buttons umbenannt oder Texte umstrukturiert werden, müssen automatisierte Tests gepflegt werden (*«Test Flakiness»*).
* **Massnahme:** Durch saubere Architektur (wie unser rekursiver DOM-Walker) reduzieren wir künftige Wartungskosten auf ein absolutes Minimum.

---

## 4. Die gelösten Herausforderungen («Kaltes Wasser»)

Beim Entwickeln des Automaten traten typische Hürden der Testautomatisierung auf, die wir erfolgreich gelöst haben:

1. **Das Klammer-Problem (Parentheses Depth):**
   * *Problem:* Im Satz `Die Bananen (Musa), veraltet Paradiesfeigen...` steht `Musa` in Klammern. Einfache CSS-Selektoren können nicht wissen, ob sich ein Link innerhalb von Klammern befindet, wenn die öffnende Klammer in einem vorhergehenden Text-Knoten liegt.
   * *Lösung:* Ein Algorithmus zählt Zeichen für Zeichen mit (`parensDepth`), ignoriert Text innerhalb von Klammern und wählt erst den Link, sobald die Klammertiefe 0 ist.
2. **Kursivschrift-Ausschluss:**
   * *Problem:* Lateinische Gattungsnamen oder Zitate sind kursiv (`<i>`, `<em>` oder CSS `font-style: italic`).
   * *Lösung:* Rekursiver Check der Elternknoten und Prüfung der berechneten CSS-Eigenschaften (`getComputedStyle`).
3. **Zyklenerkennung (Endlosschleifen):**
   * *Problem:* Wikipedia-Artikel können Kreisverweise enthalten (z.B. A ➡️ B ➡️ A).
   * *Lösung:* Der Automat führt eine Historie aller besuchten URLs (`Set<string>`) und bricht sofort kontrolliert ab, wenn ein Kreisverkehr erkannt wird.
4. **Moving Target (Wikipedia ändert sich live):**
   * *Problem:* Im Bananen-Beispiel aus der Folie führte Schritt 2 früher zu *«biologische Systematik»*. Heute führt Wikipedia über *«Rangstufe (Biologie)»* und *«biologische Nomenklatur»*.
   * *Erkenntnis:* Externe Systeme sind unberechenbar. Echte Produkt-Tests sollten immer gegen versionierte, kontrollierte Testumgebungen laufen.

---

## 5. Teamorganisation & Kollaboration (Gemäss Folie 5)

Für den Erfolg des Projekts haben wir folgende Rollen und Kollaborationsmittel definiert:

### 5.1 Kollaborations-Stack
* **Kommunikation & Chat:** Slack / Microsoft Teams (Kanal: `#proj-swt-testautomation`).
* **Code-Versionierung & CI/CD:** GitHub / GitLab Repository mit Branch-Protection.
* **Task-Board:** Kanban-Board (GitHub Projects / Jira) mit Spalten: *To Do*, *In Progress*, *Testing*, *Done*.

### 5.2 Rollenverteilung im Team
1. **Lead Test Automation Engineer:** Implementierung der Selenium-Kernlogik, DOM-Traversierung und Browser-Steuerung in TypeScript.
2. **QA & Test Analyst:** Validierung der Testfälle, Erstellung von Grenzwert-Tests (Start bei exotischen Artikeln, Prüfung von Zyklen und Fehlerfällen).
3. **DevOps / Tooling Specialist:** Konfiguration von `npm`, TypeScript-Builds, Headless-Modus und CI/CD-Pipelines.
4. **Dokumentation & Präsentator (Chef-Sprecher):** Erstellung der Präsentationsunterlagen, Kostenkalkulation und Durchführung der Live-Demo vor der Geschäftsleitung.

---

## 6. Regieanweisung für die Live-Demo vor dem Chef

1. **Schritt 1: Terminal öffnen**
   * Projektordner aufrufen: `cd c:\Users\lucbu\workspace\hslu\2026\swt`
2. **Schritt 2: Den Headless-Test demonstrieren (`npm test`)**
   * Befehl ausführen: `npm test`
   * Erklärung für den Chef: *«Hier sehen Sie unseren automatischen Test, wie er im Hintergrund auf dem Server läuft – blitzschnell, ohne grafischen Ballast, ideal für nächtliche Build-Prüfungen.»*
   * Zeigen: Nach ca. 18 Sekunden erscheint das grüne `✅ TEST BESTANDEN` mit den 15 Stationen von Bananen bis Philosophie.
3. **Schritt 3: Die visuelle Live-Demo starten (`npm run demo`)**
   * Befehl ausführen: `npm run demo`
   * Erklärung für den Chef: *«Und nun öffnen wir für Sie das sichtbare Spielfenster. Beobachten Sie, wie der Automat jeden Link prüft, gelb/rot hervorhebt und vollautomatisch bis zum Philosophen-Ziel durchklickt!»*
