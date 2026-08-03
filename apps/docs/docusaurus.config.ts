import { themes as prismThemes } from 'prism-react-renderer';

const config = {
  title: 'DataFlow Animator',
  tagline:
    'JSON-driven data flow animations for React, Angular, custom elements — or no framework at all.',
  favicon: 'img/logo.svg',
  url: 'https://pierreolivierbrillant.github.io',
  baseUrl: '/dataflow-animator/',
  trailingSlash: true,
  organizationName: 'PierreOlivierBrillant',
  projectName: 'dataflow-animator',
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  // Native i18n: English is the source language (served at the root `/`),
  // French is a translated locale (`/fr/`). Each locale produces distinct
  // static HTML → DocSearch can index both. Browser detection (1st visit)
  // is handled by a client redirect in `src/theme/Root.tsx`.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    localeConfigs: {
      en: { label: 'English', htmlLang: 'en' },
      fr: { label: 'Français', htmlLang: 'fr' },
    },
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],
  plugins: [
    function myTailwindPlugin() {
      return {
        name: 'docusaurus-tailwindcss',
        configurePostCss(postcssOptions: { plugins: any[] }) {
          postcssOptions.plugins.push(require('@tailwindcss/postcss'));
          return postcssOptions;
        },
      };
    },
    // Allows webpack to detect changes in the lib dists when running in dev
    // (docusaurus doesn't watch node_modules by default). Two things are needed:
    //  1. watchOptions.ignored must NOT ignore the linked libs;
    //  2. snapshot.unmanagedPaths must mark them MUTABLE — webpack 5 treats
    //     node_modules as "managed" (immutable, cached by version) and will
    //     otherwise never re-read a rebuilt dist even when it is being watched.
    // The libs are workspace symlinks and webpack resolves symlinks, so we list
    // BOTH the node_modules path and the real packages/ path.
    //
    // BOTH packages are listed: since the React binding externalises the core,
    // `@dataflow-animator/core` is a module webpack resolves on its own (it is
    // also where `custom.css` gets the stylesheet from), so a core rebuild that
    // is not watched here would never reach the page.
    function watchLibPlugin() {
      const libPathRe =
        /[\\/](?:node_modules[\\/]@dataflow-animator[\\/](?:core|react)|packages[\\/](?:core|react))[\\/]/;
      return {
        name: 'watch-lib-dist',
        configureWebpack() {
          return {
            snapshot: { unmanagedPaths: [libPathRe] },
            watchOptions: {
              ignored: /node_modules\/(?!@dataflow-animator\/)/,
            },
          };
        },
      };
    },
    // The workspace libs are consumed through npm symlinks, so webpack resolves
    // them to `packages/*/dist` — a real path OUTSIDE node_modules, and being
    // outside node_modules is the ONLY thing Docusaurus' babel-loader `exclude`
    // looks at. The linked dist was therefore transpiled as if it were site
    // source, by `@babel/preset-env` in LOOSE mode, where `[...iterable]`
    // becomes `[].concat(iterable)`: correct for an array, silently wrong for a
    // Set or a Map — `[].concat(new Set([f]))` yields `[theSet]`, not `[f]`.
    // That is what crashed the player on every page holding one ("_e37 is not a
    // function": the clock's listener Set came back as a one-element array
    // holding the Set itself, and calling it threw on the first frame).
    // An npm consumer never hits this, since their copy IS in node_modules and
    // is excluded. So the fix belongs here, and it is the same fix in kind:
    // consume the built dist as-is, exactly like a published package.
    function skipBabelForLinkedLibsPlugin() {
      const linkedDistRe = /[\\/]packages[\\/](?:core|react)[\\/]dist[\\/]/;
      return {
        name: 'skip-babel-for-linked-libs',
        configureWebpack(config?: {
          module?: { rules?: unknown[] };
        }): Record<string, never> {
          type JsRule = { test?: unknown; exclude?: (p: string) => boolean };
          const rules = config?.module?.rules;
          // knip — and any static analyzer that walks the config — invokes the
          // plugin lifecycles with no real webpack config, just to discover
          // entry points. Nothing to patch then, and nothing wrong either.
          if (!Array.isArray(rules) || rules.length === 0) {
            return {};
          }
          const jsRule = rules.find(
            (rule): rule is JsRule =>
              typeof rule === 'object' &&
              rule !== null &&
              String((rule as JsRule).test) === String(/\.[jt]sx?$/i) &&
              typeof (rule as JsRule).exclude === 'function'
          );
          // Loud on drift: if Docusaurus reshapes its JS rule, a silent no-op
          // here would bring the loose-mode miscompilation back at runtime.
          if (!jsRule) {
            throw new Error(
              "skip-babel-for-linked-libs: Docusaurus' JS rule (test /\\.[jt]sx?$/i " +
                'with a function `exclude`) was not found — the babel-loose ' +
                'workaround no longer applies, re-check it against the current ' +
                'Docusaurus version.'
            );
          }
          const baseExclude = jsRule.exclude!;
          jsRule.exclude = (modulePath: string) =>
            linkedDistRe.test(modulePath) || baseExclude(modulePath);
          return {};
        },
      };
    },
  ],
  themeConfig: {
    metadata: [
      { name: 'algolia-site-verification', content: 'B7EDACFD9951C67F' },
    ],
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    image: 'img/logo.svg',
    // Labels here are the SOURCE language (English). `CustomNavbar` renders its
    // own links from the i18n dictionary; the footer keeps this config for
    // structure (order, hrefs) and re-translates each label through
    // `footer.labels` — so every label below must exist as a key there.
    navbar: {
      items: [
        { to: '/docs/intro', label: 'Documentation', position: 'left' },
        { to: '/examples', label: 'Examples', position: 'left' },
        { to: '/playground', label: 'Playground', position: 'left' },
        {
          href: 'https://github.com/PierreOlivierBrillant/dataflow-animator',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'SITE',
          items: [
            { label: 'Documentation', to: '/docs/intro' },
            { label: 'Examples', to: '/examples' },
            { label: 'Playground', to: '/playground' },
          ],
        },
        // One npm entry per published package: the suite is four packages, and
        // the footer is the only place that lists them all.
        {
          title: 'PACKAGES',
          items: [
            {
              label: '@dataflow-animator/core',
              href: 'https://www.npmjs.com/package/@dataflow-animator/core',
            },
            {
              label: '@dataflow-animator/react',
              href: 'https://www.npmjs.com/package/@dataflow-animator/react',
            },
            {
              label: '@dataflow-animator/element',
              href: 'https://www.npmjs.com/package/@dataflow-animator/element',
            },
            {
              label: '@dataflow-animator/angular',
              href: 'https://www.npmjs.com/package/@dataflow-animator/angular',
            },
          ],
        },
        {
          title: 'PROJECT',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/PierreOlivierBrillant/dataflow-animator',
            },
            {
              label: 'Changelog',
              href: 'https://github.com/PierreOlivierBrillant/dataflow-animator/blob/main/CHANGELOG.md',
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Pierre-Olivier Brillant. MIT License.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    algolia: {
      appId: 'O5PT29Z2XG',
      apiKey: '6ab54371d9c7838ec9038b1e45831c11',
      // The IDENTIFIER of the index in the Algolia dashboard, not a displayed
      // title: it kept the site's former name on purpose. Renaming it here
      // without renaming the index there points search at nothing.
      indexName: 'React Dataflow Animator documentation website',
      searchPagePath: 'search',
      contextualSearch: true,
    },
  },
};

export default config;
