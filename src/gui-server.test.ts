import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createGuiServer } from './gui-server';
import type { BotConfig, RunResult } from './philosophy-bot';

function result(config: BotConfig): RunResult {
  return {
    success: true, startUrl: config.startUrl!, targetReached: true,
    steps: [{ step: 0, title: 'Philosophy', url: config.startUrl! }],
    totalHops: 0, durationMs: 120, terminationReason: 'TARGET_REACHED',
  };
}

test('GUI liefert Dateien, validiert Eingaben und streamt sprachabhängige Bot-Ergebnisse', async t => {
  const calls: BotConfig[] = [];
  const server = createGuiServer(async config => {
    calls.push(config);
    const value = result(config);
    config.onStep?.(value.steps[0]);
    return value;
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (body: unknown, headers = {}) => fetch(`${base}/api/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Der Weg zur Philosophie/);
  for (const asset of ['/style.css', '/app.js']) assert.equal((await fetch(base + asset)).status, 200);
  assert.equal((await fetch(base + '/src/philosophy-bot.ts')).status, 404);
  const languages = await (await fetch(base + '/api/languages')).json();
  assert.equal(languages.es.target, 'Filosofía');
  for (const input of [null, {}, { term: '   ', language: 'de' }, { term: 'Wort', language: '__proto__' }, { term: 'x'.repeat(201), language: 'de' }]) {
    assert.equal((await post(input)).status, 400);
  }
  assert.equal((await post({ term: 'Test', language: 'de' }, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await post({ term: 'x'.repeat(5000), language: 'de' })).status, 413);
  assert.equal(calls.length, 0);
  const response = await post({ term: ' Albert Einstein ', language: 'en' });
  assert.equal(response.status, 200);
  const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(events.map(event => event.type), ['step', 'result']);
  assert.equal(events[1].data.success, true);
  assert.equal(calls[0].startUrl, 'https://en.wikipedia.org/wiki/Albert_Einstein');
  assert.equal(languages.en.targetUrl, 'https://en.wikipedia.org/wiki/Philosophy');
  assert.equal(calls[0].headless, true);
});

test('GUI sperrt parallele Läufe und gibt nach einem Browserfehler wieder frei', async t => {
  let release!: () => void;
  let count = 0;
  const server = createGuiServer(async config => {
    count++;
    if (count === 1) {
      await new Promise<void>(resolve => { release = resolve; });
      throw new Error('Chrome nicht verfügbar');
    }
    return result(config);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/run`;
  const start = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ term: 'Philosophie', language: 'de' }) });
  const first = await start();
  assert.equal((await start()).status, 409);
  release();
  assert.match(await first.text(), /Chrome nicht verfügbar/);
  const next = await start();
  assert.equal(next.status, 200);
  assert.match(await next.text(), /TARGET_REACHED/);
});
