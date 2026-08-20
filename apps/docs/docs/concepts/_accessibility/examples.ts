import { DataFlowSpec } from '@dataflow-animator/react';

/**
 * Une spec ordinaire : rien n'y est ajouté pour l'accessibilité. Elle sert à
 * montrer la description que le lecteur génère TOUT SEUL — c'est le point de
 * la page, l'auteur n'a rien à écrire pour qu'une animation soit lisible.
 */
export const generatedExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'browser', type: 'laptop', text: 'Browser', icon: 'chrome', lane: 1 },
    { id: 'api', type: 'server', text: 'Web server', icon: 'node', lane: 2 },
    { id: 'db', type: 'database', text: 'Database', icon: 'postgres', lane: 3 },
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
 * (ce que l'animation raconte) et sur l'étape que la phrase générée décrivait
 * correctement sans en donner la raison.
 */
export const authoredExample: DataFlowSpec = {
  ...generatedExample,
  description: 'How a page load reaches the database and comes back',
  timeline: [
    {
      type: 'move',
      object: 'req',
      from: 'browser',
      to: 'api',
      description: 'The user opens the page, so the browser asks for the list',
    },
    {
      type: 'move',
      object: 'sql',
      from: 'api',
      to: 'db',
      description: 'The cache is empty, so the server queries the database',
    },
    { type: 'loading', object: 'db' },
  ],
};
