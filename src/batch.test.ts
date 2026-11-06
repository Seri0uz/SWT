import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWords, runBatch, toCsv } from './batch';
import type { BotConfig, RunResult } from './philosophy-bot';

test('TXT: BOM, Windows-/Unix-Zeilenenden, Leerzeilen und mehrteilige Titel', () => {
  assert.deepEqual(parseWords('\uFEFF Hund \r\n\r\nAlbert Einstein\nPhilosophie\rHund\n'), ['Hund', 'Albert Einstein', 'Philosophie', 'Hund']);
  assert.deepEqual(parseWords(' \r\n\t'), []);
});

test('Batch zählt Link-Schritte, misst je Wort und arbeitet nach Fehlern weiter', async () => {
  const calls: BotConfig[] = [];
  const lines: string[] = [];
  const errors: string[] = [];
  const { success } = await runBatch(['Hund', 'Fehler', 'Albert Einstein'], async config => {
    calls.push(config);
    if (calls.length === 2) throw new Error('Browser nicht verfügbar');
    return {
      success: true, targetReached: true, startUrl: config.startUrl!,
      steps: Array.from({ length: 11 }, (_, index) => ({ step: index + 1, title: 'Artikel', url: config.startUrl! })),
      totalHops: 10, durationMs: 1234, terminationReason: 'TARGET_REACHED',
    } satisfies RunResult;
  }, line => lines.push(line), line => errors.push(line));
  assert.equal(success, false);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].verbose, false);
  assert.equal(calls[2].startUrl, 'https://de.wikipedia.org/wiki/Albert_Einstein');
  assert.equal(lines[1], 'Hund\t10\t1.23\tZiel erreicht');
  assert.match(lines[2], /^Fehler\t–\t[0-9.]+\tFehler$/);
  assert.equal(lines[3], 'Albert Einstein\t10\t1.23\tZiel erreicht');
  assert.equal(errors.length, 1);
});

test('Batch gibt nicht erreichte Ziele als erfolglos zurück', async () => {
  const lines: string[] = [];
  const { success } = await runBatch(['Schleife'], async config => ({
    success: false, targetReached: false, startUrl: config.startUrl!,
    steps: [], totalHops: 0, durationMs: 2500, terminationReason: 'CYCLE_DETECTED',
  }), line => lines.push(line));
  assert.equal(success, false);
  assert.equal(lines[1], 'Schleife\t0\t2.50\tSchleife erkannt');
});

test('Batch: nach Wikimedia-429 werden keine weiteren Browserläufe gestartet', async () => {
  let calls = 0;
  const lines: string[] = [];
  const { success } = await runBatch(['Hund', 'Katze', 'Maus'], async config => {
    calls++;
    return {
      success: false, targetReached: false, startUrl: config.startUrl!,
      steps: [], totalHops: 0, durationMs: 100,
      terminationReason: 'RATE_LIMITED', errorMessage: 'Wikipedia begrenzt Zugriffe (429).',
    };
  }, line => lines.push(line), () => {});
  assert.equal(success, false);
  assert.equal(calls, 1);
  assert.equal(lines[1], 'Hund\t0\t0.10\tAnfragelimit erreicht');
  assert.equal(lines[2], 'Katze\t–\t0.00\tNicht ausgeführt (Anfragelimit)');
  assert.equal(lines[3], 'Maus\t–\t0.00\tNicht ausgeführt (Anfragelimit)');
});

test('CSV maskiert Kommas und Anführungszeichen und erhält Zahlenwerte', () => {
  assert.equal(
    toCsv([{ word: 'Begriff, "Zitat"', hops: 11, durationMs: 1234, status: 'Ziel erreicht' }]),
    'Wort,Schritte,Zeit (s),Status\r\n"Begriff, ""Zitat""",11,1.23,Ziel erreicht\r\n',
  );
});

test('Batch: Anfangsseite als Ziel ergibt null Schritte in der CSV', async () => {
  const lines: string[] = [];
  const { success, rows } = await runBatch(['Philosophie'], async config => ({
    success: true, targetReached: true, startUrl: config.startUrl!,
    steps: [{ step: 0, title: 'Philosophie', url: config.startUrl! }],
    totalHops: 0, durationMs: 500, terminationReason: 'TARGET_REACHED',
  }), line => lines.push(line));
  assert.equal(success, true);
  assert.match(toCsv(rows), /Philosophie,0,0.50,Ziel erreicht/);
});
