import type { Messages } from './fr';

// Must reflect exactly the structure of `fr` (`Messages` type).
export const en: Messages = {
  nav: {
    documentation: 'Documentation',
    examples: 'Examples',
    playground: 'Playground',
    sources: 'Source',
    toggleMenu: 'Toggle navigation',
    languageLabel: 'Language',
    toggleTheme: 'Toggle light/dark theme',
    themeLight: 'Light',
    themeSystem: 'System',
    themeDark: 'Dark',
  },
  home: {
    pageTitle: 'Home',
    pageDescription:
      'JSON-driven data flow animations for React, Angular, custom elements — or no framework at all.',
  },
  hero: {
    titlePre: 'Your architectures, ',
    titleHighlight: 'animated',
    titlePost: ' in JSON.',
    subtitle:
      'An engine that turns a JSON specification into a deterministic, navigable animation, with one thin binding per framework. Perfect for your architecture demos, tutorials and interactive documentation.',
    ctaPlayground: 'Try it in the playground',
    ctaDocs: 'Documentation',
    targetsLabel: 'Works with',
    targetsAria: 'Choose which target to install',
  },
  showcase: {
    eyebrow: 'Demos',
    titlePre: 'Three lines of JSON.',
    titleHighlight: 'Endless animations.',
    subtitle:
      'Every scenario below is generated from the JSON spec shown. Edit the spec, and the animation updates instantly.',
    hideSpec: '▲ Hide',
    showSpec: '▼ View JSON spec',
    explore: (count: number) => `Explore the ${count} examples`,
  },
  features: {
    eyebrow: 'Features',
    titlePre: 'Everything you need, ',
    titleHighlight: 'nothing more.',
    items: [
      {
        title: 'Automatic layout',
        description:
          'Define only the lanes — the library positions each node automatically, in left-to-right, circular or top-to-bottom.',
      },
      {
        title: 'Built-in player',
        description:
          'Play, pause, restart and step-by-step navigation. Your users control the animation at their own pace.',
      },
      {
        title: 'Simple JSON spec',
        description:
          'Describe nodes, connections and actions in a single JSON object. TypeScript-first, with a complete schema for autocompletion.',
      },
      {
        title: 'Parallel actions',
        description:
          'Run several animations simultaneously with the `parallel` type. Perfect for illustrating concurrent requests or microservices.',
      },
      {
        title: 'Rich content',
        description:
          'Nodes can display syntax-highlighted code, formatted text or images, and a `subicon` badge for the tech (React, PostgreSQL, Node…). Content can change mid-animation.',
      },
      {
        title: 'No framework required',
        description:
          'One engine, three thin bindings: `<DataFlowPlayer>` in React, `<dfa-player>` in Angular, `<dataflow-player>` everywhere else. The core also mounts on its own.',
      },
    ],
  },
  cta: {
    eyebrow: 'Ready to get started?',
    titlePre: 'Your next animation, ',
    titleHighlight: 'just a JSON away.',
    subtitle:
      "Install the library, copy an example, and you'll have your first animation in under 5 minutes.",
    primary: 'Open the Playground',
    secondary: 'View on GitHub',
  },
  footer: {
    taglineLine1: 'Architecture animations',
    taglineLine2: 'driven by JSON.',
    repoAria: 'Project GitHub repository',
    labels: {
      SITE: 'SITE',
      PACKAGES: 'PACKAGES',
      PROJECT: 'PROJECT',
      Documentation: 'Documentation',
      Examples: 'Examples',
      Playground: 'Playground',
      GitHub: 'GitHub',
      Changelog: 'Changelog',
    },
  },
  intro: {
    leadPost:
      ' compiles a JSON specification into a deterministic, navigable data flow animation.',
    packagesTitle: 'One engine, four packages',
    packagesIntro:
      'The engine, the DOM renderer and the stylesheet live in the core. Each binding adds nothing but the glue its framework needs: it copies neither the engine nor the CSS.',
    packagesCols: { pkg: 'Package', api: 'API', role: 'Role' },
    packages: [
      {
        pkg: '@dataflow-animator/core',
        api: 'mountPlayer()',
        desc: 'The engine, the DOM renderer and the stylesheet. Mounts on its own, with no framework.',
      },
      {
        pkg: '@dataflow-animator/react',
        api: '<DataFlowPlayer>',
        desc: 'The React binding (18 or 19).',
      },
      {
        pkg: '@dataflow-animator/element',
        api: '<dataflow-player>',
        desc: 'The custom element: plain HTML, Vue, Svelte, Astro… and a CDN with no build step.',
      },
      {
        pkg: '@dataflow-animator/angular',
        api: '<dfa-player>',
        desc: 'The standalone Angular component (22).',
      },
    ],
    packagesOutro:
      "The stylesheet is always the core's, whichever binding you use — and it is not optional.",
    packagesLink: 'Compare the four surfaces →',
    overviewTitle: 'Overview',
    overviewIntro: 'You describe:',
    overviewItems: [
      {
        pre: '',
        strong: 'static objects',
        post: ' (the nodes: servers, clients, databases…);',
      },
      {
        pre: '',
        strong: 'dynamic objects',
        post: ' (the payloads that will move: HTTP packets, SQL queries…);',
      },
      {
        pre: 'a sequence of ',
        strong: 'actions',
        post: ' (moves, arrows, comments, loaders…).',
      },
    ],
    overviewOutro:
      'The engine places the nodes, draws the paths and plays the timeline without any manual coordinates.',
    principlesTitle: 'Principles',
    principles: [
      {
        strong: 'Time is the single source of truth.',
        rest: ' The engine compiles the spec into a pure timeline: t (ms) → visual state. Backward seeking and step-by-step navigation are trivial and deterministic.',
      },
      {
        strong: 'Automatic layout.',
        rest: ' Linear (based on direction and lane) or circular. No coordinates to provide.',
      },
      {
        strong: 'Fast rendering.',
        rest: ' A retained DOM renderer mutates the frame in place instead of re-rendering it — about 6x less script time per frame. It mounts on the client, so the diagram appears on hydration.',
      },
      {
        strong: 'Framework-agnostic.',
        rest: ' The core imports no framework. React, Angular and the custom element mount exactly the same renderer — an equality this repository checks to the pixel.',
      },
      {
        strong: 'Extensible.',
        rest: ' Node icons, tech sub-icons and syntax highlighting are registrable / replaceable.',
      },
    ],
    furtherTitle: 'Going further',
    furtherItems: [
      {
        to: '/docs/installation',
        label: 'Installation',
        desc: ' — get started in 5 lines, in your framework.',
      },
      {
        to: '/docs/reference/packages',
        label: 'Packages and bindings',
        desc: ' — React, Angular, the custom element, or the core on its own.',
      },
      {
        to: '/docs/concepts/nodes',
        label: 'Nodes',
        desc: ' — types, badges, content and visibility.',
      },
      {
        to: '/docs/concepts/packets',
        label: 'Packets',
        desc: ' — the dynamic objects that move.',
      },
      {
        to: '/docs/concepts/decor',
        label: 'Connections and zones',
        desc: ' — the permanent scenery of the stage.',
      },
      {
        to: '/docs/concepts/layout',
        label: 'Layout',
        desc: ' — how nodes are placed.',
      },
      {
        to: '/docs/concepts/timeline',
        label: 'Timeline and steps',
        desc: ' — how actions chain and persist.',
      },
      {
        to: '/docs/concepts/math',
        label: 'Math notation',
        desc: ' — inline LaTeX between $…$ in labels.',
      },
      {
        to: '/docs/reference/actions',
        label: 'Action types',
        desc: ' — move, arrow, parallel, loading, set_content, comment, highlight, set_visible, wait.',
      },
      {
        to: '/docs/reference/components',
        label: 'Components and JavaScript API',
        desc: " — <DataFlowPlayer>'s React props, icons, syntax highlighting.",
      },
      {
        to: '/docs/reference/api',
        label: 'API reference (JSON spec)',
        desc: ' — generated from the JSON Schema.',
      },
    ],
  },
  examples: {
    pageTitle: 'Examples',
    pageDescription:
      'Browse the gallery of examples: animated previews, search, and category filters.',
    gallery: 'Gallery',
    title: 'Explore the examples',
    subtitle:
      'Hover over a thumbnail to see the animation, search by keyword or filter by category. Click to open the full preview, then load the spec in the Playground.',
  },
  gallery: {
    searchPlaceholder:
      'Search an example (e.g. “encryption”, “cache”, “alice”)…',
    searchAria: 'Search an example',
    clearSearch: 'Clear search',
    allCategory: 'All',
    openLarge: 'Click to open full size',
    close: 'Close',
    openInPlayground: 'Open in the Playground',
    resetFilters: 'Reset filters',
    noResults: (query: string) => `No example matches “${query}”.`,
    categories: {
      'web-api': 'Web & API',
      realtime: 'Real-time',
      security: 'Security',
      infrastructure: 'Infrastructure',
      distributed: 'Distributed systems',
      'data-structures': 'Data structures',
      electronics: 'Electronics',
      engine: 'Engine concepts',
    },
  },
  playground: {
    pageTitle: 'Playground',
    pageDescription: 'Interactive editor to test your JSON specifications.',
    title: 'Playground',
    subtitle:
      'Edit the JSON spec on the left — the animation updates in real time.',
    format: 'Format',
    densityCompact: 'Compact',
    densityComfortable: 'Comfortable',
    densitySpacious: 'Spacious',
    theme: 'Theme',
    themeHint: "Every theme follows the site's light/dark mode.",
    themeDefault: 'Default',
    themeDots: 'Dots',
    themeBlueprint: 'Blueprint',
    themePcb: 'PCB',
    themeChalk: 'Chalk',
    themeTerminal: 'Terminal',
    themePaper: 'Graph paper',
    themeNeon: 'Neon',
    copy: 'Copy',
    loadingEditor: 'Loading editor...',
    invalidJson: 'Invalid JSON:',
    emptyState: 'Enter a valid JSON spec to see the animation.',
    // Identical to `validateSpec`'s own English defaults — passed anyway, so
    // the playground stays locale-agnostic (one code path for both languages).
    specErrors: {
      oneOf: (values: string) => `invalid value — accepted values: ${values}`,
      expected: (value: string) => `invalid value — expected: "${value}"`,
      oneOfTruncated: (values: string, rest: number) =>
        `invalid value — accepted values: ${values}, … (+${rest} more)`,
      missingField: (field: string) => `required field missing: "${field}"`,
      wrongType: (type: string) => `wrong type — expected: ${type}`,
      tooSmall: (limit: number) => `value too small — minimum: ${limit}`,
      mustBeInteger: 'must be an integer',
      mustBeMultipleOf: (factor: number) => `must be a multiple of ${factor}`,
      unknownError: 'unknown error',
      unknownId: (id: string, available: string) =>
        `unknown ID: "${id}" — available IDs: ${available}`,
      unknownIdNoList: (id: string) => `unknown ID: "${id}"`,
    },
  },
  // Identical to the core's own English defaults — passed anyway, so the
  // wrapper stays locale-agnostic (one code path for both languages).
  player: {
    restart: 'Restart from the beginning',
    play: 'Play',
    pause: 'Pause',
    prevStep: 'Previous step',
    nextStep: 'Next step',
    progressBar: 'Progress bar',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    jsonSpec: 'JSON specification',
    download: 'Download the JSON',
    copy: 'Copy',
    copied: 'Copied',
    copyToClipboard: 'Copy to clipboard',
    close: 'Close',
    closeDialog: 'Close the dialog',
  },
  apiRef: {
    property: 'Property',
    examples: 'Examples',
    linkTo: (name: string) => `Link to ${name}`,
    rootIntro: 'The root object of the specification.',
    nodeIntro:
      'A node (server, database, client…). Placed automatically based on `direction`/`lane`.',
    connectionIntro: 'Permanent arrow (scenery) between two nodes.',
    packetIntro: 'A movable packet, referenced by a `move` action.',
    actionsIntro:
      'Discriminated union on `type`. All types share the timing fields (`id`, `duration`, `wait_for`, `keep_until`, `keep_until_next`).',
  },
};
