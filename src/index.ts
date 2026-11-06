import { parseArgs } from 'node:util';
import { PhilosophyBot, type BotConfig } from './philosophy-bot';

export function parseCliArgs(args: string[], env: NodeJS.ProcessEnv = process.env) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      headless: { type: 'boolean' },
      visible: { type: 'boolean' },
      show: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (positionals.length > 1) throw new Error('Bitte genau ein Anfangswort oder eine Wikipedia-URL angeben.');
  if (values.headless && (values.visible || values.show)) {
    throw new Error('Bitte entweder --headless oder --visible angeben.');
  }
  const term = positionals[0] ?? env.START_URL ?? 'Bananen';
  const headless = values.headless ?? (values.visible || values.show ? false : env.HEADLESS === 'true');
  const config: BotConfig = {
    startUrl: /^https?:\/\//.test(term)
      ? term
      : `https://de.wikipedia.org/wiki/${encodeURIComponent(term.replaceAll(' ', '_'))}`,
    headless,
    highlight: !headless,
    verbose: true,
  };
  return { help: values.help, config };
}

async function main() {
  const { help, config } = parseCliArgs(process.argv.slice(2));
  if (help) {
    console.log('Aufruf: npm start -- [Anfangswort oder URL] [--headless | --visible]');
    return;
  }
  const result = await new PhilosophyBot(config).run();
  console.log(`\nErgebnis: ${result.terminationReason}`);
  console.log(`Schritte: ${result.totalHops} | Laufzeit: ${(result.durationMs / 1000).toFixed(2)} s`);
  if (result.errorMessage) console.error(result.errorMessage);
  process.exitCode = result.success ? 0 : 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
