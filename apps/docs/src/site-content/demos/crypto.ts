import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    alice: 'Alice',
    eve: 'Eve (on the wire)',
    bob: 'Bob',
    connText: 'public channel (eavesdropped)',
    pubBody: 'public value',
    cipherHeader: '🔒 encrypted message',
    comment1:
      'Diffie-Hellman: agreeing on a common secret key, over a channel that anyone can listen to.',
    comment2:
      'Alice picks a secret a, then computes her public value A = gᵃ mod p',
    comment3: 'Eve notes A as it passes... but A alone teaches her nothing.',
    comment4: 'Bob picks his secret b, computes B = gᵇ mod p and sends it back',
    comment5: 'Eve now knows A and B — but still neither a nor b.',
    comment6:
      'Each raises the received value to their own secret: K = Bᵃ = Aᵇ mod p. The same key, without ever transmitting it!',
    sharedKey: '# shared key 🔑',
    secretNeverTransmitted: '# secret, never transmitted',
    publicVal: '# public',
    comment7: 'Alice encrypts her message with K and sends it',
    comment8: 'Eve only captures an encrypted block: unreadable without K 🔒',
    decryptedUrl: 'decrypted message',
    decryptedMsg: 'Hi Bob 👋',
    comment9: 'Bob decrypts with K and reads the plaintext message ✅',
    comment10:
      'Recovering the secret from A and B (the "discrete logarithm") is computationally infeasible in practice: Eve remains in the dark.',
  },
  fr: {
    alice: 'Alice',
    eve: 'Ève (sur le câble)',
    bob: 'Bob',
    connText: 'canal public (écouté)',
    pubBody: 'valeur publique',
    cipherHeader: '🔒 message chiffré',
    comment1:
      'Diffie-Hellman : se mettre d’accord sur une clé secrète commune, sur un canal que tout le monde peut écouter.',
    comment2:
      'Alice tire un secret a, puis calcule sa valeur publique A = gᵃ mod p',
    comment3: 'Ève note A au passage… mais A seul ne lui apprend rien.',
    comment4: 'Bob tire son secret b, calcule B = gᵇ mod p et le renvoie',
    comment5: 'Ève connaît maintenant A et B — mais toujours ni a, ni b.',
    comment6:
      'Chacun élève la valeur reçue à son propre secret : K = Bᵃ = Aᵇ mod p. La même clé, sans l’avoir jamais transmise !',
    sharedKey: '# clé partagée 🔑',
    secretNeverTransmitted: '# secret, jamais transmis',
    publicVal: '# public',
    comment7: 'Alice chiffre son message avec K et l’envoie',
    comment8: 'Ève ne capte qu’un bloc chiffré : illisible sans K 🔒',
    decryptedUrl: 'message déchiffré',
    decryptedMsg: 'Salut Bob 👋',
    comment9: 'Bob déchiffre avec K et lit le message en clair ✅',
    comment10:
      'Retrouver le secret à partir de A et B (le « logarithme discret ») est infaisable en pratique : Ève reste dans le noir.',
  },
};

/**
 * Échange de clés Diffie-Hellman sur un canal public écouté par Ève.
 * Démo « hors flux web classique » : on illustre pourquoi Ève, qui voit
 * passer A et B, ne peut pas pour autant reconstituer la clé partagée K.
 * Rythme volontairement lent (longs commentaires + highlights) pour laisser
 * le temps de lire chaque étape du protocole.
 */
export const crypto = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'alice', type: 'alice', text: s.alice, lane: 1 },
      // Ève est posée sur la lane médiane : le trafic Alice ↔ Bob lui passe
      // littéralement sous le nez.
      { id: 'eve', type: 'eve', text: s.eve, lane: 2 },
      { id: 'bob', type: 'bob', text: s.bob, lane: 3 },
    ],
    connections: [
      {
        from: 'alice',
        to: 'bob',
        style: 'dashed',
        arrow_head: 'both',
        text: s.connText,
      },
    ],
    packets: [
      {
        id: 'pubA',
        kind: 'http_packet',
        packet_content: {
          header: 'A = gᵃ mod p',
          body: { type: 'text', value: `${s.pubBody} (Alice)` },
        },
      },
      {
        id: 'pubB',
        kind: 'http_packet',
        packet_content: {
          header: 'B = gᵇ mod p',
          body: { type: 'text', value: `${s.pubBody} (Bob)` },
        },
      },
      {
        id: 'cipher',
        kind: 'http_packet',
        packet_content: {
          header: s.cipherHeader,
          body: { type: 'text', value: 'Vm0wd2QyUXlVWGxW…' },
        },
      },
    ],
    timeline: [
      {
        type: 'comment',
        text: s.comment1,
        duration: 2600,
      },
      {
        type: 'comment',
        object: 'alice',
        text: s.comment2,
        duration: 2200,
      },
      {
        type: 'set_content',
        id: 'a_pub',
        object: 'alice',
        content: {
          type: 'code',
          language: 'python',
          value: `a = 6            ${s.secretNeverTransmitted}\nA = (g**a) % p   ${s.publicVal}`,
        },
        keep_until: 'a_key',
      },
      {
        type: 'move',
        object: 'pubA',
        from: 'alice',
        to: 'bob',
        duration: 1400,
      },
      {
        type: 'parallel',
        duration: 2200,
        actions: [
          { type: 'highlight', object: 'eve' },
          {
            type: 'comment',
            object: 'eve',
            text: s.comment3,
          },
        ],
      },
      {
        type: 'comment',
        object: 'bob',
        text: s.comment4,
        duration: 2200,
      },
      {
        type: 'set_content',
        id: 'b_pub',
        object: 'bob',
        content: {
          type: 'code',
          language: 'python',
          value: `b = 15           ${s.secretNeverTransmitted}\nB = (g**b) % p   ${s.publicVal}`,
        },
        keep_until: 'b_key',
      },
      {
        type: 'move',
        object: 'pubB',
        from: 'bob',
        to: 'alice',
        duration: 1400,
      },
      {
        type: 'parallel',
        duration: 2400,
        actions: [
          { type: 'highlight', object: 'eve' },
          {
            type: 'comment',
            object: 'eve',
            text: s.comment5,
          },
        ],
      },
      {
        type: 'comment',
        text: s.comment6,
        duration: 2800,
      },
      {
        type: 'parallel',
        duration: 1800,
        actions: [
          {
            type: 'set_content',
            id: 'a_key',
            object: 'alice',
            content: {
              type: 'code',
              language: 'python',
              value: `K = (B**a) % p   ${s.sharedKey}`,
            },
            keep_until_end: true,
          },
          {
            type: 'set_content',
            id: 'b_key',
            object: 'bob',
            content: {
              type: 'code',
              language: 'python',
              value: `K = (A**b) % p   ${s.sharedKey}`,
            },
            keep_until: 'b_msg',
          },
        ],
      },
      {
        type: 'comment',
        object: 'alice',
        text: s.comment7,
        duration: 2000,
      },
      {
        type: 'move',
        object: 'cipher',
        from: 'alice',
        to: 'bob',
        duration: 1400,
      },
      {
        type: 'parallel',
        duration: 2600,
        actions: [
          { type: 'highlight', object: 'eve' },
          {
            type: 'comment',
            object: 'eve',
            text: s.comment8,
          },
        ],
      },
      {
        type: 'set_content',
        id: 'b_msg',
        object: 'bob',
        content: {
          type: 'text',
          url: s.decryptedUrl,
          value: s.decryptedMsg,
        },
        keep_until_end: true,
      },
      {
        type: 'comment',
        object: 'bob',
        text: s.comment9,
        duration: 2200,
      },
      {
        type: 'comment',
        text: s.comment10,
        duration: 3000,
      },
      { type: 'wait', duration: 1400 },
    ],
  };
};
