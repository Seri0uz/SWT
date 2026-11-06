// Dieses Skript läuft im Browser und verwendet dessen DOM.
export const JS_FIND_FIRST_LINK = `
const parserOutput = document.querySelector('#mw-content-text .mw-parser-output') || document.querySelector('#mw-content-text');
if (!parserOutput) return null;

const ps = parserOutput.querySelectorAll('p');
for (const p of ps) {
    if (p.closest('.infobox, .hatnote, .toc, .navbox, .thumb, .sidebar, .metadata, .ambox, table')) {
        continue;
    }
    
    let parensDepth = 0;
    
    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            for (const ch of node.textContent) {
                if (ch === '(' || ch === '[' || ch === '{') {
                    parensDepth++;
                } else if (ch === ')' || ch === ']' || ch === '}') {
                    parensDepth = Math.max(0, parensDepth - 1);
                }
            }
            return null;
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
            // Exclude footnote references, edit buttons, pronunciation audio
            if (node.matches('sup, sub, .reference, .mw-editsection, .noviewer, audio, .infobox, .hatnote, .toc, .navbox, .thumb, .sidebar, .metadata, .ambox, table')) {
                return null;
            }
            
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
                return null;
            }

            if (node.tagName.toLowerCase() === 'a') {
                const href = node.getAttribute('href') || '';
                let isWiki = false;
                try {
                    const url = new URL(href, location.href);
                    const article = decodeURIComponent(url.pathname.slice('/wiki/'.length));
                    isWiki = url.origin === location.origin && url.pathname.startsWith('/wiki/') &&
                        article.length > 0 && !article.includes(':') && !url.search && !url.hash &&
                        href.length > 0 && !href.startsWith('#');
                } catch {
                    // Ungültige oder fehlerhaft kodierte URLs sind keine Artikel.
                }
                const isItalic = Boolean(node.closest('i, em') || /^(italic|oblique)/.test(style.fontStyle));
                const text = node.textContent.trimStart();
                const beginsInParens = ['(', '[', '{'].includes(text.charAt(0));

                if (isWiki && !isItalic && parensDepth === 0 && !beginsInParens && text.trim() && node.getClientRects().length) {
                    return node;
                }
            }

            for (const child of node.childNodes) {
                const res = walk(child);
                if (res) return res;
            }
        }
        return null;
    }
    
    const found = walk(p);
    if (found) return found;
}
return null;
`;
