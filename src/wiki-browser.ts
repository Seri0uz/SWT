import { Builder, type WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

// Transparente Bot-Kennung mit Projektlink gemäss Wikimedia User-Agent Policy.
export const WIKI_USER_AGENT = 'SWTPhilosophyBot/1.0 (+https://github.com/Seri0uz/SWT)';

export async function createWikiDriver(headless: boolean): Promise<WebDriver> {
  const options = new chrome.Options();
  if (headless) options.addArguments('--headless=new');
  options.addArguments(
    '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--window-size=1400,900', '--lang=de-DE',
    `--user-agent=${WIKI_USER_AGENT}`,
  );
  // Bilder sind für die Linkregeln unnötig. CSS bleibt für die Erkennung von
  // Kursivschrift und ausgeblendeten Links aktiv.
  options.setUserPreferences({ 'profile.managed_default_content_settings.images': 2 });
  // Weiterarbeiten, sobald das Dokument bereit ist, statt auf alle Medien zu warten.
  options.setPageLoadStrategy('eager');
  return new Builder().forBrowser('chrome').setChromeOptions(options).build();
}
