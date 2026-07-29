import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// Démo de RÉFÉRENCE pour la localisation : tout le texte visible de l'animation
// est extrait dans `strings` (une entrée par langue) ; le builder reconstruit la
// spec avec les chaînes de la locale. Les valeurs techniques (verbes HTTP, SQL,
// codes de statut) et les noms propres (Alice, Bob) restent identiques.
const strings = {
  en: {
    browser: 'Browser',
    server: 'Web server',
    database: 'Database',
    rowsHeader: '2 rows',
    colName: 'name',
    openComment:
      'The user opens the page; the HTTP request is sent to the server',
    pageUrl: 'example.com/users',
    pageRendered: 'Page rendered 🎉',
  },
  fr: {
    browser: 'Navigateur',
    server: 'Serveur Web',
    database: 'Base de données',
    rowsHeader: '2 Lignes',
    colName: 'nom',
    openComment:
      "L'utilisateur ouvre la page, la requête HTTP est envoyée au serveur",
    pageUrl: 'exemple.com/users',
    pageRendered: 'Page affichée 🎉',
  },
};

export const clientServer = (locale: Locale): DataFlowSpec => {
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
        id: 'api',
        type: 'server',
        text: s.server,
        icon: 'dotnet',
        lane: 2,
      },
      {
        id: 'db',
        type: 'database',
        text: s.database,
        icon: 'mssql',
        lane: 3,
      },
    ],
    connections: [
      { from: 'browser', to: 'api', arrow_head: 'both', style: 'dashed' },
      { from: 'api', to: 'db', arrow_head: 'both', style: 'dashed' },
    ],
    packets: [
      {
        id: 'req',
        kind: 'http_packet',
        packet_content: {
          header: 'GET /users\nAccept: application/json',
        },
      },
      {
        id: 'sql',
        kind: 'sql_request',
        request_content: 'SELECT * FROM users',
      },
      {
        id: 'rows',
        kind: 'sql_response',
        response_content: {
          header: s.rowsHeader,
          body: {
            type: 'table',
            columns: ['id', s.colName],
            rows_data: [
              [1, 'Alice'],
              [2, 'Bob'],
            ],
          },
        },
      },
      {
        id: 'res',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK',
          body: {
            type: 'text',
            value: '<div>\n  <h2>Alice</h2>\n  <h2>Bob</h2>\n</div>',
            language: 'html',
          },
        },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'browser',
        text: s.openComment,
        duration: 1500,
      },
      {
        type: 'parallel',
        actions: [
          {
            type: 'move',
            object: 'req',
            from: 'browser',
            to: 'api',
            duration: 900,
          },
          {
            type: 'loading',
            object: 'browser',
            keep_until: 'display_html',
          },
        ],
      },
      {
        id: 'dbwork',
        type: 'move',
        object: 'sql',
        from: 'api',
        to: 'db',
        duration: 700,
      },
      {
        type: 'move',
        object: 'rows',
        from: 'db',
        to: 'api',
        duration: 700,
        wait_for: 'dbwork',
      },
      {
        type: 'move',
        object: 'res',
        from: 'api',
        to: 'browser',
      },
      {
        type: 'parallel',
        actions: [
          {
            id: 'display_html',
            type: 'set_content',
            object: 'browser',
            keep_until_end: true,
            content: {
              url: s.pageUrl,
              type: 'text',
              value: 'Alice\nBob',
            },
          },
          {
            type: 'comment',
            object: 'browser',
            text: s.pageRendered,
            keep_until_end: true,
          },
        ],
      },
      {
        type: 'wait',
        delay_ms: 1000,
      },
    ],
  };
};
