import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    producer: 'Producer',
    broker: 'Broker (queue)',
    c1: 'Worker A',
    c2: 'Worker B',
    c3: 'Worker C',
    pubBody: 'order.created #4815',
    dBody: 'order.created #4815',
    comment1:
      '1. The producer publishes an event, then moves on (asynchronous)',
    queuedMsg: '📥 1 message in queue',
    comment2: '2. The broker stores the message until workers are ready',
    comment3: '3. Fan-out to all subscribers, slightly staggered',
    comment4:
      '4. Each worker processes then acknowledges; the message leaves the queue only when acked.',
    emptyQueue: '✅ queue empty',
  },
  fr: {
    producer: 'Producteur',
    broker: 'Broker (file)',
    c1: 'Worker A',
    c2: 'Worker B',
    c3: 'Worker C',
    pubBody: 'order.created #4815',
    dBody: 'order.created #4815',
    comment1:
      '1. Le producteur publie un événement, puis passe à autre chose (asynchrone)',
    queuedMsg: '📥 1 message en file',
    comment2:
      '2. Le broker conserve le message le temps que les workers soient prêts',
    comment3: '3. Diffusion (fan-out) à tous les abonnés, légèrement décalée',
    comment4:
      '4. Chaque worker traite puis accuse réception ; le message ne quitte la file qu’une fois acquitté.',
    emptyQueue: '✅ file vide',
  },
};

/**
 * Messagerie asynchrone publish/subscribe. Un producteur publie un message
 * dans un broker, qui le distribue à trois consommateurs abonnés. On illustre
 * le découplage : le producteur n'attend personne, le broker temporise.
 */
export const messageQueue = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      {
        id: 'producer',
        type: 'server',
        text: s.producer,
        icon: 'node',
        lane: 1,
      },
      {
        id: 'broker',
        type: 'server',
        text: s.broker,
        icon: 'MQ',
        lane: 2,
      },
      { id: 'c1', type: 'server', text: s.c1, icon: 'python', lane: 3 },
      { id: 'c2', type: 'server', text: s.c2, icon: 'python', lane: 3 },
      { id: 'c3', type: 'server', text: s.c3, icon: 'python', lane: 3 },
    ],
    connections: [
      { from: 'producer', to: 'broker', style: 'animated' },
      { from: 'broker', to: 'c1', style: 'dotted' },
      { from: 'broker', to: 'c2', style: 'dotted' },
      { from: 'broker', to: 'c3', style: 'dotted' },
    ],
    packets: [
      {
        id: 'pub',
        kind: 'http_packet',
        packet_content: {
          header: 'publish',
          body: { type: 'text', value: s.pubBody },
        },
      },
      {
        id: 'd1',
        kind: 'http_packet',
        packet_content: {
          header: 'deliver',
          body: { type: 'text', value: s.dBody },
        },
      },
      {
        id: 'd2',
        kind: 'http_packet',
        packet_content: {
          header: 'deliver',
          body: { type: 'text', value: s.dBody },
        },
      },
      {
        id: 'd3',
        kind: 'http_packet',
        packet_content: {
          header: 'deliver',
          body: { type: 'text', value: s.dBody },
        },
      },
      { id: 'ack1', kind: 'http_packet', packet_content: { header: 'ack ✅' } },
      { id: 'ack2', kind: 'http_packet', packet_content: { header: 'ack ✅' } },
      { id: 'ack3', kind: 'http_packet', packet_content: { header: 'ack ✅' } },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'producer',
        text: s.comment1,
        duration: 2600,
      },
      {
        type: 'move',
        object: 'pub',
        from: 'producer',
        to: 'broker',
        duration: 1300,
      },
      {
        type: 'set_content',
        object: 'broker',
        content: { type: 'text', value: s.queuedMsg },
        keep_until: 'fanout',
      },
      {
        type: 'comment',
        object: 'broker',
        text: s.comment2,
        duration: 2400,
      },
      { type: 'loading', object: 'broker', duration: 1000 },
      {
        type: 'comment',
        object: 'broker',
        text: s.comment3,
        duration: 2400,
      },
      {
        type: 'parallel',
        id: 'fanout',
        duration: 1600,
        actions: [
          { type: 'move', object: 'd1', from: 'broker', to: 'c1' },
          {
            type: 'move',
            object: 'd2',
            from: 'broker',
            to: 'c2',
            delay_ms: 250,
          },
          {
            type: 'move',
            object: 'd3',
            from: 'broker',
            to: 'c3',
            delay_ms: 500,
          },
        ],
      },
      {
        type: 'comment',
        text: s.comment4,
        duration: 2800,
      },
      {
        type: 'parallel',
        duration: 1600,
        actions: [
          { type: 'move', object: 'ack1', from: 'c1', to: 'broker' },
          {
            type: 'move',
            object: 'ack2',
            from: 'c2',
            to: 'broker',
            delay_ms: 300,
          },
          {
            type: 'move',
            object: 'ack3',
            from: 'c3',
            to: 'broker',
            delay_ms: 600,
          },
        ],
      },
      {
        type: 'set_content',
        object: 'broker',
        content: { type: 'text', value: s.emptyQueue },
        keep_until_end: true,
      },
      { type: 'wait', duration: 1400 },
    ],
  };
};
