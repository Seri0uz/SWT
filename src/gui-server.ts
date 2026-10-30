import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PhilosophyBot, type BotConfig, type RunResult } from './philosophy-bot';

export const languages = {
  de: { label: 'Deutsch', target: 'Philosophie' },
  en: { label: 'English', target: 'Philosophy' },
  fr: { label: 'Français', target: 'Philosophie' },
  it: { label: 'Italiano', target: 'Filosofia' },
  es: { label: 'Español', target: 'Filosofía' },
  pt: { label: 'Português', target: 'Filosofia' },
  nl: { label: 'Nederlands', target: 'Filosofie' },
};

type Runner = (config: BotConfig) => Promise<RunResult>;
const publicDirectory = resolve(__dirname, '../web');
const assets: Record<string, [string, string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
};

export function createGuiServer(run: Runner = config => new PhilosophyBot(config).run()) {
  let running = false;
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const json = (status: number, body: unknown) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(body));
    };
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/api/languages') {
        json(200, languages);
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/run') {
        const origin = request.headers.origin;
        if (origin && origin !== `http://${request.headers.host}`) {
          json(403, { error: 'Dieser Aufruf ist nur aus der lokalen Oberfläche erlaubt.' });
          return;
        }
        if (!request.headers['content-type']?.startsWith('application/json')) {
          json(415, { error: 'JSON erwartet.' });
          return;
        }
        let body = '';
        for await (const chunk of request) {
          body += chunk.toString();
          if (Buffer.byteLength(body) > 4096) {
            json(413, { error: 'Die Eingabe ist zu lang.' });
            return;
          }
        }
        let input;
        try { input = JSON.parse(body); } catch {
          json(400, { error: 'Die Eingabe konnte nicht gelesen werden.' });
          return;
        }
        const term = typeof input?.term === 'string' ? input.term.trim() : '';
        const language = input?.language;
        if (!term || term.length > 200 || /[\x00-\x1f]/.test(term)) {
          json(400, { error: 'Bitte ein Anfangswort mit 1 bis 200 Zeichen eingeben.' });
          return;
        }
        if (typeof language !== 'string' || !Object.hasOwn(languages, language)) {
          json(400, { error: 'Bitte eine unterstützte Wikipedia-Sprache auswählen.' });
          return;
        }
        if (running) {
          json(409, { error: 'Es läuft bereits eine Suche. Bitte warte, bis sie abgeschlossen ist.' });
          return;
        }
        running = true;
        response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' });
        response.flushHeaders();
        const emit = (type: string, data: unknown) => {
          if (!response.destroyed) response.write(JSON.stringify({ type, data }) + '\n');
        };
        const startedAt = Date.now();
        const heartbeat = setInterval(() => emit('heartbeat', { elapsedMs: Date.now() - startedAt }), 5000);
        try {
          emit('started', { startedAt });
          const result = await run({
            startUrl: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(term.replaceAll(' ', '_'))}`,
            target: languages[language as keyof typeof languages].target,
            exactTarget: false,
            headless: true,
            highlight: false,
            verbose: false,
            maxSteps: 100,
            stepDelayMs: 200,
            onStep: step => emit('step', step),
          });
          emit('result', result);
        } catch (error) {
          emit('error', { message: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startedAt });
        } finally {
          clearInterval(heartbeat);
          running = false;
          response.end();
        }
        return;
      }
      const asset = assets[url.pathname];
      if (request.method === 'GET' && asset) {
        response.writeHead(200, { 'Content-Type': asset[1] });
        response.end(await readFile(resolve(publicDirectory, asset[0])));
        return;
      }
      json(404, { error: 'Nicht gefunden.' });
    } catch (error) {
      if (!response.headersSent) json(500, { error: 'Die Anfrage konnte nicht verarbeitet werden.' });
      else response.end();
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  const server = createGuiServer();
  server.on('error', error => {
    console.error(`GUI konnte nicht starten: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`\nPhilosophen-Wiki ist bereit: http://127.0.0.1:${port}\nBeenden mit Ctrl+C.\n`);
  });
}
