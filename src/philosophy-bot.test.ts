import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type WebDriver, type WebElement } from 'selenium-webdriver';
import { PhilosophyBot, type BotConfig, type StepRecord } from './philosophy-bot';
import { JS_FIND_FIRST_LINK } from './wiki-links';
import { createWikiDriver } from './wiki-browser';
import { showBanner } from './browser-visuals';

const link = (href: string, text = 'Link') => `<a href="${href}">${text}</a>`;
const pages: Record<string, { title: string; body: string; redirect?: string; raw?: boolean }> = {
  Start: { title: 'Anfang', body: `<p>${link('/wiki/Middle')}</p>` },
  Middle: { title: 'Mitte', body: `<p>${link('/wiki/Philosophie')}</p>` },
  Philosophie: { title: 'Philosophie', body: '' },
  Target: { title: 'Objekt (Philosophie)', body: `<p>${link('/wiki/Never')}</p>` },
  Exact: { title: '', body: '', redirect: '/wiki/Philosophie' },
  Unicode: { title: 'FILOSOFI\u0301A', body: '' },
  CycleA: { title: 'A', body: `<p>${link('/wiki/CycleB')}</p>` },
  CycleB: { title: 'B', body: `<p>${link('/wiki/CycleA')}</p>` },
  Self: { title: 'Selbst', body: `<p>${link('/wiki/Self')}</p>` },
  Dead: { title: 'Sackgasse', body: `<p><i>${link('/wiki/Exact')}</i></p>` },
  Alias: { title: '', body: '', redirect: '/wiki/Philosophie' },
  Missing: { title: 'Philosophie fehlt', body: '<div class="noarticletext">Dieser Artikel existiert nicht.</div>' },
  Limited: { title: 'Wikimedia Error', body: 'Error Too many requests. Error: 429', raw: true },
};
const requests: string[] = [];
const server = createServer((request, response) => {
  const name = decodeURIComponent((request.url ?? '').split('/wiki/')[1] ?? '');
  requests.push(name);
  const page = pages[name] ?? { title: 'Fixture', body: '' };
  if (page.redirect) { response.writeHead(302, { Location: page.redirect }); response.end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(page.raw
    ? `<!doctype html><meta charset="utf-8"><title>${page.title}</title><p>${page.body}</p>`
    : `<!doctype html><meta charset="utf-8"><h1 id="firstHeading">${page.title}</h1><div id="mw-content-text"><div class="mw-parser-output">${page.body}</div></div>`);
});
let base: string;
let driver: WebDriver;
let cleanups = 0;
before(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  driver = await createWikiDriver(true);
});
after(async () => {
  await driver?.quit();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

async function selected(html: string): Promise<string | null> {
  await driver.get(`${base}/wiki/Fixture`);
  await driver.executeScript('document.querySelector(".mw-parser-output").innerHTML = arguments[0]', html);
  const found = await driver.executeScript(JS_FIND_FIRST_LINK) as WebElement | null;
  return found ? found.getAttribute('href') : null;
}
const valid = link('/wiki/Valid', 'Gültig');
const cases: [string, string][] = [
  ['erster Link im ersten Absatz', `<p>${valid}${link('/wiki/Later')}</p>`],
  ['verschachtelte Klammern', `<p>(Text [${link('/wiki/Wrong')}] {Text}) ${valid}</p>`],
  ['Klammern über mehrere Textknoten', `<p>(Text <span>${link('/wiki/Wrong')}</span>) ${valid}</p>`],
  ['Klammern innerhalb von Links', `<p>${link('/wiki/Wrong', '(falsch)')} ${valid}</p>`],
  ['runde Klammern im Artikelnamen sind erlaubt', `<p>${link('/wiki/Valid', 'Begriff (Zusatz)')}</p>`],
  ['kursives i und em', `<p><i>${link('/wiki/Wrong')}</i><em>${link('/wiki/Wrong')}</em>${valid}</p>`],
  ['geerbtes CSS italic', `<p><span style="font-style:italic">${link('/wiki/Wrong')}</span>${valid}</p>`],
  ['CSS oblique', `<p><span style="font-style:oblique">${link('/wiki/Wrong')}</span>${valid}</p>`],
  ['Fussnoten', `<p><sup>${link('/wiki/Wrong')}</sup><span class="reference">${link('/wiki/Wrong')}</span>${valid}</p>`],
  ['Infobox und Tabelle', `<div class="infobox"><p>${link('/wiki/Wrong')}</p></div><table><tr><td><p>${link('/wiki/Wrong')}</p></td></tr></table><p>${valid}</p>`],
  ['Hinweisboxen', `<div class="hatnote"><p>${link('/wiki/Wrong')}</p></div><div class="navbox"><p>${link('/wiki/Wrong')}</p></div><p>${valid}</p>`],
  ['ausgeblendete Links', `<p><span hidden>${link('/wiki/Wrong')}</span>${valid}</p>`],
  ['Nicht-Artikel, Fragmente und Abfragen', `<p>${link('/wiki/Datei:Bild')}${link('/wiki/Hilfe:Inhalt')}${link('#Anker')}${link('/wiki/Test?oldid=1')}${valid}</p>`],
  ['URL-kodierter Namensraum', `<p>${link('/wiki/Datei%3ABild')}${valid}</p>`],
  ['externe Links', `<p>${link('https://example.com/wiki/Wrong')}${valid}</p>`],
  ['andere Wikipedia-Sprache', `<p>${link('https://en.wikipedia.org/wiki/Wrong')}${valid}</p>`],
  ['fehlerhafte URL-Kodierung', `<p>${link('/wiki/Fehler%ZZ')}${valid}</p>`],
  ['leerer Link', `<p>${link('/wiki/Empty', '')}${valid}</p>`],
  ['versteckte Klammern beeinflussen sichtbaren Text nicht', `<p><span hidden>(</span>${valid}</p>`],
  ['Inline-Hinweise überspringen', `<p><span class="hatnote">${link('/wiki/Wrong')}</span>${valid}</p>`],
  ['Link in Überschrift überspringen', `<h2>${link('/wiki/Wrong')}</h2><p>${valid}</p>`],
];
for (const [name, html] of cases) {
  test(`Linkregel: ${name}`, async () => assert.equal(await selected(html), `${base}/wiki/Valid`));
}
test('Linkregel: kein gültiger Link', async () => assert.equal(await selected('<p>Nur Text.</p>'), null));
test('Linkregel: fehlender Artikelcontainer', async () => {
  await driver.get(`${base}/wiki/Fixture`);
  await driver.executeScript('document.querySelector("#mw-content-text").remove()');
  assert.equal(await driver.executeScript(JS_FIND_FIRST_LINK), null);
});

test('Demo-Banner behandelt Titel und Linktext als Text, nicht als HTML', async () => {
  await driver.get(`${base}/wiki/Fixture`);
  const title = '<img src="/unexpected" onerror="window.injected = true">';
  await showBanner(driver, 0, title, '<b>Link</b>');
  assert.equal(await driver.executeScript('return document.querySelector("#swt-test-banner").textContent'), `Schritt 0 · ${title} · <b>Link</b>`);
  assert.equal(await driver.executeScript('return document.querySelector("#swt-test-banner").children.length'), 0);
});

async function run(name: string, config: BotConfig = {}) {
  const cleanupBefore = cleanups;
  const shared = new Proxy(driver, {
    get(target, key) {
      if (key === 'get') return async (url: string) => target.get(url.replace('https://de.wikipedia.org', base));
      if (key === 'getCurrentUrl') return async () => (await target.getCurrentUrl()).replace(base, 'https://de.wikipedia.org');
      if (key === 'quit') return async () => { cleanups++; };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const result = await new PhilosophyBot({ startUrl: `https://de.wikipedia.org/wiki/${name}`, headless: true, verbose: false, maxSteps: 10, stepDelayMs: 0, ...config }, async () => shared).run();
  assert.equal(cleanups, cleanupBefore + 1, 'Browser wird für jedes Ergebnis freigegeben');
  assert.ok(Number.isFinite(result.durationMs) && result.durationMs >= 0);
  assert.equal(result.totalHops, Math.max(0, result.steps.length - 1));
  return result;
}
test('Ablauf: Ziel nach drei Seiten; Live-Ereignisse entsprechen dem Ergebnis', async () => {
  const events: StepRecord[] = [];
  const result = await run('Start', { onStep: step => events.push(step) });
  assert.equal(result.terminationReason, 'TARGET_REACHED');
  assert.equal(result.success, true);
  assert.deepEqual(result.steps.map(step => step.title), ['Anfang', 'Mitte', 'Philosophie']);
  assert.deepEqual(events, result.steps);
});
test('Ablauf: Anfangsseite ist bereits das Ziel', async () => {
  const result = await run('Exact');
  assert.equal(result.success, true);
  assert.equal(result.steps.length, 1);
  assert.equal(result.totalHops, 0);
});
test('Ablauf: fremder Titel ist kein Ziel', async () => assert.equal((await run('Unicode')).success, false));
test('Ablauf: Philosophie als Teilbegriff ist kein Ziel', async () => assert.equal((await run('Target', { maxSteps: 0 })).success, false));
test('Ablauf: A-B-A-Schleife', async () => {
  const result = await run('CycleA');
  assert.equal(result.terminationReason, 'CYCLE_DETECTED');
  assert.equal(result.steps.length, 3);
});
test('Ablauf: Selbstverlinkung', async () => {
  const result = await run('Self');
  assert.equal(result.terminationReason, 'CYCLE_DETECTED');
  assert.equal(result.steps.length, 2);
});
test('Ablauf: Sackgasse', async () => assert.equal((await run('Dead')).terminationReason, 'NO_VALID_LINK'));
test('Ablauf: Limit ohne zusätzlichen Klick', async () => {
  requests.length = 0;
  const result = await run('Start', { maxSteps: 1 });
  assert.equal(result.terminationReason, 'MAX_STEPS_EXCEEDED');
  assert.equal(result.steps.length, 2);
  assert.equal(requests.includes('Philosophie'), false);
});
test('Ablauf: Ziel nach exakt n Schritten zählt als Erfolg', async () => {
  const result = await run('Start', { maxSteps: 2 });
  assert.equal(result.success, true);
  assert.equal(result.totalHops, 2);
  assert.deepEqual(result.steps.map(step => step.step), [0, 1, 2]);
});
test('Ablauf: Weiterleitung zählt nicht als zusätzliche Seite', async () => {
  const result = await run('Alias');
  assert.equal(result.success, true);
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].url, 'https://de.wikipedia.org/wiki/Philosophie');
});
test('Ablauf: nicht vorhandener Artikel ist kein Ziel', async () => {
  const result = await run('Missing');
  assert.equal(result.success, false);
  assert.equal(result.terminationReason, 'ERROR');
});
test('Ablauf: Wikimedia-429 wird als Anfragelimit erkannt, ohne weitere Navigation', async () => {
  requests.length = 0;
  const result = await run('Limited');
  assert.equal(result.terminationReason, 'RATE_LIMITED');
  assert.equal(result.success, false);
  assert.equal(result.steps.length, 0);
  assert.match(result.errorMessage!, /429/);
  assert.match(result.errorMessage!, /pausieren/);
  assert.deepEqual(requests.filter(name => name !== ''), ['Limited']);
});
test('Ablauf: Browserstartfehler wird als Ergebnis geliefert', async () => {
  const result = await new PhilosophyBot({ verbose: false }, async () => { throw new Error('Browserstart fehlgeschlagen'); }).run();
  assert.equal(result.terminationReason, 'ERROR');
  assert.equal(result.steps.length, 0);
  assert.equal(result.totalHops, 0);
  assert.match(result.errorMessage!, /Browserstart/);
});
test('Konfiguration: ungültige Limits und nicht unterstützte Startsprache ablehnen', () => {
  for (const maxSteps of [-1, 1.5, NaN, Infinity]) assert.throws(() => new PhilosophyBot({ maxSteps }));
  assert.throws(() => new PhilosophyBot({ startUrl: 'https://example.com/wiki/Philosophie' }));
});

test('Linkregel: absolute und protokollrelative Artikel derselben Sprache', async () => {
  for (const href of [`${base}/wiki/Valid`, `${base.replace('http:', '')}/wiki/Valid`]) {
    assert.equal(await selected(`<p>${link(href)}</p>`), `${base}/wiki/Valid`);
  }
});
test('Ablauf: fehlgeschlagene Navigation liefert Fehler und schliesst den Browser', async () => {
  let closed = false;
  const brokenDriver = {
    manage: () => ({ setTimeouts: async () => {} }),
    get: async () => { throw new Error('Navigation fehlgeschlagen'); },
    quit: async () => { closed = true; },
  } as unknown as WebDriver;
  const result = await new PhilosophyBot({ verbose: false }, async () => brokenDriver).run();
  assert.equal(result.terminationReason, 'ERROR');
  assert.equal(result.steps.length, 0);
  assert.equal(closed, true);
});
test('Ablauf: Fehler beim Schliessen überschreibt das eigentliche Ergebnis nicht', async () => {
  const brokenDriver = {
    manage: () => ({ setTimeouts: async () => {} }),
    get: async () => { throw new Error('Navigation fehlgeschlagen'); },
    quit: async () => { throw new Error('Schliessen fehlgeschlagen'); },
  } as unknown as WebDriver;
  const result = await new PhilosophyBot({ verbose: false }, async () => brokenDriver).run();
  assert.equal(result.errorMessage, 'Navigation fehlgeschlagen');
});

test('Ablauf: n=0 besucht nur die Anfangsseite und folgt keinem Link', async () => {
  requests.length = 0;
  const result = await run('Start', { maxSteps: 0 });
  assert.equal(result.terminationReason, 'MAX_STEPS_EXCEEDED');
  assert.equal(result.totalHops, 0);
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].step, 0);
  assert.equal(requests.includes('Middle'), false);
});
test('Ablauf: Philosophie im Titel genügt auch bei n=0 nicht', async () => {
  const result = await run('Target', { maxSteps: 0 });
  assert.equal(result.success, false);
  assert.equal(result.terminationReason, 'MAX_STEPS_EXCEEDED');
  assert.equal(result.totalHops, 0);
  assert.equal(result.steps[0].title, 'Objekt (Philosophie)');
});
