import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '..');
function cli(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/batch.ts', ...args], {
    cwd: root, encoding: 'utf8', timeout: 10000,
  });
}
test('CLI: Hilfe funktioniert ohne Browserlauf', () => {
  const result = cli(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Aufruf:/);
});
test('CLI: fehlender Dateipfad wird abgelehnt', () => {
  const result = cli([]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Aufruf:/);
});
test('CLI: nicht vorhandene Datei wird verständlich gemeldet', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'swt-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const result = cli([join(directory, 'fehlt.txt')]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /konnte nicht gelesen werden/);
});
test('CLI: leere TXT-Datei überschreibt keine vorhandene Lösung', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'swt-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'leere woerter.txt');
  const output = join(directory, 'loesungen.csv');
  await writeFile(input, '\uFEFF \r\n\t\n');
  await writeFile(output, 'Vorhandene Lösung');
  const result = cli([input, output]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /keine Anfangswörter/);
  assert.equal(await readFile(output, 'utf8'), 'Vorhandene Lösung');
});
test('CLI: Eingabe darf nicht als Ausgabe überschrieben werden', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'swt-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'woerter.csv');
  await writeFile(input, 'Hund');
  const result = cli([input, input]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /verschieden/);
  assert.equal(await readFile(input, 'utf8'), 'Hund');
});
test('CLI: falsche Ausgabe-Endung und zusätzliche Argumente werden abgelehnt', () => {
  assert.equal(cli(['woerter.txt', 'loesungen.txt']).status, 1);
  assert.equal(cli(['woerter.txt', 'loesungen.csv', 'extra']).status, 1);
});
