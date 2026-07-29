import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    provider: 'Provider Service',
    app: 'Your Endpoint',
    evt1: 'invoice.paid · try 1',
    evt2: 'invoice.paid · try 2',
    evt3: 'invoice.paid · try 3',
    comment1: 'An event just happened: the provider attempts to deliver it.',
    comment2: 'Attempt 1',
    downContent: '🛑 service down',
    comment3: 'Failure (503). The provider waits before retrying (back-off).',
    comment4: 'Attempt 2 (after ~1s)',
    comment5: 'Failed again (500). Doubling the wait time.',
    upContent: '🟢 service restored',
    comment6: 'Attempt 3 (after ~2s) — this time the endpoint replies',
    comment7: '200 OK received: delivery marked as successful ✅',
  },
  fr: {
    provider: 'Service émetteur',
    app: 'Ton endpoint',
    evt1: 'invoice.paid · essai 1',
    evt2: 'invoice.paid · essai 2',
    evt3: 'invoice.paid · essai 3',
    comment1:
      'Un événement vient de se produire : l’émetteur tente de le livrer.',
    comment2: 'Tentative 1',
    downContent: '🛑 service en maintenance',
    comment3: 'Échec (503). L’émetteur attend avant de réessayer (back-off).',
    comment4: 'Tentative 2 (après ~1 s)',
    comment5: 'Encore raté (500). On double le délai d’attente.',
    upContent: '🟢 service rétabli',
    comment6: 'Tentative 3 (après ~2 s) — cette fois l’endpoint répond',
    comment7: 'Accusé 200 reçu : la livraison est marquée réussie ✅',
  },
};

/**
 * Livraison d'un webhook avec ré-essais et back-off exponentiel. Le premier
 * envoi échoue (récepteur indisponible), le deuxième aussi, le troisième
 * réussit. Les temps morts entre tentatives matérialisent le back-off, d'où le
 * rythme délibérément lent.
 */
export const webhook = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'provider', type: 'cloud', text: s.provider, lane: 1 },
      { id: 'app', type: 'server', text: s.app, icon: 'node', lane: 2 },
    ],
    connections: [{ from: 'provider', to: 'app', style: 'dotted' }],
    packets: [
      {
        id: 'evt1',
        kind: 'http_packet',
        packet_content: {
          header: 'POST /webhook',
          body: { type: 'text', value: s.evt1 },
        },
      },
      {
        id: 'err1',
        kind: 'http_packet',
        packet_content: { header: '503 Service Unavailable' },
      },
      {
        id: 'evt2',
        kind: 'http_packet',
        packet_content: {
          header: 'POST /webhook',
          body: { type: 'text', value: s.evt2 },
        },
      },
      {
        id: 'err2',
        kind: 'http_packet',
        packet_content: { header: '500 Internal Error' },
      },
      {
        id: 'evt3',
        kind: 'http_packet',
        packet_content: {
          header: 'POST /webhook',
          body: { type: 'text', value: s.evt3 },
        },
      },
      {
        id: 'ok',
        kind: 'http_packet',
        packet_content: { header: '200 OK ✅' },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'provider',
        text: s.comment1,
        duration: 2400,
      },
      {
        type: 'comment',
        object: 'provider',
        text: s.comment2,
        duration: 1600,
      },
      {
        type: 'move',
        object: 'evt1',
        from: 'provider',
        to: 'app',
        duration: 1300,
      },
      {
        type: 'set_content',
        object: 'app',
        content: { type: 'text', value: s.downContent },
        keep_until: 'recover',
      },
      {
        type: 'move',
        object: 'err1',
        from: 'app',
        to: 'provider',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'provider',
        text: s.comment3,
        duration: 2600,
      },
      { type: 'wait', duration: 1600 },
      {
        type: 'comment',
        object: 'provider',
        text: s.comment4,
        duration: 1800,
      },
      {
        type: 'move',
        object: 'evt2',
        from: 'provider',
        to: 'app',
        duration: 1300,
      },
      {
        type: 'move',
        object: 'err2',
        from: 'app',
        to: 'provider',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'provider',
        text: s.comment5,
        duration: 2400,
      },
      { type: 'wait', duration: 1800 },
      {
        type: 'set_content',
        id: 'recover',
        object: 'app',
        content: { type: 'text', value: s.upContent },
        keep_until_end: true,
      },
      {
        type: 'comment',
        object: 'provider',
        text: s.comment6,
        duration: 2600,
      },
      {
        type: 'move',
        object: 'evt3',
        from: 'provider',
        to: 'app',
        duration: 1300,
      },
      { type: 'loading', id: 'process', object: 'app', duration: 900 },
      {
        type: 'move',
        object: 'ok',
        from: 'app',
        to: 'provider',
        duration: 1300,
        wait_for: 'process',
      },
      {
        type: 'comment',
        object: 'provider',
        text: s.comment7,
        duration: 2400,
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
