import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

/**
 * Poignée de main TLS 1.3 entre un navigateur et un serveur. On insiste sur
 * les allers-retours (ClientHello / ServerHello) puis sur le passage au canal
 * chiffré. Rythme posé pour bien séparer négociation et données applicatives.
 */
const strings = {
  en: {
    browser: 'Browser',
    serverHttps: 'HTTPS server',
    shelloBody: 'key_share\ncertificate\nFinished',
    finishedBody: 'handshake verified',
    getBody: 'Application Data (encrypted)',
    c1: '1. The browser offers its cipher suites and its key share (ClientHello)',
    c2: '2. The server picks the suite, sends its certificate and its key share',
    c3: '3. The browser validates the certificate and derives the session key',
    arrowText: '🔒 encrypted channel established',
    appData:
      'From here on, everything is encrypted with the session key: Application Data.',
    loaded: 'Page loaded over a secure connection ✅',
  },
  fr: {
    browser: 'Navigateur',
    serverHttps: 'Serveur HTTPS',
    shelloBody: 'key_share\ncertificat\nFinished',
    finishedBody: 'handshake vérifié',
    getBody: 'Application Data (chiffré)',
    c1: '1. Le navigateur propose ses suites de chiffrement et sa part de clé (ClientHello)',
    c2: '2. Le serveur choisit la suite, envoie son certificat et sa part de clé',
    c3: '3. Le navigateur valide le certificat et dérive la clé de session',
    arrowText: '🔒 canal chiffré établi',
    appData:
      'À partir d’ici, tout est chiffré avec la clé de session : Application Data.',
    loaded: 'Page chargée sur une connexion sécurisée ✅',
  },
};

export const tls = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      {
        id: 'client',
        type: 'laptop',
        text: s.browser,
        icon: 'chrome',
        lane: 1,
      },
      {
        id: 'server',
        type: 'server',
        text: s.serverHttps,
        icon: 'nginx',
        lane: 2,
      },
    ],
    connections: [
      { from: 'client', to: 'server', style: 'dotted', arrow_head: 'both' },
    ],
    packets: [
      {
        id: 'hello',
        kind: 'http_packet',
        packet_content: {
          header: 'ClientHello',
          body: { type: 'text', value: 'TLS 1.3\nkey_share\ncipher_suites' },
        },
      },
      {
        id: 'shello',
        kind: 'http_packet',
        packet_content: {
          header: 'ServerHello + Certificate',
          body: { type: 'text', value: s.shelloBody },
        },
      },
      {
        id: 'finished',
        kind: 'http_packet',
        packet_content: {
          header: 'Finished 🔒',
          body: { type: 'text', value: s.finishedBody },
        },
      },
      {
        id: 'get',
        kind: 'http_packet',
        packet_content: {
          header: 'GET / 🔒',
          body: { type: 'text', value: s.getBody },
        },
      },
      {
        id: 'page',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK 🔒',
          body: { type: 'text', value: '<html> … </html>' },
        },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'client',
        text: s.c1,
        duration: 2400,
      },
      {
        type: 'move',
        object: 'hello',
        from: 'client',
        to: 'server',
        duration: 1300,
      },
      { type: 'loading', object: 'server', duration: 1000 },
      {
        type: 'comment',
        object: 'server',
        text: s.c2,
        duration: 2400,
      },
      {
        type: 'move',
        object: 'shello',
        from: 'server',
        to: 'client',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'client',
        text: s.c3,
        duration: 2400,
      },
      { type: 'loading', object: 'client', duration: 1000 },
      {
        type: 'move',
        object: 'finished',
        from: 'client',
        to: 'server',
        duration: 1300,
      },
      {
        type: 'arrow',
        from: 'client',
        to: 'server',
        text: s.arrowText,
        style: 'solid',
        arrow_head: 'both',
        keep_until_end: true,
        duration: 1200,
      },
      {
        type: 'comment',
        text: s.appData,
        duration: 2600,
      },
      {
        type: 'move',
        object: 'get',
        from: 'client',
        to: 'server',
        duration: 1300,
      },
      { type: 'loading', id: 'render', object: 'server', duration: 900 },
      {
        type: 'move',
        object: 'page',
        from: 'server',
        to: 'client',
        duration: 1300,
        wait_for: 'render',
      },
      {
        type: 'comment',
        object: 'client',
        text: s.loaded,
        duration: 2000,
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
