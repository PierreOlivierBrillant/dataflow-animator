import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    orch: 'Orchestrator',
    inv: 'Inventory',
    pay: 'Payment',
    ship: 'Shipping',
    mail: 'Notification',
    cmdInv: 'reserve stock',
    cmdPay: 'charge',
    cmdShip: 'prepare package',
    cmdMail: 'notify customer',
    okInv: 'reserved ✅',
    okPay: 'paid ✅',
    okShip: 'ready ✅',
    okMail: 'sent ✅',
    comment1:
      'An order arrives: the orchestrator coordinates all services around it.',
    comment2: '1. It triggers each step, slightly staggered',
    comment3:
      '2. Each service does its work then confirms to the orchestrator.',
    doneContent: '✅ order processed',
    comment4: 'All confirmations received: the order is complete 🎉',
  },
  fr: {
    orch: 'Orchestrateur',
    inv: 'Stock',
    pay: 'Paiement',
    ship: 'Expédition',
    mail: 'Notification',
    cmdInv: 'réserver stock',
    cmdPay: 'débiter',
    cmdShip: 'préparer colis',
    cmdMail: 'notifier client',
    okInv: 'réservé ✅',
    okPay: 'payé ✅',
    okShip: 'prêt ✅',
    okMail: 'envoyée ✅',
    comment1:
      'Une commande arrive : l’orchestrateur coordonne tous les services autour de lui.',
    comment2: '1. Il déclenche chaque étape, légèrement décalée',
    comment3:
      '2. Chaque service fait son travail puis confirme à l’orchestrateur.',
    doneContent: '✅ commande traitée',
    comment4: 'Toutes les confirmations reçues : la commande est complète 🎉',
  },
};

/**
 * Démo de la disposition `circular` (référencée par la page « Disposition »).
 * Un orchestrateur central (`main`) distribue une commande aux services
 * satellites, puis agrège leurs réponses. Le nœud central reste au milieu, les
 * autres sont répartis sur un cercle.
 */
export const circular = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'circular',
    nodes: [
      {
        id: 'orch',
        type: 'server',
        text: s.orch,
        icon: 'go',
        main: true,
      },
      { id: 'inv', type: 'server', text: s.inv, icon: 'postgres', lane: 1 },
      { id: 'pay', type: 'server', text: s.pay, icon: 'Pay', lane: 2 },
      { id: 'ship', type: 'server', text: s.ship, icon: 'node', lane: 3 },
      {
        id: 'mail',
        type: 'server',
        text: s.mail,
        icon: 'redis',
        lane: 4,
      },
    ],
    packets: [
      {
        id: 'cmdInv',
        kind: 'http_packet',
        packet_content: { header: s.cmdInv },
      },
      {
        id: 'cmdPay',
        kind: 'http_packet',
        packet_content: { header: s.cmdPay },
      },
      {
        id: 'cmdShip',
        kind: 'http_packet',
        packet_content: { header: s.cmdShip },
      },
      {
        id: 'cmdMail',
        kind: 'http_packet',
        packet_content: { header: s.cmdMail },
      },
      {
        id: 'okInv',
        kind: 'http_packet',
        packet_content: { header: s.okInv },
      },
      { id: 'okPay', kind: 'http_packet', packet_content: { header: s.okPay } },
      {
        id: 'okShip',
        kind: 'http_packet',
        packet_content: { header: s.okShip },
      },
      {
        id: 'okMail',
        kind: 'http_packet',
        packet_content: { header: s.okMail },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'orch',
        text: s.comment1,
        duration: 2800,
      },
      {
        type: 'comment',
        object: 'orch',
        text: s.comment2,
        duration: 2200,
      },
      {
        type: 'parallel',
        duration: 1800,
        actions: [
          { type: 'move', object: 'cmdInv', from: 'orch', to: 'inv' },
          {
            type: 'move',
            object: 'cmdPay',
            from: 'orch',
            to: 'pay',
            delay_ms: 300,
          },
          {
            type: 'move',
            object: 'cmdShip',
            from: 'orch',
            to: 'ship',
            delay_ms: 600,
          },
          {
            type: 'move',
            object: 'cmdMail',
            from: 'orch',
            to: 'mail',
            delay_ms: 900,
          },
        ],
      },
      {
        type: 'comment',
        text: s.comment3,
        duration: 2600,
      },
      {
        type: 'parallel',
        duration: 1800,
        actions: [
          { type: 'move', object: 'okInv', from: 'inv', to: 'orch' },
          {
            type: 'move',
            object: 'okPay',
            from: 'pay',
            to: 'orch',
            delay_ms: 300,
          },
          {
            type: 'move',
            object: 'okShip',
            from: 'ship',
            to: 'orch',
            delay_ms: 600,
          },
          {
            type: 'move',
            object: 'okMail',
            from: 'mail',
            to: 'orch',
            delay_ms: 900,
          },
        ],
      },
      {
        type: 'set_content',
        object: 'orch',
        content: { type: 'text', value: s.doneContent },
        keep_until_end: true,
      },
      {
        type: 'comment',
        object: 'orch',
        text: s.comment4,
        duration: 2400,
      },
      { type: 'wait', duration: 1400 },
    ],
  };
};
