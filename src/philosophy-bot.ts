import { By, error, WebDriver, WebElement } from 'selenium-webdriver';
import { getTargetUrl, isTargetUrl } from './wiki-targets';
import { createWikiDriver } from './wiki-browser';
import { JS_FIND_FIRST_LINK } from './wiki-links';
import { highlightLink, showBanner } from './browser-visuals';

export const DEFAULT_MAX_STEPS = 100;

const RATE_LIMIT_MESSAGE = 'Wikimedia weist den automatisierten Zugriff zurück (429 – Too many requests). ' +
  'Bitte den Bot pausieren und später erneut versuchen. Wiederholtes Starten oder Aktualisieren vermeiden. ' +
  'Die Antwort allein zeigt nicht, ob die Anfragenzahl oder die Client-Kennung ausschlaggebend ist.';
class RateLimitError extends Error {}
interface PageInfo { url: string; title: string; text: string }

export interface BotConfig {
  startUrl?: string;
  /** Maximale Anzahl gefolgter Links; die Anfangsseite zählt als Schritt 0. */
  maxSteps?: number;
  headless?: boolean;
  stepDelayMs?: number;
  highlight?: boolean;
  verbose?: boolean;
  onStep?: (step: StepRecord) => void;
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
  terminationReason: 'TARGET_REACHED' | 'CYCLE_DETECTED' | 'MAX_STEPS_EXCEEDED' | 'NO_VALID_LINK' | 'RATE_LIMITED' | 'ERROR';
  errorMessage?: string;
}

export class PhilosophyBot {
  private readonly config: Required<BotConfig>;
  private readonly targetUrl: string;

  constructor(config: BotConfig = {}, private readonly driverFactory?: () => Promise<WebDriver>) {
    this.config = {
      startUrl: config.startUrl ?? 'https://de.wikipedia.org/wiki/Bananen',
      maxSteps: config.maxSteps ?? DEFAULT_MAX_STEPS,
      headless: config.headless ?? false,
      stepDelayMs: config.stepDelayMs ?? (config.headless ? 0 : 1200),
      highlight: config.highlight ?? !config.headless,
      verbose: config.verbose ?? true,
      onStep: config.onStep ?? (() => {}),
    };
    this.targetUrl = getTargetUrl(this.config.startUrl);
    if (!Number.isInteger(this.config.maxSteps) || this.config.maxSteps < 0) {
      throw new Error('maxSteps muss eine nicht negative ganze Zahl sein.');
    }
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

  private async readPageInfo(driver: WebDriver): Promise<PageInfo | null> {
    return driver.executeScript<PageInfo>(`
      return {
        url: location.href,
        title: document.title,
        text: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 600)
      };
    `).catch(() => null);
  }

  private checkRateLimit(page: PageInfo | null): void {
    if (page && /wikimedia error/i.test(page.title) && /too many requests|\b429\b/i.test(page.text)) {
      throw new RateLimitError(RATE_LIMIT_MESSAGE);
    }
  }

  private async readArticle(driver: WebDriver): Promise<{ title: string; url: string }> {
    // Auf Wikipedia-Titel warten
    try {
      await driver.wait(async () => {
        const [element] = await driver.findElements(By.id('firstHeading'));
        if (element) return element;
        this.checkRateLimit(await this.readPageInfo(driver));
        return false;
      }, 10000);
    } catch (err) {
      if (!(err instanceof error.TimeoutError)) throw err;
      const page = await this.readPageInfo(driver);
      this.checkRateLimit(page);
      throw new Error(
        'Keine Wikipedia-Artikelüberschrift nach 10 Sekunden gefunden (firstHeading). ' +
        (page
          ? `Geladene URL: ${page.url} | Seitentitel: ${page.title || '(leer)'} | Seitentext: ${page.text || '(leer)'}. `
          : 'Die geladene Seite konnte nicht ausgelesen werden. ') +
        'Bitte die geladene Seite im sichtbaren Browser prüfen (npm run test:visible).'
      );
    }
    if ((await driver.findElements(By.css('.noarticletext, .mw-noarticletext'))).length) {
      throw new Error('Der Wikipedia-Artikel existiert nicht.');
    }
    const headingElement = await driver.findElement(By.id('firstHeading'));
    const title = (await headingElement.getText()).trim();
    const url = (await driver.getCurrentUrl()).split('#')[0];

    return { title, url };
  }

  public async run(): Promise<RunResult> {
    const startedAt = Date.now();
    const steps: StepRecord[] = [];
    const visitedUrls = new Set<string>();
    let reportedSteps = 0;
    let driver: WebDriver | undefined;

    // Jeder Schritt wird genau einmal gemeldet, sobald sein Folgelink bekannt ist.
    const reportStep = () => {
      if (reportedSteps < steps.length) {
        reportedSteps = steps.length;
        this.config.onStep({ ...steps[steps.length - 1] });
      }
    };
    const finish = (terminationReason: RunResult['terminationReason'], errorMessage?: string): RunResult => {
      reportStep();
      const success = terminationReason === 'TARGET_REACHED';
      return {
        success, targetReached: success, terminationReason, errorMessage,
        startUrl: this.config.startUrl,
        steps,
        totalHops: Math.max(0, steps.length - 1),
        durationMs: Date.now() - startedAt,
      };
    };

    this.log(`Start: ${this.config.startUrl}\nZiel: ${this.targetUrl}`);
    try {
      driver = await (this.driverFactory ? this.driverFactory() : createWikiDriver(this.config.headless));
      await driver.manage().setTimeouts({ pageLoad: 30000, script: 10000 });
      await driver.get(this.config.startUrl);

      for (let step = 0; step <= this.config.maxSteps; step++) {
        const { title, url } = await this.readArticle(driver);
        const record: StepRecord = { step, title, url };
        steps.push(record);
        this.log(`[${step}] ${title} — ${url}`);

        if (isTargetUrl(url, this.targetUrl)) {
          if (this.config.highlight) await showBanner(driver, step, title, 'Ziel erreicht!');
          return finish('TARGET_REACHED');
        }
        if (visitedUrls.has(url)) {
          return finish('CYCLE_DETECTED', `Endlosschleife aufgetreten bei ${url}`);
        }
        visitedUrls.add(url);
        if (step === this.config.maxSteps) {
          return finish('MAX_STEPS_EXCEEDED', `Limit von ${this.config.maxSteps} Schritten erreicht`);
        }

        const nextLink = await driver.executeScript(JS_FIND_FIRST_LINK) as WebElement | null;
        if (!nextLink) return finish('NO_VALID_LINK', `Kein Folgelink auf Seite ${title} (${url})`);

        record.clickedLinkText = (await nextLink.getText()).trim();
        record.clickedLinkHref = await nextLink.getAttribute('href') ?? undefined;
        reportStep();
        if (this.config.highlight) {
          await showBanner(driver, step, title, `Nächster Link: ${record.clickedLinkText}`);
          await highlightLink(driver, nextLink);
        }
        await this.sleep(this.config.stepDelayMs);
        await nextLink.click();
      }
      throw new Error('Der Lauf wurde ohne Ergebnis beendet.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(message);
      return finish(err instanceof RateLimitError ? 'RATE_LIMITED' : 'ERROR', message);
    } finally {
      await driver?.quit().catch((err: unknown) => {
        this.log(`Browser konnte nicht geschlossen werden: ${String(err)}`);
      });
    }
  }
}
