/**
 * French dictionary = SOURCE OF TRUTH.
 *
 * The `Messages` type is derived from it (`typeof fr`), which forces the
 * English version (`en.ts`) to provide exactly the same keys / the same structure.
 *
 * Strings containing `code` between backticks are rendered as is
 * (literal text) on the home page; on the intro they are split for a
 * real `<code>` rendering.
 */
import type { PlayerLabels } from '@dataflow-animator/react';
import type { SpecErrorMessages } from '../site-content/validateSpec';

export const fr = {
  nav: {
    documentation: 'Documentation',
    examples: 'Exemples',
    playground: 'Playground',
    sources: 'Sources',
    toggleMenu: 'Ouvrir/fermer la navigation',
    languageLabel: 'Langue',
    toggleTheme: 'Basculer le thème clair/sombre',
    themeLight: 'Clair',
    themeSystem: 'Système',
    themeDark: 'Sombre',
  },
  home: {
    pageTitle: 'Accueil',
    pageDescription:
      'Animations de flux de données pilotées par JSON, pour React, Angular, les éléments personnalisés — ou sans framework.',
  },
  hero: {
    titlePre: 'Vos architectures, ',
    titleHighlight: 'animées',
    titlePost: ' en JSON.',
    subtitle:
      "Un moteur qui transforme une spécification JSON en animation déterministe et navigable, avec une liaison par framework. Idéal pour vos démonstrations d'architecture, tutoriels et documentation interactive.",
    ctaPlayground: 'Essayer dans le terrain de jeu',
    ctaDocs: 'Documentation',
    // The target names are language invariants — only the lead-in and the
    // group's accessible name are translated.
    targetsLabel: 'Fonctionne avec',
    targetsAria: 'Choisir la cible à installer',
  },
  showcase: {
    eyebrow: 'Démonstrations',
    titlePre: 'Trois lignes de JSON.',
    titleHighlight: 'Des animations infinies.',
    subtitle:
      "Chaque scénario ci-dessous est généré depuis la spec JSON affichée. Modifiez la spec, l'animation se met à jour instantanément.",
    hideSpec: '▲ Masquer',
    showSpec: '▼ Voir la spec JSON',
    explore: (count: number) => `Explorer les ${count} exemples`,
  },
  features: {
    eyebrow: 'Fonctionnalités',
    titlePre: 'Tout ce qu’il vous faut, ',
    titleHighlight: 'rien de plus.',
    items: [
      {
        title: 'Placement automatique',
        description:
          'Définissez uniquement les lanes — la librairie positionne chaque nœud automatiquement, en left-to-right, circular ou top-to-bottom.',
      },
      {
        title: 'Lecteur intégré',
        description:
          "Lecture, pause, retour au début et navigation step-by-step. Vos utilisateurs contrôlent l'animation à leur propre rythme.",
      },
      {
        title: 'Spec JSON simple',
        description:
          "Décrivez nœuds, connexions et actions dans un seul objet JSON. TypeScript first, avec un schéma complet pour l'autocomplétion.",
      },
      {
        title: 'Actions parallèles',
        description:
          'Lancez plusieurs animations simultanément avec le type `parallel`. Idéal pour illustrer des requêtes concurrentes ou microservices.',
      },
      {
        title: 'Contenu riche',
        description:
          "Les nœuds peuvent afficher du code avec coloration syntaxique, du texte formaté ou des images, et un badge `subicon` pour la techno (React, PostgreSQL, Node…). Le contenu mute en cours d'animation.",
      },
      {
        title: 'Sans framework',
        description:
          'Un moteur, trois liaisons fines : `<DataFlowPlayer>` en React, `<dfa-player>` en Angular, `<dataflow-player>` partout ailleurs. Le cœur se monte aussi tout seul.',
      },
    ],
  },
  cta: {
    eyebrow: 'Prêt à commencer ?',
    titlePre: 'Votre prochaine animation, ',
    titleHighlight: 'à portée de JSON.',
    subtitle:
      'Installez la librairie, copiez un exemple, et vous avez votre première animation en moins de 5 minutes.',
    primary: 'Ouvrir le Playground',
    secondary: 'Voir sur GitHub',
  },
  footer: {
    taglineLine1: "Animations d'architecture",
    taglineLine2: 'pilotées par JSON.',
    repoAria: 'Dépôt GitHub du projet',
    // Footer labels/columns come from the Docusaurus config, in the SOURCE
    // language (English). We translate them again on display via this table,
    // keeping the config as the source for structure (hrefs/order). A label
    // with no entry here is displayed as-is — which is what the package names
    // want, since they are invariants.
    labels: {
      SITE: 'SITE',
      PACKAGES: 'PAQUETS',
      PROJECT: 'PROJET',
      Documentation: 'Documentation',
      Examples: 'Exemples',
      Playground: 'Playground',
      GitHub: 'GitHub',
      Changelog: 'Notes de version',
    } as Record<string, string>,
  },
  // Headings of the docs chrome (sidebar, table of contents). They are drawn by
  // `::before` pseudo-elements in custom.css, because the Docusaurus components
  // that own those boxes cannot be wrapped without ejecting them; `Root.tsx`
  // publishes these strings as CSS custom properties so the dictionary stays the
  // single translation surface.
  docsChrome: {
    sidebarTitle: 'Navigation',
    tocTitle: 'Sur cette page',
  },
  intro: {
    leadPost:
      ' compile une spécification JSON en animation déterministe et navigable de flux de données.',
    packagesTitle: 'Un moteur, quatre paquets',
    packagesIntro:
      "Le moteur, le rendu DOM et la feuille de style vivent dans le cœur. Chaque liaison n'ajoute que la colle propre à son framework : elle ne recopie ni le moteur ni la CSS.",
    packagesCols: { pkg: 'Paquet', api: 'API', role: 'Rôle' },
    packages: [
      {
        pkg: '@dataflow-animator/core',
        api: 'mountPlayer()',
        desc: 'Le moteur, le rendu DOM et la feuille de style. Se monte seul, sans framework.',
      },
      {
        pkg: '@dataflow-animator/react',
        api: '<DataFlowPlayer>',
        desc: 'La liaison React (18 ou 19).',
      },
      {
        pkg: '@dataflow-animator/element',
        api: '<dataflow-player>',
        desc: "L'élément personnalisé : HTML brut, Vue, Svelte, Astro… et un CDN sans build.",
      },
      {
        pkg: '@dataflow-animator/angular',
        api: '<dfa-player>',
        desc: 'Le composant standalone Angular (22).',
      },
    ],
    packagesOutro:
      'La feuille de style est toujours celle du cœur, quelle que soit la liaison — et elle est obligatoire.',
    packagesLink: 'Comparer les quatre surfaces →',
    overviewTitle: 'Aperçu',
    overviewIntro: 'Vous décrivez :',
    overviewItems: [
      {
        pre: 'des ',
        strong: 'objets statiques',
        post: ' (les nœuds : serveurs, clients, bases de données…) ;',
      },
      {
        pre: 'des ',
        strong: 'objets dynamiques',
        post: ' (les payloads qui se déplaceront : paquets HTTP, requêtes SQL…) ;',
      },
      {
        pre: "une suite d'",
        strong: 'actions',
        post: ' (déplacements, flèches, commentaires, chargements…).',
      },
    ],
    overviewOutro:
      "Le moteur place les nœuds, trace les trajets et déroule la timeline sans qu'aucune coordonnée manuelle ne soit nécessaire.",
    principlesTitle: 'Principes',
    principles: [
      {
        strong: "Le temps est l'unique source de vérité.",
        rest: ' Le moteur compile la spec en une chronologie pure : t (ms) → état visuel. Le seek arrière et la navigation par étapes sont triviaux et déterministes.',
      },
      {
        strong: 'Disposition automatique.',
        rest: ' Linéaire (selon direction et lane) ou circular. Aucune coordonnée à fournir.',
      },
      {
        strong: 'Rendu rapide.',
        rest: ' Un moteur de rendu DOM en mode retenu mute la frame sur place au lieu de la re-rendre — environ 6× moins de temps de script par frame. Il se monte côté client : le diagramme apparaît à l’hydratation.',
      },
      {
        strong: 'Indépendant du framework.',
        rest: ' Le cœur n’importe aucun framework. React, Angular et l’élément personnalisé montent exactement le même rendu — l’égalité est vérifiée au pixel près dans le dépôt.',
      },
      {
        strong: 'Extensible.',
        rest: ' Icônes de nœuds, sous-icônes technos et coloration syntaxique sont enregistrables / remplaçables.',
      },
    ],
    furtherTitle: 'Pour aller plus loin',
    furtherItems: [
      {
        to: '/docs/installation',
        label: 'Installation',
        desc: ' — démarrer en 5 lignes, dans votre framework.',
      },
      {
        to: '/docs/reference/packages',
        label: 'Paquets et liaisons',
        desc: ' — React, Angular, élément personnalisé, ou le cœur seul.',
      },
      {
        to: '/docs/concepts/nodes',
        label: 'Nœuds',
        desc: ' — types, badges, contenu et visibilité.',
      },
      {
        to: '/docs/concepts/packets',
        label: 'Paquets',
        desc: ' — les objets dynamiques qui se déplacent.',
      },
      {
        to: '/docs/concepts/decor',
        label: 'Connexions et zones',
        desc: ' — le décor permanent de la scène.',
      },
      {
        to: '/docs/concepts/layout',
        label: 'Disposition',
        desc: ' — comment les nœuds sont placés.',
      },
      {
        to: '/docs/concepts/timeline',
        label: 'Timeline et étapes',
        desc: ' — comment les actions se chaînent et persistent.',
      },
      {
        to: '/docs/concepts/math',
        label: 'Notation mathématique',
        desc: ' — du LaTeX inline entre $…$ dans les libellés.',
      },
      {
        to: '/docs/reference/actions',
        label: "Types d'actions",
        desc: ' — move, arrow, parallel, loading, set_content, comment, highlight, set_visible, wait.',
      },
      {
        to: '/docs/reference/components',
        label: 'Composants et API JavaScript',
        desc: ' — props React de <DataFlowPlayer>, icônes, coloration syntaxique.',
      },
      {
        to: '/docs/reference/api',
        label: 'Référence API (spec JSON)',
        desc: ' — générée depuis le JSON Schema.',
      },
    ],
  },
  examples: {
    pageTitle: 'Exemples',
    pageDescription:
      "Parcourez la galerie d'exemples : aperçus animés, recherche et filtres par catégorie.",
    gallery: 'Galerie',
    title: 'Explorez les exemples',
    subtitle:
      "Survolez une vignette pour voir l'animation, recherchez par mot-clé ou filtrez par catégorie. Cliquez pour ouvrir l'aperçu en grand, puis chargez la spec dans le Playground.",
  },
  gallery: {
    searchPlaceholder:
      'Rechercher un exemple (ex. « chiffrement », « cache », « alice »)…',
    searchAria: 'Rechercher un exemple',
    clearSearch: 'Effacer la recherche',
    allCategory: 'Toutes',
    openLarge: 'Cliquez pour ouvrir en grand',
    close: 'Fermer',
    openInPlayground: 'Ouvrir dans le Playground',
    resetFilters: 'Réinitialiser les filtres',
    noResults: (query: string) => `Aucun exemple ne correspond à « ${query} ».`,
    categories: {
      'web-api': 'Web & API',
      realtime: 'Temps réel',
      security: 'Sécurité',
      infrastructure: 'Infrastructure',
      distributed: 'Systèmes distribués',
      'data-structures': 'Structures de données',
      electronics: 'Électronique',
      engine: 'Concepts moteur',
    },
  },
  playground: {
    pageTitle: 'Playground',
    pageDescription: 'Éditeur interactif pour tester vos spécifications JSON.',
    title: 'Playground',
    subtitle:
      "Éditez la spec JSON à gauche — l'animation se met à jour en temps réel.",
    format: 'Formater',
    densityCompact: 'Compact',
    densityComfortable: 'Confortable',
    densitySpacious: 'Spacieux',
    theme: 'Thème',
    themeHint: 'Chaque thème suit le mode clair/sombre du site.',
    themeDefault: 'Par défaut',
    themeDots: 'Pointillés',
    themeBlueprint: 'Blueprint',
    themePcb: 'PCB',
    themeChalk: 'Craie',
    themeTerminal: 'Terminal',
    themePaper: 'Papier quadrillé',
    themeNeon: 'Néon',
    copy: 'Copier',
    loadingEditor: "Chargement de l'éditeur…",
    invalidJson: 'JSON invalide :',
    emptyState: "Entrez une spec JSON valide pour voir l'animation.",
    // The playground's schema errors. `validateSpec` holds the English
    // defaults and takes these as overrides, key by key — same contract as the
    // player's `labels`, and for the same reason: both locales render the same
    // component.
    specErrors: {
      oneOf: (values: string) =>
        `valeur invalide — valeurs acceptées : ${values}`,
      expected: (value: string) => `valeur invalide — attendu : "${value}"`,
      oneOfTruncated: (values: string, rest: number) =>
        `valeur invalide — valeurs acceptées : ${values}, … (+${rest} autres)`,
      missingField: (field: string) =>
        `champ obligatoire manquant : "${field}"`,
      wrongType: (type: string) => `type incorrect — attendu : ${type}`,
      tooSmall: (limit: number) => `valeur trop petite — minimum : ${limit}`,
      mustBeInteger: 'doit être un entier',
      mustBeMultipleOf: (factor: number) =>
        `doit être un multiple de ${factor}`,
      unknownError: 'erreur inconnue',
      unknownId: (id: string, available: string) =>
        `ID inconnu : "${id}" — IDs disponibles : ${available}`,
      unknownIdNoList: (id: string) => `ID inconnu : "${id}"`,
    } satisfies SpecErrorMessages,
  },
  // The player chrome, injected into every <DataFlowPlayer> the site renders
  // (see src/components/DataFlowPlayer.tsx). `satisfies` keeps the keys in step
  // with the library's own PlayerLabels. The French strings are the original
  // French chrome's, verbatim.
  player: {
    restart: 'Recommencer depuis le début',
    play: 'Lecture',
    pause: 'Pause',
    prevStep: 'Étape précédente',
    nextStep: 'Étape suivante',
    progressBar: 'Barre de progression',
    fullscreen: 'Plein écran',
    exitFullscreen: 'Quitter le plein écran',
    jsonSpec: 'Spécification JSON',
    download: 'Télécharger le JSON',
    copy: 'Copier',
    copied: 'Copié',
    copyToClipboard: 'Copier dans le presse-papier',
    close: 'Fermer',
    closeDialog: 'Fermer la fenêtre',
    loading: 'Chargement…',
  } satisfies PlayerLabels,
  apiRef: {
    property: 'Propriété',
    examples: 'Exemples',
    linkTo: (name: string) => `Lien vers ${name}`,
    rootIntro: "L'objet racine de la spécification.",
    nodeIntro:
      'Un nœud (serveur, base, client…). Placé automatiquement selon `direction`/`lane`.',
    connectionIntro: 'Flèche permanente (décor) entre deux nœuds.',
    packetIntro: 'Un paquet déplaçable, référencé par une action `move`.',
    actionsIntro:
      'Union discriminée sur `type`. Tous les types partagent les champs de timing (`id`, `duration`, `wait_for`, `keep_until`, `keep_until_next`).',
  },
};

export type Messages = typeof fr;
