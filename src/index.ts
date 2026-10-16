import { PhilosophyBot } from './philosophy-bot';

async function main() {
  const args = process.argv.slice(2);
  let term = args[0] || 'Bananen';
  
  let startUrl = term.startsWith('http')
    ? term
    : `https://de.wikipedia.org/wiki/${encodeURIComponent(term)}`;

  const isHeadless = args.includes('--headless');
  const delay = args.includes('--fast') ? 100 : 1200;

  console.log(`\n🚀 Starte Live-Demo für den Chef...`);
  console.log(`Browser öffnet sich sichtbar (Chrome) mit Highlight-Effekt!`);
  console.log(`Startbegriff: ${term}\n`);

  const bot = new PhilosophyBot({
    startUrl,
    target: 'philosophie',
    maxSteps: 35,
    headless: isHeadless,
    stepDelayMs: delay,
    highlight: true,
    verbose: true,
  });

  const result = await bot.run();

  if (result.success) {
    console.log(`\n🎉 DEMO ERFOLGREICH: Ziel "${result.steps[result.steps.length - 1].title}" erreicht!`);
  } else {
    console.log(`\n⚠️  Demo beendet: ${result.terminationReason}`);
  }
}

main().catch((err) => {
  console.error('Fehler:', err);
  process.exit(1);
});
