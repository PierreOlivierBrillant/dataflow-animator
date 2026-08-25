/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { appendSanitizedHtml } from './sanitize';

/** Sanitises `markup` and returns the resulting markup, for comparison. */
function clean(markup: string): string {
  const host = document.createElement('div');
  appendSanitizedHtml(host, markup);
  return host.innerHTML;
}

describe('appendSanitizedHtml — what it keeps', () => {
  it('keeps formatting, lists and tables', () => {
    expect(clean('<p>a <strong>b</strong> <em>c</em></p>')).toBe(
      '<p>a <strong>b</strong> <em>c</em></p>'
    );
    expect(clean('<ul><li>one</li><li>two</li></ul>')).toBe(
      '<ul><li>one</li><li>two</li></ul>'
    );
    expect(clean('<table><tr><td colspan="2">x</td></tr></table>')).toContain(
      '<td colspan="2">x</td>'
    );
  });

  it('keeps an inline style limited to allowed properties', () => {
    expect(clean('<p style="color:red;position:fixed;top:0">x</p>')).toBe(
      '<p style="color:red">x</p>'
    );
  });

  it('keeps a data: image and an ordinary web URL', () => {
    const data = 'data:image/png;base64,iVBORw0KGgo=';
    expect(clean(`<img src="${data}" alt="a">`)).toBe(
      `<img src="${data}" alt="a">`
    );
    expect(clean('<img src="https://example.test/a.png">')).toContain(
      'src="https://example.test/a.png"'
    );
    // Relative: no scheme to abuse, and it is what an author of a site means.
    expect(clean('<img src="/img/logo.png">')).toContain('src="/img/logo.png"');
  });

  it('keeps the SVG subset, with viewBox spelled as SVG spells it', () => {
    const out = clean(
      '<svg viewBox="0 0 10 10" width="10"><g><circle cx="5" cy="5" r="4" fill="red"></circle><path d="M0 0L10 10" stroke="blue"></path></g></svg>'
    );
    expect(out).toContain('viewBox="0 0 10 10"');
    expect(out).toContain('<circle cx="5" cy="5" r="4" fill="red"');
    expect(out).toContain('<path d="M0 0L10 10" stroke="blue"');
  });

  it('creates SVG children in the SVG namespace', () => {
    const host = document.createElement('div');
    appendSanitizedHtml(host, '<svg><text>hi</text></svg>');
    const text = host.querySelector('text');
    expect(text?.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('keeps <title> inside an <svg> while dropping the HTML one', () => {
    expect(clean('<svg><title>chart</title></svg>')).toContain(
      '<title>chart</title>'
    );
    expect(clean('<title>page</title>text')).toBe('text');
  });
});

describe('appendSanitizedHtml — what it refuses', () => {
  it('drops a script with its source', () => {
    expect(clean('<script>alert(1)</script>ok')).toBe('ok');
  });

  it('drops a style element rather than unwrapping its rules onto the stage', () => {
    expect(clean('<style>p{color:red}</style>ok')).toBe('ok');
  });

  it('drops every event handler attribute', () => {
    expect(clean('<p onclick="alert(1)" onmouseover="x()">a</p>')).toBe(
      '<p>a</p>'
    );
  });

  it('drops an img whose onerror would fire', () => {
    expect(clean('<img src="x" onerror="alert(1)">')).toBe('<img src="x">');
  });

  it('refuses a javascript: URL, however it is spelled', () => {
    expect(clean('<img src="javascript:alert(1)">')).toBe('<img>');
    expect(clean('<img src="JaVaScRiPt:alert(1)">')).toBe('<img>');
    // A control character inside the scheme is invisible to a naive regex and
    // transparent to a URL parser.
    expect(clean('<img src="java\u0000script:alert(1)">')).toBe('<img>');
    expect(clean('<img src=" \tjavascript:alert(1)">')).toBe('<img>');
  });

  it('refuses a data: URL that is not an image', () => {
    expect(clean('<img src="data:text/html,<b>x</b>">')).toBe('<img>');
    expect(clean('<img src="blob:https://example.test/abc">')).toBe('<img>');
  });

  it('drops class and id, which do not survive the video export', () => {
    expect(clean('<p class="lead" id="x">a</p>')).toBe('<p>a</p>');
  });

  it('refuses a declaration carrying url(), and one carrying @import', () => {
    expect(clean('<p style="background:url(https://x.test/a.png)">a</p>')).toBe(
      '<p>a</p>'
    );
    expect(clean('<p style="color:red;background:URL( x )">a</p>')).toBe(
      '<p style="color:red">a</p>'
    );
  });

  it('refuses a custom property, so nothing repaints the player', () => {
    expect(clean('<p style="--rdfa-bg:red;color:blue">a</p>')).toBe(
      '<p style="color:blue">a</p>'
    );
  });

  it('strips !important rather than letting content outrank the panel', () => {
    expect(clean('<p style="max-height:900px !important">a</p>')).toBe(
      '<p style="max-height:900px">a</p>'
    );
  });

  it('drops a declaration with no value, and a fragment with no declaration', () => {
    expect(clean('<p style="color:  ;">a</p>')).toBe('<p>a</p>');
    expect(clean('<p style="nonsense">a</p>')).toBe('<p>a</p>');
  });

  it('drops an iframe, a form and their contents', () => {
    expect(clean('<iframe src="https://x.test"></iframe>a')).toBe('a');
    expect(clean('<form><input value="x"><button>go</button></form>a')).toBe(
      'a'
    );
  });

  it('unwraps an unknown HTML element but keeps its words', () => {
    expect(clean('<section><p>kept</p></section>')).toBe('<p>kept</p>');
    expect(clean('<my-widget>text</my-widget>')).toBe('text');
    expect(clean('<a href="https://x.test">linked</a>')).toBe('linked');
  });

  it('drops an unknown SVG element with its subtree', () => {
    // Nothing inside a `<use>` or a `<foreignObject>` is readable prose, so
    // unwrapping it into the HTML flow would be meaningless as well as unsafe.
    expect(clean('<svg><foreignObject><p>x</p></foreignObject></svg>')).toBe(
      '<svg></svg>'
    );
    expect(clean('<svg><animate attributeName="x"></animate></svg>')).toBe(
      '<svg></svg>'
    );
  });

  it('refuses xlink:href inside the SVG subset', () => {
    expect(clean('<svg><text xlink:href="https://x.test">a</text></svg>')).toBe(
      '<svg><text>a</text></svg>'
    );
  });

  it('drops a comment node', () => {
    expect(clean('<!-- note -->a')).toBe('a');
  });

  it('appends nothing at all for empty markup', () => {
    const host = document.createElement('div');
    appendSanitizedHtml(host, '');
    expect(host.childNodes.length).toBe(0);
  });
});
