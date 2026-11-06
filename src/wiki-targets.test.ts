import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WebDriver } from 'selenium-webdriver';
import { PhilosophyBot } from './philosophy-bot';
import { getTargetUrl, isTargetUrl, languages } from './wiki-targets';

for (const [language, { targetUrl }] of Object.entries(languages)) {
  test(`Zieladresse ${language}: fest hinterlegt und sprachgebunden`, async () => {
    assert.equal(getTargetUrl(`https://${language}.wikipedia.org/wiki/Start`), targetUrl);
    assert.equal(isTargetUrl(targetUrl, targetUrl), true);
    assert.equal(isTargetUrl(`${targetUrl}#Abschnitt`, targetUrl), true);
    assert.equal(isTargetUrl(decodeURI(targetUrl), targetUrl), true);
    for (const wrong of [
      `${targetUrl}_(Begriff)`, `${targetUrl}?oldid=123`,
      targetUrl.replace('/wiki/', '/wiki/Objekt_(') + ')',
      targetUrl.replace(`${language}.wikipedia.org`, 'example.com'),
      targetUrl.replace('https:', 'http:'),
    ]) assert.equal(isTargetUrl(wrong, targetUrl), false, wrong);

    // Derselbe Titel auf einer anderen URL darf niemals Erfolg auslösen.
    for (const [currentUrl, success] of [[targetUrl, true], [`${targetUrl}_(Begriff)`, false]] as const) {
      let closed = false;
      const driver = {
        manage: () => ({ setTimeouts: async () => {} }),
        get: async () => {},
        wait: async () => {},
        findElements: async () => [],
        findElement: async () => ({ getText: async () => 'Philosophie' }),
        getCurrentUrl: async () => currentUrl,
        quit: async () => { closed = true; },
      } as unknown as WebDriver;
      const result = await new PhilosophyBot({
        startUrl: `https://${language}.wikipedia.org/wiki/Start`,
        maxSteps: 0, headless: true, verbose: false,
      }, async () => driver).run();
      assert.equal(result.success, success);
      assert.equal(result.targetReached, success);
      assert.equal(result.totalHops, 0);
      assert.equal(closed, true);
    }
  });
}

test('Zieladresse: andere Sprache und abweichende Grossschreibung zählen nicht', () => {
  assert.equal(isTargetUrl(languages.fr.targetUrl, languages.de.targetUrl), false);
  assert.equal(isTargetUrl('https://de.wikipedia.org/wiki/philosophie', languages.de.targetUrl), false);
  assert.throws(() => getTargetUrl('https://example.com/wiki/Philosophie'));
});
