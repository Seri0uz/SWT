const form = document.querySelector('#run-form');
const term = document.querySelector('#term');
const language = document.querySelector('#language');
const start = document.querySelector('#start');
const timer = document.querySelector('#timer');
const status = document.querySelector('#status');
const badge = document.querySelector('#badge');
const steps = document.querySelector('#steps');
const empty = document.querySelector('#empty');
const rows = new Map();
let languages = {};
let running = false;
let startedAt = 0;
let clock;

function formatDuration(ms) {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  return `${String(Math.floor(tenths / 600)).padStart(2, '0')}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')},${tenths % 10}`;
}
function state(label, kind, message) {
  badge.textContent = label;
  badge.dataset.state = kind;
  status.textContent = message;
}
function updateLanguage() {
  const code = language.value;
  const target = languages[code].target;
  const link = document.querySelector('#target');
  link.textContent = `${target} ↗`;
  link.href = `https://${code}.wikipedia.org/wiki/${encodeURIComponent(target)}`;
}
function showStep(step) {
  empty.hidden = true;
  let row = rows.get(step.step);
  if (!row) {
    row = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'step-number';
    number.textContent = step.step;
    const content = document.createElement('div');
    content.className = 'step-content';
    const link = document.createElement('a');
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const detail = document.createElement('small');
    content.append(link, detail);
    row.append(number, content);
    rows.set(step.step, row);
    steps.append(row);
  }
  const link = row.querySelector('a');
  const url = new URL(step.url);
  if (url.protocol === 'https:' && /^[a-z]+\.wikipedia\.org$/.test(url.hostname)) link.href = url.href;
  link.textContent = `${step.title} ↗`;
  row.querySelector('small').textContent = step.clickedLinkText ? `Nächster Link: ${step.clickedLinkText}` : (step.step === 0 ? 'Anfangsartikel · 0 Schritte' : 'Artikel erreicht');
  document.querySelector('#hops').textContent = Math.max(0, rows.size - 1);
}
const outcomes = {
  TARGET_REACHED: ['Ziel erreicht', 'success', 'Ein Artikel mit dem Zielbegriff wurde erreicht.'],
  CYCLE_DETECTED: ['Schleife erkannt', 'warning', 'Ein Artikel wurde erneut besucht. Der Lauf wurde beendet.'],
  NO_VALID_LINK: ['Sackgasse', 'warning', 'Kein gültiger Folgelink gefunden.'],
  MAX_STEPS_EXCEEDED: ['Schrittlimit erreicht', 'warning', 'Nach 100 Schritten beendet. Das Ziel wurde nicht erreicht.'],
  ERROR: ['Lauf fehlgeschlagen', 'error', 'Der Lauf konnte nicht abgeschlossen werden.'],
};
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (running) return;
  if (!term.value.trim()) {
    term.setCustomValidity('Bitte ein Anfangswort eingeben.');
    term.reportValidity();
    return;
  }
  running = true;
  term.disabled = language.disabled = start.disabled = true;
  start.textContent = 'Läuft …';
  rows.clear();
  steps.replaceChildren();
  empty.hidden = true;
  document.querySelector('#hops').textContent = '0';
  startedAt = performance.now();
  timer.textContent = formatDuration(0);
  clock = setInterval(() => timer.textContent = formatDuration(performance.now() - startedAt), 100);
  state('Läuft', 'running', 'Erster Artikel wird geladen …');
  let finished = false;
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term: term.value.trim(), language: language.value }),
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Der Lauf konnte nicht gestartet werden.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    function handleLine(line) {
      if (!line.trim()) return;
      const event = JSON.parse(line);
      if (event.type === 'step') {
        showStep(event.data);
        status.textContent = `Schritt ${event.data.step}: ${event.data.title}`;
      } else if (event.type === 'result') {
        finished = true;
        clearInterval(clock);
        timer.textContent = formatDuration(event.data.durationMs);
        event.data.steps.forEach(showStep);
        document.querySelector('#hops').textContent = event.data.totalHops;
        const outcome = outcomes[event.data.terminationReason] || outcomes.ERROR;
        state(...outcome);
        if (event.data.terminationReason === 'ERROR') status.textContent += ` ${event.data.errorMessage || ''} Prüfe die Internetverbindung und ob Google Chrome installiert ist.`;
        const last = steps.lastElementChild;
        if (last) {
          last.querySelector('small').textContent = event.data.success ? 'Zielartikel erreicht' : 'Hier endet dieser Lauf';
          last.classList.toggle('reached', event.data.success);
        }
      } else if (event.type === 'error') {
        clearInterval(clock);
        timer.textContent = formatDuration(event.data.durationMs);
        throw new Error(event.data.message);
      }
    }
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach(handleLine);
      if (done) break;
    }
    if (buffer.trim()) handleLine(buffer);
    if (!finished) throw new Error('Die Verbindung zum Lauf wurde unterbrochen. Ein laufender Bot wird im Hintergrund beendet; bitte warte vor einem neuen Versuch.');
  } catch (error) {
    state('Lauf fehlgeschlagen', 'error', error.message);
  } finally {
    clearInterval(clock);
    running = false;
    term.disabled = language.disabled = start.disabled = false;
    start.replaceChildren(document.createTextNode('Lauf starten'));
    if (!rows.size) {
      empty.querySelector('p').textContent = 'Keine Seiten besucht.';
      empty.hidden = false;
    }
  }
});
term.addEventListener('input', () => term.setCustomValidity(''));
language.addEventListener('change', updateLanguage);
window.addEventListener('beforeunload', event => {
  if (running) { event.preventDefault(); event.returnValue = ''; }
});
async function initialize() {
  try {
    const response = await fetch('/api/languages');
    if (!response.ok) throw new Error();
    languages = await response.json();
    language.replaceChildren(...Object.entries(languages).map(([code, value]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = value.label;
      return option;
    }));
    language.value = 'de';
    language.disabled = start.disabled = false;
    updateLanguage();
  } catch {
    state('Nicht verbunden', 'error', 'Der lokale Server ist nicht erreichbar. Starte npm run gui und lade die Seite erneut.');
  }
}
initialize();
