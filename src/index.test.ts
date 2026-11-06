import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { parseCliArgs } from './index';

test('CLI: Optionen funktionieren vor und nach dem Anfangswort', () => {
  const expected = parseCliArgs(['Hund', '--headless'], {});
  assert.deepEqual(parseCliArgs(['--headless', 'Hund'], {}), expected);
  assert.equal(expected.config.startUrl, 'https://de.wikipedia.org/wiki/Hund');
  assert.equal(expected.config.headless, true);
  assert.equal(expected.config.highlight, false);
});

test('CLI: Standard, mehrteilige Begriffe, URLs und Umgebungsvariablen', () => {
  assert.equal(parseCliArgs([], {}).config.headless, false);
  assert.equal(parseCliArgs([], {}).config.startUrl, 'https://de.wikipedia.org/wiki/Bananen');
  assert.equal(parseCliArgs(['Albert Einstein'], {}).config.startUrl, 'https://de.wikipedia.org/wiki/Albert_Einstein');
  assert.equal(parseCliArgs(['https://en.wikipedia.org/wiki/Dog'], {}).config.startUrl, 'https://en.wikipedia.org/wiki/Dog');
  assert.equal(parseCliArgs([], { HEADLESS: 'true' }).config.headless, true);
  assert.equal(parseCliArgs(['--visible'], { HEADLESS: 'true' }).config.highlight, true);
  assert.equal(parseCliArgs([], { START_URL: 'https://en.wikipedia.org/wiki/Dog' }).config.startUrl, 'https://en.wikipedia.org/wiki/Dog');
});

test('CLI: widersprüchliche, unbekannte und zusätzliche Argumente ablehnen', () => {
  for (const args of [['--headless', '--visible'], ['--unknown'], ['Hund', 'Katze']]) {
    assert.throws(() => parseCliArgs(args, {}));
  }
});

test('CLI: Hilfe und Argumentfehler funktionieren ohne Browserstart', () => {
  for (const [arg, code] of [['--help', 0], ['--unknown', 1]] as const) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', arg], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.status, code);
    if (code === 0) assert.match(result.stdout, /Aufruf:/);
  }
});
