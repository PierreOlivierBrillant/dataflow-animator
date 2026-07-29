import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    browser: 'Browser',
    web: 'Web Server',
    db: 'DB',
    apiresBody: '[ 12 products ]',
    comment1: '1. Application loading',
    spaLoaded: '✅ SPA loaded (React) — ready to call API',
    comment2: '2. The SPA calls the Web API',
    renderValue: '📦 12 products displayed',
    comment3: '3. Data rendering',
  },
  fr: {
    browser: 'Navigateur',
    web: 'Serveur web',
    db: 'BD',
    apiresBody: '[ 12 produits ]',
    comment1: "1. Chargement de l'application",
    spaLoaded: "✅ SPA chargée (React) — prête à appeler l'API",
    comment2: '2. La SPA appelle le Web API',
    renderValue: '📦 12 produits affichés',
    comment3: '3. Rendu des données',
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
        id: 'bundle',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK',
          body: { type: 'text', value: 'index.html + app.js' },
        },
      },
      {
        id: 'apireq',
        kind: 'http_packet',
        packet_content: { header: 'GET /api/products' },
      },
      {
        id: 'sql',
        kind: 'sql_request',
        request_content: 'SELECT * FROM products',
      },
      { id: 'rows', kind: 'sql_response', response_content: { rows: 12 } },
      {
        id: 'apires',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK',
          body: { type: 'text', value: s.apiresBody },
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
        duration: 500,
      },
      {
        type: 'move',
        object: 'getindex',
        from: 'browser',
        to: 'web',
        duration: 700,
      },
      {
        type: 'move',
        object: 'bundle',
        from: 'web',
        to: 'browser',
        duration: 700,
      },
      {
        type: 'set_content',
        object: 'browser',
        content: {
          type: 'text',
          url: 'https://mon.app',
          value: s.spaLoaded,
        },
        keep_until: 'render',
      },
      {
        type: 'comment',
        object: 'browser',
        text: s.comment2,
        duration: 500,
      },
      {
        type: 'move',
        object: 'apireq',
        from: 'browser',
        to: 'api',
        duration: 800,
      },
      { type: 'loading', object: 'api', duration: 400 },
      {
        type: 'move',
        object: 'sql',
        from: 'api',
        to: 'db',
        duration: 600,
      },
      { type: 'loading', id: 'dbwork', object: 'db', duration: 600 },
      {
        type: 'move',
        object: 'rows',
        from: 'db',
        to: 'api',
        duration: 600,
        wait_for: 'dbwork',
      },
      {
        type: 'move',
        object: 'apires',
        from: 'api',
        to: 'browser',
        duration: 800,
      },
      {
        type: 'set_content',
        id: 'render',
        object: 'browser',
        content: {
          type: 'text',
          url: 'https://mon.app/produits',
          value: s.renderValue,
        },
      },
      {
        type: 'comment',
        object: 'browser',
        text: s.comment3,
        duration: 400,
      },
    ],
  };
};
