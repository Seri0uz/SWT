import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { Builder, type WebDriver, type WebElement } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import { JS_FIND_FIRST_LINK } from './wiki-links';
import { createWikiDriver, WIKI_USER_AGENT } from './wiki-browser';

test('Browser lädt keine Bilder; CSS-Linkregeln und Seitenskripte funktionieren weiterhin', async t => {
  const requests: string[] = [];
  const userAgents: string[] = [];
  const server = createServer((request, response) => {
    const path = request.url!;
    requests.push(path);
    if (path === '/wiki/Start') userAgents.push(request.headers['user-agent'] ?? '');
    if (path === '/wiki/Start') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><head>
        <link rel="icon" href="data:,">
        <link rel="stylesheet" href="/style.css">
        <script defer src="/script.js"></script>
        </head><body><h1 id="firstHeading">Start</h1>
        <div id="mw-content-text"><div class="mw-parser-output"><p>
          <a class="italic" href="/wiki/Wrong">Kursiv</a>
          <a class="hidden" href="/wiki/Wrong">Versteckt</a>
          <a href="/wiki/Valid">Richtig</a>
        </p></div></div>
        ${Array.from({ length: 20 }, (_, i) => `<img src="/image-${i}.svg">`).join('')}
        </body>`);
    } else if (path === '/style.css') {
      response.setHeader('Content-Type', 'text/css');
      response.end('.italic { font-style: italic; } .hidden { display: none; }');
    } else if (path === '/script.js') {
      response.setHeader('Content-Type', 'application/javascript');
      response.end('window.fixtureScriptLoaded = true;');
    } else if (path.startsWith('/image-')) {
      response.setHeader('Content-Type', 'image/svg+xml');
      response.end('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const measurements: number[] = [];
  for (const optimized of [false, true]) {
    requests.length = 0;
    let driver: WebDriver | undefined;
    try {
      const baselineOptions = new chrome.Options();
      baselineOptions.addArguments('--headless=new', '--no-sandbox');
      driver = optimized
        ? await createWikiDriver(true)
        : await new Builder().forBrowser('chrome')
          .setChromeOptions(baselineOptions).build();
      await driver.get(`${base}/wiki/Start`);
      await driver.wait(async () => driver!.executeScript(
        'return document.readyState === "complete" && window.fixtureScriptLoaded === true',
      ), 5000);
      const selected = await driver.executeScript(JS_FIND_FIRST_LINK) as WebElement;
      assert.equal(await selected.getAttribute('href'), `${base}/wiki/Valid`);
      assert.equal(requests.filter(path => path.startsWith('/image-')).length, optimized ? 0 : 20);
      for (const path of ['/wiki/Start', '/style.css', '/script.js']) {
        assert.equal(requests.filter(value => value === path).length, 1);
      }
      measurements.push(requests.length);
    } finally {
      await driver?.quit();
    }
  }
  assert.deepEqual(measurements, [23, 3]);
  assert.equal(userAgents[1], WIKI_USER_AGENT);
  assert.match(userAgents[0], /HeadlessChrome/);
  t.diagnostic(`Lokale Testseite: ${measurements[0]} Requests vorher, ${measurements[1]} mit Optimierung.`);
});
