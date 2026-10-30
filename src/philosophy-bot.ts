import { Builder, By, until, WebDriver, WebElement } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

export interface BotConfig {
  startUrl?: string;
  target?: string;
  /** Maximale Anzahl gefolgter Links; die Anfangsseite zählt als Schritt 0. */
  maxSteps?: number;
  headless?: boolean;
  stepDelayMs?: number;
  highlight?: boolean;
  verbose?: boolean;
  onStep?: (step: StepRecord) => void;
  exactTarget?: boolean;
}

export interface StepRecord {
  /** Anzahl gefolgter Links seit der Anfangsseite (0). */
  step: number;
  title: string;
  url: string;
  clickedLinkText?: string;
  clickedLinkHref?: string;
}

export interface RunResult {
  success: boolean;
  startUrl: string;
  targetReached: boolean;
  steps: StepRecord[];
  totalHops: number;
  durationMs: number;
  terminationReason: 'TARGET_REACHED' | 'CYCLE_DETECTED' | 'MAX_STEPS_EXCEEDED' | 'NO_VALID_LINK' | 'ERROR';
  errorMessage?: string;
}

export const JS_FIND_FIRST_LINK = `
const parserOutput = document.querySelector('#mw-content-text .mw-parser-output') || document.querySelector('#mw-content-text');
if (!parserOutput) return null;

const ps = parserOutput.querySelectorAll('p');
for (const p of ps) {
    if (p.closest('.infobox, .hatnote, .toc, .navbox, .thumb, .sidebar, .metadata, .ambox, table')) {
        continue;
    }
    
    let parensDepth = 0;
    
    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            for (const ch of node.textContent) {
                if (ch === '(' || ch === '[' || ch === '{') {
                    parensDepth++;
                } else if (ch === ')' || ch === ']' || ch === '}') {
                    parensDepth = Math.max(0, parensDepth - 1);
                }
            }
            return null;
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
            // Exclude footnote references, edit buttons, pronunciation audio
            if (node.matches('sup, sub, .reference, .mw-editsection, .noviewer, audio, .infobox, .hatnote, .toc, .navbox, .thumb, .sidebar, .metadata, .ambox, table')) {
                return null;
            }
            
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
                return null;
            }

            if (node.tagName.toLowerCase() === 'a') {
                const href = node.getAttribute('href') || '';
                let isWiki = false;
                try {
                    const url = new URL(href, location.href);
                    const article = decodeURIComponent(url.pathname.slice('/wiki/'.length));
                    isWiki = url.origin === location.origin && url.pathname.startsWith('/wiki/') &&
                        article.length > 0 && !article.includes(':') && !url.search && !url.hash &&
                        href.length > 0 && !href.startsWith('#');
                } catch {
                    // Ungültige oder fehlerhaft kodierte URLs sind keine Artikel.
                }
                const isItalic = Boolean(node.closest('i, em') || /^(italic|oblique)/.test(style.fontStyle));
                const text = node.textContent.trimStart();
                const beginsInParens = ['(', '[', '{'].includes(text.charAt(0));

                if (isWiki && !isItalic && parensDepth === 0 && !beginsInParens && text.trim() && node.getClientRects().length) {
                    return node;
                }
            }

            for (const child of node.childNodes) {
                const res = walk(child);
                if (res) return res;
            }
        }
        return null;
    }
    
    const found = walk(p);
    if (found) return found;
}
return null;
`;

export class PhilosophyBot {
  private config: Required<BotConfig>;

  constructor(config: BotConfig = {}, private readonly driverFactory?: () => Promise<WebDriver>) {
    this.config = {
      startUrl: config.startUrl ?? 'https://de.wikipedia.org/wiki/Bananen',
      target: (config.target ?? 'philosophie').trim(),
      maxSteps: config.maxSteps ?? 30,
      headless: config.headless ?? false,
      stepDelayMs: config.stepDelayMs ?? (config.headless ? 0 : 1200),
      highlight: config.highlight ?? !config.headless,
      verbose: config.verbose ?? true,
      onStep: config.onStep ?? (() => {}),
      exactTarget: config.exactTarget ?? false,
    };
    if (!Number.isInteger(this.config.maxSteps) || this.config.maxSteps < 0) {
      throw new Error('maxSteps muss eine nicht negative ganze Zahl sein.');
    }
    if (!this.config.target) throw new Error('Der Zielbegriff darf nicht leer sein.');
    if (!Number.isFinite(this.config.stepDelayMs) || this.config.stepDelayMs < 0) {
      throw new Error('stepDelayMs muss eine endliche, nicht negative Zahl sein.');
    }
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(message);
    }
  }

  private async sleep(ms: number): Promise<void> {
    if (ms > 0) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  private async buildDriver(): Promise<WebDriver> {
    const options = new chrome.Options();
    if (this.config.headless) {
      options.addArguments('--headless=new');
    }
    options.addArguments(
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1400,900',
      '--lang=de-DE'
    );

    const driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    return driver;
  }

  /**
   * Blendet eine schwebende Infoleiste am oberen Bildschirmrand ein
   */
  private async showBanner(driver: WebDriver, step: number, title: string, nextAction: string): Promise<void> {
    const js = `
      let banner = document.getElementById('swt-test-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'swt-test-banner';
        document.body.appendChild(banner);
      }
      banner.style.position = 'fixed';
      banner.style.top = '0';
      banner.style.left = '0';
      banner.style.right = '0';
      banner.style.zIndex = '9999999';
      banner.style.backgroundColor = '#0f172a';
      banner.style.color = '#ffffff';
      banner.style.padding = '12px 24px';
      banner.style.fontFamily = 'Segoe UI, system-ui, sans-serif';
      banner.style.fontSize = '15px';
      banner.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
      banner.style.borderBottom = '3px solid #38bdf8';
      banner.style.display = 'flex';
      banner.style.justifyContent = 'space-between';
      banner.style.alignItems = 'center';
      banner.innerHTML = \`
        <div>
          <span style="background: #38bdf8; color: #0f172a; padding: 3px 8px; border-radius: 4px; font-weight: 800; margin-right: 10px;">SCHRITT \${arguments[0]}</span>
          <strong>\${arguments[1]}</strong>
        </div>
        <div style="font-size: 14px; color: #cbd5e1;">
          \${arguments[2]}
        </div>
      \`;
    `;
    await driver.executeScript(js, step, title, nextAction);
  }

  public async run(): Promise<RunResult> {
    const startTime = Date.now();
    const steps: StepRecord[] = [];
    const visitedUrls = new Set<string>();

    this.log(`================================================================`);
    this.log(`🎮 Philosophen-Wiki Testautomat (Selenium + TypeScript)`);
    this.log(`🌐 Startseite:   ${this.config.startUrl}`);
    this.log(`🎯 Zielbegriff:  "${this.config.target}"`);
    this.log(`🖥️  Browser-Modus: Chrome (Sichtbar: ${!this.config.headless}) | Pause: ${this.config.stepDelayMs}ms`);
    this.log(`================================================================\n`);

    let driver: WebDriver | undefined;

    try {
      driver = await (this.driverFactory ? this.driverFactory() : this.buildDriver());
      await driver.manage().setTimeouts({ pageLoad: 30000, script: 10000 });
      await driver.get(this.config.startUrl);

      for (let step = 0; step <= this.config.maxSteps; step++) {
        // Auf Wikipedia-Titel warten
        await driver.wait(until.elementLocated(By.id('firstHeading')), 10000);
        if ((await driver.findElements(By.css('.noarticletext, .mw-noarticletext'))).length) {
          throw new Error('Der Wikipedia-Artikel existiert nicht.');
        }
        const headingElement = await driver.findElement(By.id('firstHeading'));
        const title = (await headingElement.getText()).trim();
        const currentUrl = (await driver.getCurrentUrl()).split('#')[0];

        const record: StepRecord = {
          step,
          title,
          url: currentUrl,
        };
        steps.push(record);
        this.config.onStep({ ...record });

        this.log(`[Schritt ${step.toString().padStart(2, '0')}] 📄 "${title}"`);
        this.log(`              🔗 ${currentUrl}`);

        // Banner im sichtbaren Browser aktualisieren
        if (this.config.highlight) {
          await this.showBanner(driver, step, title, '🔍 Analysiere Text & filtere Links...');
        }

        // Zielprüfung (z.B. Titel enthält 'philosophie')
        const normalizedTitle = title.normalize('NFC').toLowerCase();
        const normalizedTarget = this.config.target.normalize('NFC').toLowerCase();
        if (this.config.exactTarget ? normalizedTitle === normalizedTarget : normalizedTitle.includes(normalizedTarget)) {
          const durationMs = Date.now() - startTime;
          if (this.config.highlight) {
            await this.showBanner(driver, step, title, '🎉 ZIEL ERREICHT! Test bestanden!');
            await this.sleep(2000);
          }
          this.log(`\n🎉 ZIEL ERREICHT! "${title}" enthält "${this.config.target}".`);
          this.log(`📊 Pfadlänge: ${step} Schritte (${steps.length} Seiten). Dauer: ${(durationMs / 1000).toFixed(2)}s\n`);
          return {
            success: true,
            startUrl: this.config.startUrl,
            targetReached: true,
            steps,
            totalHops: step,
            durationMs,
            terminationReason: 'TARGET_REACHED',
          };
        }

        // Loop / Zyklenerkennung
        if (visitedUrls.has(currentUrl)) {
          const durationMs = Date.now() - startTime;
          this.log(`\n⚠️  ZYKLUS ERKANNT! Seite wurde bereits besucht: ${currentUrl}`);
          return {
            success: false,
            startUrl: this.config.startUrl,
            targetReached: false,
            steps,
            totalHops: step,
            durationMs,
            terminationReason: 'CYCLE_DETECTED',
            errorMessage: `Endlosschleife aufgetreten bei ${currentUrl}`,
          };
        }
        visitedUrls.add(currentUrl);

        if (step === this.config.maxSteps) break;

        // Ersten regelkonformen Link suchen
        const nextLinkElement = (await driver.executeScript(JS_FIND_FIRST_LINK)) as WebElement | null;

        if (!nextLinkElement) {
          const durationMs = Date.now() - startTime;
          this.log(`\n❌ SACKGASSE! Kein gültiger Folgelink gefunden.`);
          return {
            success: false,
            startUrl: this.config.startUrl,
            targetReached: false,
            steps,
            totalHops: step,
            durationMs,
            terminationReason: 'NO_VALID_LINK',
            errorMessage: `Kein Folgelink auf Seite ${title} (${currentUrl})`,
          };
        }

        const linkText = (await nextLinkElement.getText()).trim();
        const linkHref = await nextLinkElement.getAttribute('href');
        record.clickedLinkText = linkText;
        record.clickedLinkHref = linkHref ?? undefined;
        this.config.onStep({ ...record });

        this.log(`              👉 Wähle Link: "${linkText}" -> ${linkHref}`);

        // Visuelle Hervorhebung im Browserfenster (Banner + leuchtende Box)
        if (this.config.highlight) {
          await this.showBanner(
            driver,
            step,
            title,
            `👉 Klicke: <span style="background: #f43f5e; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold;">"${linkText}"</span>`
          );

          await driver.executeScript(
            `arguments[0].style.outline = '4px solid #f43f5e';
             arguments[0].style.backgroundColor = '#fef08a';
             arguments[0].style.color = '#000000';
             arguments[0].style.fontWeight = 'bold';
             arguments[0].style.boxShadow = '0 0 20px #f43f5e';
             arguments[0].style.transition = 'all 0.3s ease';
             arguments[0].scrollIntoView({ behavior: 'smooth', block: 'center' });`,
            nextLinkElement
          );
        }

        // Pause, damit der Zuschauer / die Klasse den Klick mitverfolgen kann
        await this.sleep(this.config.stepDelayMs);

        // Klick ausführen
        await nextLinkElement.click();
      }

      const durationMs = Date.now() - startTime;
      this.log(`\n⏹️  MAXIMALE SCHRITTE (${this.config.maxSteps}) ERREICHT.`);
      return {
        success: false,
        startUrl: this.config.startUrl,
        targetReached: false,
        steps,
        totalHops: Math.max(0, steps.length - 1),
        durationMs,
        terminationReason: 'MAX_STEPS_EXCEEDED',
        errorMessage: `Limit von ${this.config.maxSteps} Schritten erreicht`,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.log(`\n💥 FEHLER BEI DER TESTAUSFÜHRUNG: ${errorMsg}`);
      return {
        success: false,
        startUrl: this.config.startUrl,
        targetReached: false,
        steps,
        totalHops: Math.max(0, steps.length - 1),
        durationMs,
        terminationReason: 'ERROR',
        errorMessage: errorMsg,
      };
    } finally {
      await driver?.quit().catch((error: unknown) => {
        this.log(`Browser konnte nicht geschlossen werden: ${String(error)}`);
      });
    }
  }
}
