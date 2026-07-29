import { DataFlowSpec } from '@dataflow-animator/react';

/** Small scene used to preview a palette: nodes, a connection, a comment and a
 *  packet in flight — enough surface to show off background, node stroke, arrow
 *  and accent colours at once. */
export const themeExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'browser', type: 'laptop', text: 'Navigateur', lane: 1 },
    { id: 'api', type: 'server', text: 'API', lane: 2 },
    { id: 'db', type: 'database', text: 'Base de données', lane: 3 },
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
  ],
  timeline: [
    { type: 'move', object: 'req', from: 'browser', to: 'api', duration: 700 },
    { type: 'highlight', object: 'api', duration: 500 },
    { type: 'move', object: 'req', from: 'api', to: 'db', duration: 700 },
    { type: 'comment', object: 'db', text: 'Ligne trouvée', duration: 900 },
  ],
};
