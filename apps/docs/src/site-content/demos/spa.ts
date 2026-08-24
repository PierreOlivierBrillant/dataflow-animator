import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// The two payloads the web server returns are source code, not prose: they stay
// identical in both locales and are highlighted (`html`, `javascript`) so the
// contrast with the API's `json` response is visible at a glance.
const HTML_BODY = '<div id="root"></div>\n<script src="/app.js"></script>';
const JS_BODY =
  'fetch("/api/products")\n  .then(r => r.json())\n  .then(render);';

const strings = {
  en: {
    browser: 'Browser',
    web: 'Web Server',
    db: 'DB',
    rowsHeader: '3 rows',
    colName: 'name',
    products: ['Keyboard', 'Mouse', 'Monitor'],
    jsonBody:
      '[\n  { "id": 1, "name": "Keyboard" },\n  { "id": 2, "name": "Mouse" },\n  { "id": 3, "name": "Monitor" }\n]',
    pageUrl: 'my.app/products',
    shellLoaded: '📄 index.html rendered — <div id="root"> still empty',
    waitingData: '⚛️ SPA running · ⏳ loading… ▭▭▭▭▭ ▭▭▭',
    renderValue: '✅ 3 products: Keyboard · Mouse · Monitor',
    comment1: '1. The browser asks the web server for the page',
    comment2: '2. The shell is displayed but empty: the script calls the API',
    comment3: '3. The JSON becomes DOM: the products are displayed',
  },
  fr: {
    browser: 'Navigateur',
    web: 'Serveur web',
    db: 'BD',
    rowsHeader: '3 lignes',
    colName: 'nom',
    products: ['Clavier', 'Souris', 'Écran'],
    jsonBody:
      '[\n  { "id": 1, "name": "Clavier" },\n  { "id": 2, "name": "Souris" },\n  { "id": 3, "name": "Écran" }\n]',
    pageUrl: 'mon.app/produits',
    shellLoaded: '📄 index.html rendu — <div id="root"> encore vide',
    waitingData: '⚛️ SPA démarrée · ⏳ chargement… ▭▭▭▭▭ ▭▭▭',
    renderValue: '✅ 3 produits : Clavier · Souris · Écran',
    comment1: '1. Le navigateur demande la page au serveur web',
    comment2: "2. La coquille est affichée mais vide : le script appelle l'API",
    comment3: '3. Le JSON devient du DOM : les produits sont affichés',
  },
};

export const spa = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      {
        id: 'browser',
        type: 'laptop',
        text: s.browser,
        icon: 'chrome',
        lane: 1,
      },
      {
        id: 'web',
        type: 'server',
        text: s.web,
        icon: 'nginx',
        lane: 2,
      },
      {
        id: 'api',
        type: 'server',
        text: 'Web API',
        icon: 'dotnet',
        lane: 2,
      },
      {
        id: 'db',
        type: 'database',
        text: s.db,
        icon: 'postgres',
        align_with: 'api',
        lane: 3,
      },
    ],
    packets: [
      {
        id: 'getindex',
        kind: 'http_packet',
        packet_content: { header: 'GET /' },
      },
      {
        id: 'html',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK\nContent-Type: text/html',
          body: { type: 'text', value: HTML_BODY, language: 'html' },
        },
      },
      {
        id: 'getjs',
        kind: 'http_packet',
        packet_content: { header: 'GET /app.js' },
      },
      {
        id: 'js',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK\nContent-Type: application/javascript',
          body: { type: 'text', value: JS_BODY, language: 'javascript' },
        },
      },
      {
        id: 'apireq',
        kind: 'http_packet',
        packet_content: {
          header: 'GET /api/products\nAccept: application/json',
        },
      },
      {
        id: 'sql',
        kind: 'sql_request',
        request_content: 'SELECT id, name FROM products',
      },
      {
        id: 'rows',
        kind: 'sql_response',
        response_content: {
          header: s.rowsHeader,
          body: {
            type: 'table',
            columns: ['id', s.colName],
            rows_data: s.products.map((name, i) => [i + 1, name]),
          },
        },
      },
      {
        id: 'apires',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK\nContent-Type: application/json',
          body: { type: 'text', value: s.jsonBody, language: 'json' },
        },
      },
    ],
    connections: [
      { from: 'browser', to: 'web', style: 'dotted' },
      { from: 'browser', to: 'api', style: 'dotted' },
      { from: 'api', to: 'db', style: 'dotted' },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'browser',
        text: s.comment1,
      },
      {
        type: 'parallel',
        actions: [
          { type: 'move', object: 'getindex', from: 'browser', to: 'web' },
          { type: 'loading', object: 'browser', keep_until: 'shell' },
        ],
      },
      {
        type: 'move',
        object: 'html',
        from: 'web',
        to: 'browser',
      },
      // The shell is rendered but inert: the page exists, the data does not.
      {
        type: 'set_content',
        id: 'shell',
        object: 'browser',
        content: {
          type: 'text',
          url: s.pageUrl,
          value: s.shellLoaded,
        },
        keep_until: 'waiting',
      },
      {
        type: 'move',
        object: 'getjs',
        from: 'browser',
        to: 'web',
      },
      {
        type: 'move',
        object: 'js',
        from: 'web',
        to: 'browser',
      },
      {
        type: 'comment',
        object: 'browser',
        text: s.comment2,
      },
      {
        type: 'set_content',
        id: 'waiting',
        object: 'browser',
        content: {
          type: 'text',
          url: s.pageUrl,
          value: s.waitingData,
        },
        keep_until: 'render',
      },
      {
        type: 'move',
        object: 'apireq',
        from: 'browser',
        to: 'api',
      },
      { type: 'loading', object: 'api', duration: 400 },
      {
        type: 'move',
        object: 'sql',
        from: 'api',
        to: 'db',
      },
      { type: 'loading', id: 'dbwork', object: 'db', duration: 600 },
      {
        type: 'move',
        object: 'rows',
        from: 'db',
        to: 'api',
        wait_for: 'dbwork',
      },
      {
        type: 'move',
        object: 'apires',
        from: 'api',
        to: 'browser',
      },
      {
        type: 'parallel',
        actions: [
          {
            type: 'set_content',
            id: 'render',
            object: 'browser',
            keep_until_end: true,
            content: {
              type: 'text',
              url: s.pageUrl,
              value: s.renderValue,
            },
          },
          {
            type: 'comment',
            object: 'browser',
            text: s.comment3,
            keep_until_end: true,
          },
        ],
      },
      { type: 'wait', delay_ms: 1000 },
    ],
  };
};
