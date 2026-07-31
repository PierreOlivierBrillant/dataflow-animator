// IMPORTANT: import the core FIRST (it exposes the global Prism instance),
// then the grammars as side effects, respecting their dependencies
// (clike before javascript, markup before jsx, etc.).
import Prism from 'prismjs/components/prism-core.js';
import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-tsx.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-csharp.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-http.js';

import type { Highlighter } from '../types';

// In a browser, Prism highlights EVERY `<pre><code class="language-*">` of the
// host page on DOMContentLoaded. Importing this module would therefore rewrite
// code blocks the host owns and never handed to us — which breaks hydration on
// any SSR host that renders its own (a Docusaurus site emits React error #418
// on every page embedding a player). We only ever call `Prism.highlight`
// explicitly, so opt out. The auto-highlight callback re-reads this flag when
// it fires, so assigning it at module evaluation is early enough.
Prism.manual = true;

/** Common aliases -> Prism identifiers. */
const ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  cs: 'csharp',
  'c#': 'csharp',
  dotnet: 'csharp',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  html: 'markup',
  xml: 'markup',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Default syntax highlighting (Prism). Returns HTML with `<span
 * class="token …">`. Colors are SCOPED in
 * `styles/dataflow.css` (no global Prism theme is imported).
 *
 * Tolerant: if the language is unknown, returns the escaped code as is.
 */
export const highlightCode: Highlighter = (code, language) => {
  const lang = ALIASES[language?.toLowerCase()] ?? language;
  const grammar = lang ? Prism.languages[lang] : undefined;
  if (!grammar) return escapeHtml(code);
  try {
    return Prism.highlight(code, grammar, lang);
  } catch {
    return escapeHtml(code);
  }
};
