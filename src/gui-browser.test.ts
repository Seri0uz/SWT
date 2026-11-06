import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { By } from 'selenium-webdriver';
import { createGuiServer } from './gui-server';
import { createWikiDriver } from './wiki-browser';
import type { StepRecord } from './philosophy-bot';

test('Oberfläche zeigt Schritte einmal und setzt sich für den nächsten Lauf zurück', async t => {
  let calls = 0;
  const steps: StepRecord[] = [
    { step: 0, title: 'Hund', url: 'https://de.wikipedia.org/wiki/Hund', clickedLinkText: 'Philosophie' },
    { step: 1, title: 'Philosophie', url: 'https://de.wikipedia.org/wiki/Philosophie' },
  ];
  const server = createGuiServer(async config => {
    calls++;
    const success = calls === 1;
    if (success) steps.forEach(step => config.onStep?.(step));
    return {
      success, targetReached: success, startUrl: config.startUrl!,
      steps: success ? steps : [], totalHops: success ? 1 : 0, durationMs: 100,
      terminationReason: success ? 'TARGET_REACHED' : 'RATE_LIMITED',
      errorMessage: success ? undefined : 'Wikimedia weist den Zugriff zurück (429).',
    };
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const driver = await createWikiDriver(true);
  t.after(async () => {
    await driver.quit();
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  });
  await driver.get(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  const start = await driver.findElement(By.id('start'));
  await driver.wait(() => start.isEnabled(), 5000);
  await driver.findElement(By.id('term')).sendKeys('Hund');
  await start.click();
  await driver.wait(async () => (await driver.findElement(By.id('badge')).getText()) === 'Ziel erreicht', 5000);
  assert.equal((await driver.findElements(By.css('#steps li'))).length, 2);
  assert.equal(await driver.findElement(By.id('hops')).getText(), '1');
  assert.equal(await driver.findElement(By.css('#steps li.reached a')).getAttribute('href'), steps[1].url);

  await driver.wait(() => start.isEnabled(), 5000);
  await start.click();
  await driver.wait(async () => (await driver.findElement(By.id('status')).getText()).includes('429'), 5000);
  assert.equal((await driver.findElements(By.css('#steps li'))).length, 0);
  assert.equal(await driver.findElement(By.id('hops')).getText(), '0');
  assert.equal(await driver.findElement(By.id('empty')).isDisplayed(), true);

  await driver.manage().window().setRect({ width: 390, height: 844 });
  assert.equal(await driver.executeScript('return document.documentElement.scrollWidth <= window.innerWidth'), true);
});
