# Search indexing (Algolia DocSearch)

The docs site search is **Algolia DocSearch** (configured in
`apps/docs/docusaurus.config.ts`, `themeConfig.algolia`). What ends up in the
index is decided by the **crawler `recordExtractor`**, which lives in the
**Algolia Crawler dashboard**, not in this repository. This file is the
source-of-truth reference for that config: when you change indexing behavior,
update the dashboard _and_ this file in the same change.

## What we index, and why

| Page            | Indexing rule                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| `/docs/**`      | Default DocSearch extraction (headings → records).                                                             |
| `/playground/`  | **One record per example**, deep-linked to `/playground?demo=<id>`, with the example title, description, tags. |
| `/examples/`    | **The page only** — its example tiles are _not_ indexed individually (they would duplicate the playground).    |
| everything else | Default DocSearch extraction.                                                                                  |

Rationale: examples are the most searched-for content, but both `/examples`
(the gallery) and `/playground` render the same 26 demos. We index them **once**,
from the playground, so a search result lands directly on the runnable example
(`/playground?demo=<id>`, read on mount by `playground.tsx`). `/examples` stays
findable as a page but does not produce 26 duplicate tile records.

## How the playground feeds the crawler

The playground page embeds a localized, structured index of every example in its
**static HTML** (so the crawler reads it without executing JavaScript):

```html
<script type="application/json" id="rdfa-search-index">
  [{ "id": "clientServer", "title": "...", "description": "...", "tags": ["..."] }, ...]
</script>
```

It is rendered by `apps/docs/src/pages/playground.tsx` from the `demos` table,
localized with `pickLocale(..., locale)` — so the English build (`/playground/`)
embeds English strings and the French build (`/fr/playground/`) embeds French
ones. Each locale is a distinct URL, so DocSearch indexes both.

> If you add/rename/remove a demo, nothing else is needed here: the index is
> generated from `demos`. Just re-run the crawler.

## Contextual search (i18n)

The site uses `contextualSearch: true`, so the front-end filters results by
`language:<locale>` and `docusaurus_tag:default` (see
`@docusaurus/theme-search-algolia` → `useAlgoliaContextualFacetFilters`). The
default extractor reads these from the page's `<meta name="docsearch:language">`
and `<meta name="docsearch:docusaurus_tag">`. **Custom records must set the same
facets**, otherwise they are filtered out and never appear — the snippet below
copies them from the page meta.

## Crawler `recordExtractor` (paste into the Algolia dashboard)

Merge the two branches below into your existing action — do not replace it
wholesale, or you would drop your current `recordProps` and any post-processing
(e.g. forcing `record.language`). The example below keeps a shared language fix
(`withLang`) applied to every `helpers.docsearch` result and adds the two
special-case branches before your default extraction.

```js
recordExtractor: ({ $, url, helpers }) => {
  // Read the locale from the generated page; apply it to every record so
  // contextual search (`language:<locale>`) matches. Keep this if you already
  // post-process `record.language`.
  const pageLang =
    $('meta[name="docsearch:language"]').attr('content') ||
    $('html').attr('lang') ||
    'en';
  const tag =
    $('meta[name="docsearch:docusaurus_tag"]').attr('content') || 'default';

  const withLang = (records) =>
    records.map((record) => {
      record.language = pageLang;
      return record;
    });

  const pathname = url.pathname; // e.g. "/dataflow-animator/fr/playground/"

  // ── /playground → one rich record per example (deep-linked ?demo=<id>) ────
  if (/\/playground\/?$/.test(pathname)) {
    let examples = [];
    try {
      // @ts-ignore — crawler's cheerio types mistype .html() on Cheerio<Element>
      examples = JSON.parse($('#rdfa-search-index').first().html() || '[]');
    } catch (e) {
      examples = [];
    }
    const base = url.href.split(/[?#]/)[0]; // strip any query/hash
    // @ts-ignore — crawler's cheerio types mistype .text() on Cheerio<Element>
    const lvl0 = ($('h1').first().text() || 'Playground').trim();

    return examples.map((ex) => ({
      objectID: `${pageLang}-playground-${ex.id}`,
      url: `${base}?demo=${ex.id}`,
      url_without_anchor: base,
      type: 'lvl1',
      hierarchy: {
        lvl0,
        lvl1: ex.title,
        lvl2: null,
        lvl3: null,
        lvl4: null,
        lvl5: null,
        lvl6: null,
      },
      content: [ex.description, (ex.tags || []).join(', ')]
        .filter(Boolean)
        .join(' — '),
      // Facets — required for contextual search to surface these records.
      language: pageLang,
      docusaurus_tag: tag,
      weight: { pageRank: 0, level: 70, position: 0 },
    }));
  }

  // ── /examples → page record only. The 26 tiles are <h3>, so DROP lvl2..lvl6
  //    (your default selectors include `h3`, which would index every tile). ──
  if (/\/examples\/?$/.test(pathname)) {
    return withLang(
      helpers.docsearch({
        recordProps: {
          lvl0: { selectors: '', defaultValue: 'Examples' },
          lvl1: ['main h1', 'h1', 'head > title'],
          content: ['main p, main li', 'p, li'],
        },
        aggregateContent: true,
        recordVersion: 'v3',
      })
    );
  }

  // ── Everything else → the current default extraction, unchanged ──────────
  return withLang(
    helpers.docsearch({
      recordProps: {
        lvl1: ['header h1', 'article h1', 'main h1', 'h1', 'head > title'],
        content: ['article p, article li', 'main p, main li', 'p, li'],
        lvl0: { selectors: '', defaultValue: 'Documentation' },
        lvl2: ['article h2', 'main h2', 'h2'],
        lvl3: ['article h3', 'main h3', 'h3'],
        lvl4: ['article h4', 'main h4', 'h4'],
        lvl5: ['article h5', 'main h5', 'h5'],
        lvl6: ['article h6', 'main h6', 'h6'],
      },
      aggregateContent: true,
      recordVersion: 'v3',
    })
  );
};
```

Notes:

- Add `url` to the destructured params if your current extractor omits it.
- The crawler's bundled cheerio types reject `.html()`/`.text()` on a
  `Cheerio<Element>` (they want `Cheerio<Node>`). Silence it with `// @ts-ignore`
  on the line immediately above each call (it is a comment — no runtime effect,
  and it works whether the editor type-checks as JS or TS). `.attr()` is
  unaffected. For the whole config, `// @ts-nocheck` on the file's first line
  also works.
- `objectID` is prefixed with the locale so the EN and FR variants of the same
  example are distinct records in the shared index.
- `language` / `docusaurus_tag` must already be in the index's
  `attributesForFaceting` (they are, since the docs records use them).
- The playground records are hand-built (not via `helpers.docsearch`). Before a
  full reindex, run `…/playground/` and `…/fr/playground/` through the crawler's
  URL tester and confirm **26 records each**, with the right `?demo=<id>` URL.
- After saving the config, **trigger a reindex** (or wait for the next scheduled
  crawl) for the changes to take effect.
