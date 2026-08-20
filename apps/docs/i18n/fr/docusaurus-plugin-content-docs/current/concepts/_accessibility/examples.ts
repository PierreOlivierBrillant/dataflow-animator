import { DataFlowSpec } from '@dataflow-animator/react';

/**
 * Une spec ordinaire : rien n'y est ajouté pour l'accessibilité. Elle sert à
 * montrer la description que le lecteur génère TOUT SEUL — c'est le point de
 * la page, l'auteur n'a rien à écrire pour qu'une animation soit lisible.
 */
export const generatedExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    {
      id: 'browser',
      type: 'laptop',
      text: 'Navigateur',
      icon: 'chrome',
      lane: 1,
    },
    { id: 'api', type: 'server', text: 'Serveur Web', icon: 'node', lane: 2 },
    {
      id: 'db',
      type: 'database',
      text: 'Base de données',
      icon: 'postgres',
      lane: 3,
    },
  ],
  connections: [
    { from: 'browser', to: 'api', style: 'dashed' },
    { from: 'api', to: 'db', style: 'dashed' },
  ],
  packets: [
    {
      id: 'req',
      kind: 'http_packet',
      packet_content: { header: 'GET /users' },
    },
    { id: 'sql', kind: 'sql_request', request_content: 'SELECT * FROM users' },
  ],
  timeline: [
    { type: 'move', object: 'req', from: 'browser', to: 'api' },
    { type: 'move', object: 'sql', from: 'api', to: 'db' },
    { type: 'loading', object: 'db' },
  ],
};

/**
 * La même chose, mais l'auteur a écrit l'intention : `description` sur la spec
 * et sur les étapes dont la phrase générée était juste sans dire pourquoi.
 */
export const authoredExample: DataFlowSpec = {
  ...generatedExample,
  description: 'Comment un chargement de page atteint la base et en revient',
  timeline: [
    {
      type: 'move',
      object: 'req',
      from: 'browser',
      to: 'api',
      description:
        "L'utilisateur ouvre la page, le navigateur demande donc la liste",
    },
    {
      type: 'move',
      object: 'sql',
      from: 'api',
      to: 'db',
      description: 'Le cache est vide, le serveur interroge donc la base',
    },
    { type: 'loading', object: 'db' },
  ],
};
