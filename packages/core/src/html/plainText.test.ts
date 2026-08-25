import { describe, expect, it } from 'vitest';
import { htmlToPlainText } from './plainText';

describe('htmlToPlainText', () => {
  it('keeps the words and drops the tags', () => {
    expect(htmlToPlainText('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('leaves text with no markup untouched', () => {
    expect(htmlToPlainText('just words')).toBe('just words');
  });

  it('separates what a tag separated', () => {
    // The point of replacing a tag with a space rather than nothing: `a<br>b`
    // is two words on screen and must not be counted or spoken as `ab`.
    expect(htmlToPlainText('a<br>b')).toBe('a b');
  });

  it('drops the BODY of script, style and template', () => {
    expect(
      htmlToPlainText(
        '<style>p{color:red}</style>kept<script>alert(1)</script>'
      )
    ).toBe('kept');
    expect(htmlToPlainText('<template><i>hidden</i></template>shown')).toBe(
      'shown'
    );
  });

  it('closes an opaque element case-insensitively', () => {
    expect(htmlToPlainText('<SCRIPT>x</SCRIPT>after')).toBe('after');
  });

  it('decodes the entities an author types', () => {
    expect(
      htmlToPlainText('a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;')
    ).toBe('a & b <c> "d" \'e\'');
    expect(htmlToPlainText('one&nbsp;two')).toBe('one two');
  });

  it('decodes decimal and hexadecimal references', () => {
    expect(htmlToPlainText('&#65;&#x42;&#X43;')).toBe('ABC');
    expect(htmlToPlainText('&#128077;')).toBe('\u{1f44d}');
  });

  it('leaves an unresolvable reference literal', () => {
    // Better a stray `&zwnj;` in a length count than a thrown RangeError.
    expect(htmlToPlainText('&zwnj;')).toBe('&zwnj;');
    expect(htmlToPlainText('&#0;')).toBe('&#0;');
    expect(htmlToPlainText('&#xD800;')).toBe('&#xD800;');
    expect(htmlToPlainText('&#1114112;')).toBe('&#1114112;');
  });

  it('collapses whitespace and trims', () => {
    expect(htmlToPlainText('  <p>\n  a\n\n  b  </p>  ')).toBe('a b');
  });

  it('returns an empty string for markup with no text', () => {
    expect(htmlToPlainText('<hr><br>')).toBe('');
    expect(htmlToPlainText('')).toBe('');
  });
});
