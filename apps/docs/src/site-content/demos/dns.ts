import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    client: 'Browser',
    resolver: 'Recursive resolver',
    root: 'Root server "."',
    tld: 'TLD ".com"',
    auth: 'Authoritative',
    qroot: 'A? www.example.com',
    rrootHeader: 'Go to TLD .com',
    rrootBody: 'NS a.gtld-servers.net',
    rtldHeader: 'Go to authoritative',
    rtldBody: 'NS ns1.example.com',
    rauthHeader: 'Authoritative response',
    rauthBody: 'A 93.184.216.34',
    answerHeader: 'Response',
    answerBody: '93.184.216.34 (TTL 3600)',
    comment1: 'The browser does not know the IP address of www.example.com',
    comment2: '1. The resolver asks a root server where to start',
    comment3: '2. The root refers to the ".com" TLD',
    comment4: "3. The TLD refers to the domain's authoritative server",
    comment5: '4. Authoritative response — the resolver caches it (TTL)',
    comment6: 'IP resolved, the browser can connect ✅',
  },
  fr: {
    client: 'Navigateur',
    resolver: 'Résolveur récursif',
    root: 'Serveur racine « . »',
    tld: 'TLD « .com »',
    auth: 'Autoritaire',
    qroot: 'A? www.exemple.com',
    rrootHeader: 'Va voir le TLD .com',
    rrootBody: 'NS a.gtld-servers.net',
    rtldHeader: 'Va voir l’autoritaire',
    rtldBody: 'NS ns1.exemple.com',
    rauthHeader: 'Réponse faisant autorité',
    rauthBody: 'A 93.184.216.34',
    answerHeader: 'Réponse',
    answerBody: '93.184.216.34 (TTL 3600)',
    comment1: 'Le navigateur ne connaît pas l’adresse IP de www.exemple.com',
    comment2: '1. Le résolveur demande à un serveur racine par où commencer',
    comment3: '2. La racine renvoie vers le TLD « .com »',
    comment4: '3. Le TLD renvoie vers le serveur autoritaire du domaine',
    comment5:
      '4. Réponse faisant autorité — le résolveur la met en cache (TTL)',
    comment6: 'IP résolue, le navigateur peut se connecter ✅',
  },
};

/**
 * Résolution DNS récursive. Le résolveur interroge tour à tour la racine, le
 * TLD puis le serveur autoritaire avant de répondre au client. La cascade
 * d'allers-retours est volontairement détaillée pour rendre la récursion
 * lisible.
 */
export const dns = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      {
        id: 'client',
        type: 'laptop',
        text: s.client,
        icon: 'firefox',
        lane: 1,
      },
      {
        id: 'resolver',
        type: 'server',
        text: s.resolver,
        icon: 'DNS',
        lane: 2,
      },
      { id: 'root', type: 'server', text: s.root, lane: 3 },
      { id: 'tld', type: 'server', text: s.tld, lane: 3 },
      { id: 'auth', type: 'server', text: s.auth, lane: 3 },
    ],
    packets: [
      {
        id: 'q',
        kind: 'http_packet',
        packet_content: { header: s.qroot },
      },
      {
        id: 'qroot',
        kind: 'http_packet',
        packet_content: { header: s.qroot },
      },
      {
        id: 'rroot',
        kind: 'http_packet',
        packet_content: {
          header: s.rrootHeader,
          body: { type: 'text', value: s.rrootBody },
        },
      },
      {
        id: 'qtld',
        kind: 'http_packet',
        packet_content: { header: s.qroot },
      },
      {
        id: 'rtld',
        kind: 'http_packet',
        packet_content: {
          header: s.rtldHeader,
          body: { type: 'text', value: s.rtldBody },
        },
      },
      {
        id: 'qauth',
        kind: 'http_packet',
        packet_content: { header: s.qroot },
      },
      {
        id: 'rauth',
        kind: 'http_packet',
        packet_content: {
          header: s.rauthHeader,
          body: { type: 'text', value: s.rauthBody },
        },
      },
      {
        id: 'answer',
        kind: 'http_packet',
        packet_content: {
          header: s.answerHeader,
          body: { type: 'text', value: s.answerBody },
        },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'client',
        text: s.comment1,
        duration: 2200,
      },
      {
        type: 'move',
        object: 'q',
        from: 'client',
        to: 'resolver',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'resolver',
        text: s.comment2,
        duration: 2400,
      },
      {
        type: 'move',
        object: 'qroot',
        from: 'resolver',
        to: 'root',
        duration: 1300,
      },
      {
        type: 'move',
        object: 'rroot',
        from: 'root',
        to: 'resolver',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'resolver',
        text: s.comment3,
        duration: 2200,
      },
      {
        type: 'move',
        object: 'qtld',
        from: 'resolver',
        to: 'tld',
        duration: 1300,
      },
      {
        type: 'move',
        object: 'rtld',
        from: 'tld',
        to: 'resolver',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'resolver',
        text: s.comment4,
        duration: 2200,
      },
      {
        type: 'move',
        object: 'qauth',
        from: 'resolver',
        to: 'auth',
        duration: 1300,
      },
      { type: 'loading', id: 'lookup', object: 'auth', duration: 800 },
      {
        type: 'move',
        object: 'rauth',
        from: 'auth',
        to: 'resolver',
        duration: 1300,
        wait_for: 'lookup',
      },
      {
        type: 'comment',
        object: 'resolver',
        text: s.comment5,
        duration: 2400,
      },
      {
        type: 'move',
        object: 'answer',
        from: 'resolver',
        to: 'client',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'client',
        text: s.comment6,
        duration: 2000,
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
