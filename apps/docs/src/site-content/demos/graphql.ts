import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    client: 'Client',
    gw: 'Gateway',
    users: 'Users Subgraph',
    orders: 'Orders Subgraph',
    reviews: 'Reviews Subgraph',
    qBody: '{ user { name orders reviews } }',
    rU: '"Alice"',
    rO: '[ 3 orders ]',
    rR: '[ 5 reviews ]',
    comment1:
      '1. The client sends a single request that touches multiple domains',
    comment2:
      '2. The gateway plans the request and queries each subgraph in parallel',
    comment3: '3. Each service responds for its part of the graph',
    comment4:
      '4. The gateway recombines a single object from the three responses',
    comment5:
      'One request, one response — federation is invisible on the client side ✅',
  },
  fr: {
    client: 'Client',
    gw: 'Gateway',
    users: 'Sous-graphe Users',
    orders: 'Sous-graphe Orders',
    reviews: 'Sous-graphe Reviews',
    qBody: '{ user { name orders reviews } }',
    rU: '"Alice"',
    rO: '[ 3 commandes ]',
    rR: '[ 5 avis ]',
    comment1:
      '1. Le client envoie une seule requête, qui touche plusieurs domaines',
    comment2:
      '2. La gateway planifie la requête et interroge chaque sous-graphe en parallèle',
    comment3: '3. Chaque service répond pour sa part du graphe',
    comment4:
      '4. La gateway recompose un seul objet à partir des trois réponses',
    comment5:
      'Une requête, une réponse — la fédération est invisible côté client ✅',
  },
};

/**
 * Passerelle GraphQL fédérée : une seule requête est éclatée par la gateway
 * vers plusieurs sous-graphes, dont les réponses sont recomposées en un objet
 * unique. Illustre le fan-out / fan-in et le résultat agrégé.
 */
export const graphql = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'client', type: 'laptop', text: s.client, icon: 'react', lane: 1 },
      { id: 'gw', type: 'server', text: s.gw, icon: 'graphql', lane: 2 },
      { id: 'users', type: 'server', text: s.users, lane: 3 },
      { id: 'orders', type: 'server', text: s.orders, lane: 3 },
      { id: 'reviews', type: 'server', text: s.reviews, lane: 3 },
    ],
    connections: [
      { from: 'client', to: 'gw', style: 'dotted' },
      { from: 'gw', to: 'users', style: 'dotted' },
      { from: 'gw', to: 'orders', style: 'dotted' },
      { from: 'gw', to: 'reviews', style: 'dotted' },
    ],
    packets: [
      {
        id: 'query',
        kind: 'http_packet',
        packet_content: {
          header: 'POST /graphql',
          body: { type: 'text', value: s.qBody },
        },
      },
      { id: 'qU', kind: 'http_packet', packet_content: { header: 'user(id)' } },
      {
        id: 'qO',
        kind: 'http_packet',
        packet_content: { header: 'orders(userId)' },
      },
      {
        id: 'qR',
        kind: 'http_packet',
        packet_content: { header: 'reviews(userId)' },
      },
      {
        id: 'rU',
        kind: 'http_packet',
        packet_content: {
          header: 'name',
          body: { type: 'text', value: s.rU },
        },
      },
      {
        id: 'rO',
        kind: 'http_packet',
        packet_content: {
          header: 'orders',
          body: { type: 'text', value: s.rO },
        },
      },
      {
        id: 'rR',
        kind: 'http_packet',
        packet_content: {
          header: 'reviews',
          body: { type: 'text', value: s.rR },
        },
      },
      {
        id: 'merged',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK',
          body: {
            type: 'text',
            value: '{ name, orders, reviews }',
            language: 'json',
          },
        },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'client',
        text: s.comment1,
        duration: 2600,
      },
      {
        type: 'move',
        object: 'query',
        from: 'client',
        to: 'gw',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'gw',
        text: s.comment2,
        duration: 2800,
      },
      {
        type: 'parallel',
        duration: 1400,
        actions: [
          { type: 'move', object: 'qU', from: 'gw', to: 'users' },
          {
            type: 'move',
            object: 'qO',
            from: 'gw',
            to: 'orders',
            delay_ms: 200,
          },
          {
            type: 'move',
            object: 'qR',
            from: 'gw',
            to: 'reviews',
            delay_ms: 400,
          },
        ],
      },
      {
        type: 'parallel',
        duration: 1200,
        actions: [
          { type: 'loading', object: 'users' },
          { type: 'loading', object: 'orders' },
          { type: 'loading', object: 'reviews' },
        ],
      },
      {
        type: 'comment',
        text: s.comment3,
        duration: 2400,
      },
      {
        type: 'parallel',
        duration: 1500,
        actions: [
          { type: 'move', object: 'rU', from: 'users', to: 'gw' },
          {
            type: 'move',
            object: 'rO',
            from: 'orders',
            to: 'gw',
            delay_ms: 250,
          },
          {
            type: 'move',
            object: 'rR',
            from: 'reviews',
            to: 'gw',
            delay_ms: 500,
          },
        ],
      },
      { type: 'loading', id: 'stitch', object: 'gw', duration: 1000 },
      {
        type: 'comment',
        object: 'gw',
        text: s.comment4,
        duration: 2600,
        wait_for: 'stitch',
      },
      {
        type: 'move',
        object: 'merged',
        from: 'gw',
        to: 'client',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'client',
        text: s.comment5,
        duration: 2600,
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
