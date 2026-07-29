import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

/**
 * Acheminement d'un courriel : du client d'Alice jusqu'à la boîte de Bob, en
 * passant par les serveurs de messagerie (MTA) et une résolution
 * d'enregistrement MX. On sépare bien l'envoi (SMTP) de la relève (IMAP).
 */
const strings = {
  en: {
    alice: 'Alice (mail client)',
    mtaOut: 'Sender MTA',
    mtaIn: 'Recipient MTA',
    bob: 'Bob (mail client)',
    submitBody: 'From: alice@a.fr\nTo: bob@b.fr',
    newMessage: 'New message ✉️',
    mailBody: 'From: alice@a.fr',
    filtered: '✓ anti-spam OK\n📥 delivered to mailbox',
    c1: '1. Alice writes her message and sends it to her outgoing server (SMTP)',
    c2: '2. The server looks up which server receives mail for “b.fr” (MX record)',
    c3: '3. It relays the message to the recipient MTA',
    c4: "4. After spam filtering, the message waits in Bob's mailbox",
    c5: "5. Bob's client checks his mailbox (IMAP) and fetches the message",
    received: 'Email received ✉️',
  },
  fr: {
    alice: 'Alice (client mail)',
    mtaOut: 'MTA expéditeur',
    mtaIn: 'MTA destinataire',
    bob: 'Bob (client mail)',
    submitBody: 'De: alice@a.fr\nÀ: bob@b.fr',
    newMessage: 'Nouveau message ✉️',
    mailBody: 'De: alice@a.fr',
    filtered: '✓ anti-spam OK\n📥 déposé en boîte',
    c1: '1. Alice rédige son message et l’envoie à son serveur sortant (SMTP)',
    c2: '2. Le serveur cherche quel serveur reçoit le courrier de « b.fr » (enregistrement MX)',
    c3: '3. Il relaie le message au MTA destinataire',
    c4: '4. Après filtrage anti-spam, le message attend dans la boîte de Bob',
    c5: '5. Le client de Bob relève sa boîte (IMAP) et récupère le message',
    received: 'Courriel reçu ✉️',
  },
};

export const smtp = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'alice', type: 'laptop', text: s.alice, lane: 1 },
      { id: 'out', type: 'server', text: s.mtaOut, lane: 2 },
      { id: 'dns', type: 'server', text: 'DNS (MX)', icon: 'DNS', lane: 3 },
      { id: 'in', type: 'server', text: s.mtaIn, lane: 3 },
      { id: 'bob', type: 'mobile', text: s.bob, lane: 4 },
    ],
    connections: [
      { from: 'alice', to: 'out', style: 'dotted' },
      { from: 'out', to: 'in', style: 'dotted' },
      { from: 'in', to: 'bob', style: 'dotted' },
    ],
    packets: [
      {
        id: 'submit',
        kind: 'http_packet',
        packet_content: {
          header: 'SMTP submission',
          body: { type: 'text', value: s.submitBody },
        },
      },
      {
        id: 'mxq',
        kind: 'http_packet',
        packet_content: { header: 'MX? b.fr' },
      },
      {
        id: 'mxr',
        kind: 'http_packet',
        packet_content: {
          header: 'MX b.fr',
          body: { type: 'text', value: 'mx1.b.fr (prio 10)' },
        },
      },
      {
        id: 'relay',
        kind: 'http_packet',
        packet_content: {
          header: 'SMTP relay',
          body: { type: 'text', value: 'DATA … message' },
        },
      },
      {
        id: 'fetch',
        kind: 'http_packet',
        packet_content: { header: 'IMAP fetch' },
      },
      {
        id: 'mail',
        kind: 'http_packet',
        packet_content: {
          header: s.newMessage,
          body: { type: 'text', value: s.mailBody },
        },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'alice',
        text: s.c1,
        duration: 2400,
      },
      {
        type: 'move',
        object: 'submit',
        from: 'alice',
        to: 'out',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'out',
        text: s.c2,
        duration: 2800,
      },
      { type: 'move', object: 'mxq', from: 'out', to: 'dns', duration: 1200 },
      { type: 'move', object: 'mxr', from: 'dns', to: 'out', duration: 1200 },
      {
        type: 'comment',
        object: 'out',
        text: s.c3,
        duration: 2200,
      },
      { type: 'move', object: 'relay', from: 'out', to: 'in', duration: 1400 },
      { type: 'loading', id: 'filter', object: 'in', duration: 1000 },
      {
        type: 'set_content',
        object: 'in',
        content: { type: 'text', value: s.filtered },
        keep_until: 'deliver',
      },
      {
        type: 'comment',
        object: 'in',
        text: s.c4,
        duration: 2600,
      },
      {
        type: 'comment',
        object: 'bob',
        text: s.c5,
        duration: 2600,
      },
      { type: 'move', object: 'fetch', from: 'bob', to: 'in', duration: 1200 },
      {
        type: 'move',
        id: 'deliver',
        object: 'mail',
        from: 'in',
        to: 'bob',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'bob',
        text: s.received,
        duration: 2000,
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
