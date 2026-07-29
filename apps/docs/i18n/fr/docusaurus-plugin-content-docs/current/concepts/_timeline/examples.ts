import { DataFlowSpec, Action } from '@dataflow-animator/react';

/**
 * Cinq actions racines = cinq étapes logiques navigables (Précédent / Suivant).
 * Illustre aussi `wait_for` (la réponse attend la fin du loading) et
 * `keep_until_end` (le commentaire final reste affiché).
 */
export const stepsExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    {
      id: 'browser',
      type: 'laptop',
      text: 'Navigateur',
      icon: 'chrome',
      lane: 1,
    },
    { id: 'api', type: 'server', text: 'API', icon: 'node', lane: 2 },
  ],
  packets: [
    {
      id: 'req',
      kind: 'http_packet',
      packet_content: { header: 'GET /users' },
    },
    {
      id: 'res',
      kind: 'http_packet',
      packet_content: {
        header: '200 OK',
        body: { type: 'text', value: 'Alice, Bob' },
      },
    },
  ],
  timeline: [
    {
      type: 'comment',
      object: 'browser',
      text: '1. L’utilisateur ouvre la page',
      duration: 1000,
    },
    { type: 'move', object: 'req', from: 'browser', to: 'api', duration: 700 },
    { type: 'loading', id: 'work', object: 'api', duration: 800 },
    {
      type: 'move',
      object: 'res',
      from: 'api',
      to: 'browser',
      duration: 700,
      wait_for: 'work',
    },
    {
      type: 'comment',
      object: 'browser',
      text: '2. Page affichée 🎉',
      keep_until_end: true,
    },
  ],
};

/**
 * Diffusion d'un gateway vers trois services. Avec `stagger`, chaque envoi est
 * décalé via `delay_ms` (effet cascade) ; sans, les trois partent au même instant.
 */
export const fanOutExample: (stagger: boolean) => DataFlowSpec = (stagger) => {
  const move = (object: string, to: string, step: number): Action => ({
    type: 'move',
    object,
    from: 'gw',
    to,
    duration: 700,
    ...(stagger ? { delay_ms: step * 220 } : {}),
  });
  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'gw', type: 'server', text: 'Gateway', icon: 'nginx', lane: 1 },
      { id: 's1', type: 'server', text: 'Service A', lane: 2 },
      { id: 's2', type: 'server', text: 'Service B', lane: 2 },
      { id: 's3', type: 'server', text: 'Service C', lane: 2 },
    ],
    packets: [
      { id: 'p1', kind: 'http_packet', packet_content: { header: '→ A' } },
      { id: 'p2', kind: 'http_packet', packet_content: { header: '→ B' } },
      { id: 'p3', kind: 'http_packet', packet_content: { header: '→ C' } },
    ],
    timeline: [
      {
        type: 'parallel',
        actions: [
          move('p1', 's1', 0),
          move('p2', 's2', 1),
          move('p3', 's3', 2),
        ],
      },
    ],
  };
};
