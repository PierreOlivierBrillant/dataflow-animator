import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    buyer: 'Customer',
    shop: 'Shop',
    psp: 'Provider',
    bank: 'Bank',
    payHeader: 'Pay €49.90',
    authHeader: 'authorization',
    authBody: 'card •••• 4242',
    challengeHeader: '3-D Secure',
    challengeBody: 'validate in banking app',
    approvedHeader: 'approved ✅',
    receiptHeader: 'Order confirmed 🎉',
    comment1: '1. The customer validates their cart and pays',
    comment2: '2. The shop creates a payment intent with the provider',
    comment3: '3. The provider asks the issuing bank for authorization',
    comment4: '4. The bank requires strong authentication (3-D Secure)',
    comment5: 'The customer confirms in their banking app',
    comment6:
      '5. Payment captured. The provider notifies the shop asynchronously (webhook).',
  },
  fr: {
    buyer: 'Client',
    shop: 'Boutique',
    psp: 'Prestataire',
    bank: 'Banque',
    payHeader: 'Payer 49,90 €',
    authHeader: 'autorisation',
    authBody: 'carte •••• 4242',
    challengeHeader: '3-D Secure',
    challengeBody: 'valider sur l’app bancaire',
    approvedHeader: 'approuvé ✅',
    receiptHeader: 'Commande confirmée 🎉',
    comment1: '1. Le client valide son panier et paie',
    comment2:
      '2. La boutique crée une intention de paiement chez le prestataire',
    comment3: '3. Le prestataire demande l’autorisation à la banque émettrice',
    comment4: '4. La banque exige une authentification forte (3-D Secure)',
    comment5: 'Le client confirme dans son application bancaire',
    comment6:
      '5. Paiement capturé. Le prestataire notifie la boutique de façon asynchrone (webhook).',
  },
};

/**
 * Paiement en ligne avec prestataire (type Stripe) et authentification forte
 * 3-D Secure. On distingue l'autorisation synchrone de la confirmation
 * asynchrone par webhook, ce qui explique le rythme en deux temps.
 */
export const payment = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'buyer', type: 'mobile', text: s.buyer, lane: 1 },
      { id: 'shop', type: 'server', text: s.shop, icon: 'react', lane: 2 },
      { id: 'psp', type: 'cloud', text: s.psp, icon: 'Pay', lane: 3 },
      { id: 'bank', type: 'server', text: s.bank, icon: 'bank', lane: 4 },
    ],
    connections: [
      { from: 'buyer', to: 'shop', style: 'dotted' },
      { from: 'shop', to: 'psp', style: 'dotted' },
      { from: 'psp', to: 'bank', style: 'dotted' },
    ],
    packets: [
      {
        id: 'pay',
        kind: 'http_packet',
        packet_content: { header: s.payHeader },
      },
      {
        id: 'intent',
        kind: 'http_packet',
        packet_content: {
          header: 'create PaymentIntent',
          body: { type: 'text', value: 'amount: 4990, eur' },
        },
      },
      {
        id: 'auth',
        kind: 'http_packet',
        packet_content: {
          header: s.authHeader,
          body: { type: 'text', value: s.authBody },
        },
      },
      {
        id: 'challenge',
        kind: 'http_packet',
        packet_content: {
          header: s.challengeHeader,
          body: { type: 'text', value: s.challengeBody },
        },
      },
      {
        id: 'approved',
        kind: 'http_packet',
        packet_content: { header: s.approvedHeader },
      },
      {
        id: 'webhook',
        kind: 'http_packet',
        packet_content: {
          header: 'webhook',
          body: { type: 'text', value: 'payment_intent.succeeded' },
        },
      },
      {
        id: 'receipt',
        kind: 'http_packet',
        packet_content: { header: s.receiptHeader },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'buyer',
        text: s.comment1,
        duration: 2000,
      },
      {
        type: 'move',
        object: 'pay',
        from: 'buyer',
        to: 'shop',
        duration: 1200,
      },
      {
        type: 'comment',
        object: 'shop',
        text: s.comment2,
        duration: 2400,
      },
      {
        type: 'move',
        object: 'intent',
        from: 'shop',
        to: 'psp',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'psp',
        text: s.comment3,
        duration: 2400,
      },
      { type: 'move', object: 'auth', from: 'psp', to: 'bank', duration: 1300 },
      {
        type: 'comment',
        object: 'bank',
        text: s.comment4,
        duration: 2600,
      },
      {
        type: 'move',
        object: 'challenge',
        from: 'bank',
        to: 'buyer',
        duration: 1400,
      },
      { type: 'loading', id: 'sca', object: 'buyer', duration: 1200 },
      {
        type: 'comment',
        object: 'buyer',
        text: s.comment5,
        duration: 2200,
        wait_for: 'sca',
      },
      {
        type: 'move',
        object: 'approved',
        from: 'bank',
        to: 'psp',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'psp',
        text: s.comment6,
        duration: 2800,
      },
      {
        type: 'move',
        object: 'webhook',
        from: 'psp',
        to: 'shop',
        duration: 1300,
      },
      {
        type: 'move',
        object: 'receipt',
        from: 'shop',
        to: 'buyer',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'buyer',
        text: s.receiptHeader,
        duration: 2000,
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
