import { PhilosophyBot } from './philosophy-bot';

async function runTest() {
  console.log('🧪 Starting SWT Selenium Test Suite: Getting to Philosophy (Chrome)...');

  // Prüfe, ob der Browser sichtbar angezeigt werden soll:
  // 1) Aufruf mit --visible oder --show
  // 2) Oder Umgebungsvariable HEADLESS=false
  const showBrowser = process.argv.includes('--visible') || process.argv.includes('--show') || process.env.HEADLESS === 'false';
  const isHeadless = !showBrowser;
  const startUrl = process.env.START_URL || 'https://de.wikipedia.org/wiki/Bananen';

  if (showBrowser) {
    console.log('🖥️  SICHTBARER MODUS AKTIV: Google Chrome wird geöffnet und hebt alle Klicks hervor!');
  } else {
    console.log('⚡ HEADLESS MODUS: Test läuft im Hintergrund (Tipp: "npm run test:visible" für sichtbaren Browser).');
  }

  const bot = new PhilosophyBot({
    startUrl,
    target: 'philosophie',
    maxSteps: 30,
    headless: isHeadless,
    stepDelayMs: isHeadless ? 0 : 1200,
    highlight: showBrowser,
    verbose: true,
  });

  const result = await bot.run();

  console.log('\n================================================================');
  console.log('📋 TEST ERGEBNIS-PROTOKOLL:');
  console.log('================================================================');
  console.log(`Status:              ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Startseite:          ${result.startUrl}`);
  console.log(`Ziel erreicht:       ${result.targetReached ? 'JA ("Philosophie")' : 'NEIN'}`);
  console.log(`Anzahl Stationen:    ${result.steps.length}`);
  console.log(`Klicks (Hops):       ${result.totalHops}`);
  console.log(`Gesamtlaufzeit:      ${(result.durationMs / 1000).toFixed(2)} Sekunden`);
  console.log(`Beendigungsgrund:    ${result.terminationReason}`);
  if (result.errorMessage) {
    console.log(`Fehlermeldung:       ${result.errorMessage}`);
  }

  console.log('\nPfad-Chronologie:');
  result.steps.forEach((s) => {
    const nextLink = s.clickedLinkText ? ` ➡️  [${s.clickedLinkText}]` : ' 🏁';
    console.log(`  ${s.step.toString().padStart(2, ' ')}. ${s.title}${nextLink}`);
  });
  console.log('================================================================\n');

  if (result.success && result.targetReached) {
    console.log('✅ TEST BESTANDEN: Der Testautomat hat das Ziel "Philosophie" erfolgreich erreicht!');
    process.exit(0);
  } else {
    console.error('❌ TEST FEHLGESCHLAGEN: Die Spielregeln führten nicht zum gewünschten Ziel.');
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('💥 Unerwarteter Fehler im Testrunner:', err);
  process.exit(1);
});
