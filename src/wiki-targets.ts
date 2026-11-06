export const languages = {
  de: { label: 'Deutsch', target: 'Philosophie', targetUrl: 'https://de.wikipedia.org/wiki/Philosophie' },
  en: { label: 'English', target: 'Philosophy', targetUrl: 'https://en.wikipedia.org/wiki/Philosophy' },
  fr: { label: 'Français', target: 'Philosophie', targetUrl: 'https://fr.wikipedia.org/wiki/Philosophie' },
  it: { label: 'Italiano', target: 'Filosofia', targetUrl: 'https://it.wikipedia.org/wiki/Filosofia' },
  es: { label: 'Español', target: 'Filosofía', targetUrl: 'https://es.wikipedia.org/wiki/Filosof%C3%ADa' },
  pt: { label: 'Português', target: 'Filosofia', targetUrl: 'https://pt.wikipedia.org/wiki/Filosofia' },
  nl: { label: 'Nederlands', target: 'Filosofie', targetUrl: 'https://nl.wikipedia.org/wiki/Filosofie' },
} as const;

export function getTargetUrl(startUrl: string): string {
  const hostname = new URL(startUrl).hostname;
  for (const [language, config] of Object.entries(languages)) {
    if (hostname === `${language}.wikipedia.org`) return config.targetUrl;
  }
  throw new Error('Die Startadresse muss zu einer unterstützten Wikipedia-Sprache gehören.');
}

export function isTargetUrl(currentUrl: string, targetUrl: string): boolean {
  const current = new URL(currentUrl);
  const target = new URL(targetUrl);
  return current.origin === target.origin && current.search === '' &&
    decodeURIComponent(current.pathname).normalize('NFC') === decodeURIComponent(target.pathname).normalize('NFC');
}
