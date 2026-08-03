import { describe, expect, it } from 'vitest';
import Prism from 'prismjs/components/prism-core.js';
import { escapeHtml, highlightCode } from './highlight';

describe('Prism auto-highlight opt-out', () => {
  // Without this flag Prism rewrites every `<pre><code class="language-*">` of
  // the HOST page on DOMContentLoaded, which breaks hydration on SSR hosts.
  it('leaves the host page code blocks alone', () => {
    expect(Prism.manual).toBe(true);
  });
});

describe('escapeHtml', () => {
  it('escapes &, < and > in the right order', () => {
    expect(escapeHtml('& < >')).toBe('&amp; &lt; &gt;');
  });

  it('empty string → empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('string without special characters → identity', () => {
    const s = 'hello world 123';
    expect(escapeHtml(s)).toBe(s);
  });
});

describe('highlightCode', () => {
  it('recognized javascript language: output contains <span class="token …">', () => {
    const output = highlightCode('const x = 1;', 'javascript');
    expect(output).toMatch(/<span class="token /);
  });

  it('js alias: produces the same result as javascript', () => {
    const code = 'const x = 1;';
    expect(highlightCode(code, 'js')).toBe(highlightCode(code, 'javascript'));
  });

  it('dotnet alias (→ csharp): tokenized output', () => {
    const output = highlightCode('int x = 1;', 'dotnet');
    expect(output).toMatch(/<span class="token /);
  });

  it('html alias (→ markup): tokenized output', () => {
    const output = highlightCode('<div>hello</div>', 'html');
    expect(output).toMatch(/<span class="token /);
  });

  it('unrecognized language: falls back to escapeHtml(code)', () => {
    const code = 'some code';
    expect(highlightCode(code, 'inconnu_xyz')).toBe(escapeHtml(code));
  });

  it('undefined or empty-string language: falls back to escapeHtml(code)', () => {
    const code = 'some code';
    expect(highlightCode(code, '')).toBe(escapeHtml(code));
    expect(
      (highlightCode as (code: string, language: unknown) => string)(
        code,
        undefined
      )
    ).toBe(escapeHtml(code));
  });

  it('code containing < and &: these characters are escaped in the output', () => {
    const code = 'a < b && c';
    const output = highlightCode(code, 'inconnu_xyz');
    expect(output).toContain('&lt;');
    expect(output).toContain('&amp;');
  });

  it('empty code: returns empty string', () => {
    expect(highlightCode('', 'javascript')).toBe('');
  });
});
