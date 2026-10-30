import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PhilosophyBot, type BotConfig, type RunResult } from './philosophy-bot';

export function parseWords(text: string): string[] {
  return text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/).map(line => line.trim()).filter(Boolean);
}

const statuses: Record<RunResult['terminationReason'], string> = {
  TARGET_REACHED: 'Ziel erreicht',
  CYCLE_DETECTED: 'Schleife erkannt',
  MAX_STEPS_EXCEEDED: 'Seitenlimit erreicht',
  NO_VALID_LINK: 'Kein Folgelink',
  ERROR: 'Fehler',
};
const cell = (value: string) => value.replace(/[\x00-\x1f\x7f]/g, ' ');

export function toCsv(lines: string[]): string {
  return lines.map(line => line.split('\t').map(value =>
    /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value,
  ).join(',')).join('\r\n') + '\r\n';
}

type Runner = (config: BotConfig) => Promise<RunResult>;
export async function runBatch(
  words: string[],
  run: Runner = config => new PhilosophyBot(config).run(),
  output: (line: string) => void = console.log,
  reportError: (line: string) => void = console.error,
): Promise<boolean> {
  output('Wort\tSchritte\tZeit (s)\tStatus');
  let successful = true;
  for (const word of words) {
    const startedAt = Date.now();
    try {
      const result = await run({
        startUrl: `https://de.wikipedia.org/wiki/${encodeURIComponent(word.replaceAll(' ', '_'))}`,
        target: 'Philosophie',
        exactTarget: false,
        maxSteps: 100,
        headless: true,
        highlight: false,
        verbose: false,
        stepDelayMs: 0,
      });
      output(`${cell(word)}\t${result.totalHops}\t${(result.durationMs / 1000).toFixed(2)}\t${statuses[result.terminationReason]}`);
      if (!result.success) successful = false;
      if (result.errorMessage) reportError(`${cell(word)}: ${cell(result.errorMessage)}`);
    } catch (error) {
      successful = false;
      output(`${cell(word)}\t–\t${((Date.now() - startedAt) / 1000).toFixed(2)}\tFehler`);
      reportError(`${cell(word)}: ${cell(error instanceof Error ? error.message : String(error))}`);
    }
  }
  return successful;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Aufruf: npm run batch -- <datei.txt> [loesungen.csv]\nEin Wikipedia-Anfangswort pro Zeile. Schritte = gefolgte Links; die Anfangsseite zählt als 0.');
    return;
  }
  if (args.length < 1 || args.length > 2 || args[0].startsWith('--')) {
    throw new Error('Aufruf: npm run batch -- <datei.txt> [loesungen.csv]');
  }
  const outputPath = resolve(args[1] ?? 'loesungen.csv');
  if (!outputPath.toLowerCase().endsWith('.csv')) throw new Error('Die Ausgabedatei muss auf .csv enden.');
  if (outputPath === resolve(args[0])) throw new Error('Eingabe- und Ausgabedatei müssen verschieden sein.');
  let text: string;
  try {
    text = await readFile(args[0], 'utf8');
  } catch (error) {
    throw new Error(`Datei "${args[0]}" konnte nicht gelesen werden: ${error instanceof Error ? error.message : String(error)}`);
  }
  const words = parseWords(text);
  if (!words.length) throw new Error('Die Datei enthält keine Anfangswörter.');
  const lines: string[] = [];
  const successful = await runBatch(words, undefined, line => {
    console.log(line);
    lines.push(line);
  });
  await writeFile(outputPath, toCsv(lines), 'utf8');
  console.error(`CSV gespeichert: ${outputPath}`);
  if (!successful) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
