import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    client: 'Clients',
    lb: 'Load Balancer',
    b1: 'Backend 1',
    b2: 'Backend 2',
    b3: 'Backend 3',
    comment1:
      'The load balancer distributes requests in turn, to balance the load.',
    comment2: 'Request 1 → Backend 1',
    comment3: 'Request 2 → Backend 2',
    comment4: 'Request 3 → Backend 3',
    comment5:
      'The 4th request would go back to Backend 1: the round-robin loops.',
  },
  fr: {
    client: 'Clients',
    lb: 'Répartiteur',
    b1: 'Backend 1',
    b2: 'Backend 2',
    b3: 'Backend 3',
    comment1:
      'Le répartiteur distribue les requêtes à tour de rôle, pour équilibrer la charge.',
    comment2: 'Requête 1 → Backend 1',
    comment3: 'Requête 2 → Backend 2',
    comment4: 'Requête 3 → Backend 3',
    comment5:
      'La 4ᵉ requête repartirait sur le Backend 1 : le tourniquet boucle.',
  },
};

/**
 * Répartiteur de charge en tourniquet (round-robin). Trois requêtes arrivent
 * coup sur coup et sont distribuées chacune à un backend différent. Le rythme
 * est étalé pour bien voir à quel serveur chaque requête est confiée.
 */
export const loadBalancer = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'client', type: 'users', text: s.client, lane: 1 },
      { id: 'lb', type: 'server', text: s.lb, icon: 'nginx', lane: 2 },
      { id: 'b1', type: 'server', text: s.b1, icon: 'node', lane: 3 },
      { id: 'b2', type: 'server', text: s.b2, icon: 'node', lane: 3 },
      { id: 'b3', type: 'server', text: s.b3, icon: 'node', lane: 3 },
    ],
    connections: [
      { from: 'client', to: 'lb', style: 'dotted' },
      { from: 'lb', to: 'b1', style: 'dotted' },
      { from: 'lb', to: 'b2', style: 'dotted' },
      { from: 'lb', to: 'b3', style: 'dotted' },
    ],
    packets: [
      { id: 'rq1', kind: 'http_packet', packet_content: { header: 'GET /a' } },
      { id: 'rs1', kind: 'http_packet', packet_content: { header: '200 OK' } },
      { id: 'rq2', kind: 'http_packet', packet_content: { header: 'GET /b' } },
      { id: 'rs2', kind: 'http_packet', packet_content: { header: '200 OK' } },
      { id: 'rq3', kind: 'http_packet', packet_content: { header: 'GET /c' } },
      { id: 'rs3', kind: 'http_packet', packet_content: { header: '200 OK' } },
    ],
    timeline: [
      {
        type: 'comment',
        text: s.comment1,
        duration: 2600,
      },
      {
        type: 'comment',
        object: 'lb',
        text: s.comment2,
        duration: 1800,
      },
      { type: 'move', object: 'rq1', from: 'client', to: 'lb', duration: 1100 },
      { type: 'move', object: 'rq1', from: 'lb', to: 'b1', duration: 1100 },
      { type: 'loading', id: 'w1', object: 'b1', duration: 800 },
      {
        type: 'move',
        object: 'rs1',
        from: 'b1',
        to: 'client',
        duration: 1100,
        wait_for: 'w1',
      },
      {
        type: 'comment',
        object: 'lb',
        text: s.comment3,
        duration: 1800,
      },
      { type: 'move', object: 'rq2', from: 'client', to: 'lb', duration: 1100 },
      { type: 'move', object: 'rq2', from: 'lb', to: 'b2', duration: 1100 },
      { type: 'loading', id: 'w2', object: 'b2', duration: 800 },
      {
        type: 'move',
        object: 'rs2',
        from: 'b2',
        to: 'client',
        duration: 1100,
        wait_for: 'w2',
      },
      {
        type: 'comment',
        object: 'lb',
        text: s.comment4,
        duration: 1800,
      },
      { type: 'move', object: 'rq3', from: 'client', to: 'lb', duration: 1100 },
      { type: 'move', object: 'rq3', from: 'lb', to: 'b3', duration: 1100 },
      { type: 'loading', id: 'w3', object: 'b3', duration: 800 },
      {
        type: 'move',
        object: 'rs3',
        from: 'b3',
        to: 'client',
        duration: 1100,
        wait_for: 'w3',
      },
      {
        type: 'comment',
        text: s.comment5,
        duration: 2600,
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
