import assert from 'node:assert/strict';
import { test } from 'node:test';
import { error, type WebDriver } from 'selenium-webdriver';
import { PhilosophyBot } from './philosophy-bot';

for (const readable of [true, false]) {
  test(`Fehlende Überschrift: Seitendiagnose ${readable ? 'verfügbar' : 'nicht verfügbar'}`, async () => {
    let closed = false;
    const driver = {
      manage: () => ({ setTimeouts: async () => {} }),
      get: async () => {},
      wait: async () => { throw new error.TimeoutError('Timeout'); },
      executeScript: async () => {
        if (!readable) throw new Error('Browser nicht erreichbar');
        return { url: 'https://de.wikipedia.org/wiki/Bananen', title: 'Zugriff gesperrt', text: 'Bitte später versuchen' };
      },
      quit: async () => { closed = true; },
    } as unknown as WebDriver;
    const result = await new PhilosophyBot({ verbose: false }, async () => driver).run();
    assert.equal(result.terminationReason, 'ERROR');
    assert.equal(result.steps.length, 0);
    assert.equal(closed, true);
    assert.match(result.errorMessage!, /Keine Wikipedia-Artikelüberschrift/);
    if (readable) {
      assert.match(result.errorMessage!, /Geladene URL: https:\/\/de.wikipedia.org\/wiki\/Bananen/);
      assert.match(result.errorMessage!, /Seitentitel: Zugriff gesperrt/);
      assert.match(result.errorMessage!, /Seitentext: Bitte später versuchen/);
    } else {
      assert.match(result.errorMessage!, /konnte nicht ausgelesen werden/);
    }
  });
}
