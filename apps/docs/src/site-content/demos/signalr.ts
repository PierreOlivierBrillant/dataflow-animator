import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    client1: 'Client 1',
    client2: 'Client 2',
    client3: 'Client 3',
    hub: 'SignalR Hub',
    sendHeader: 'SendMessage("Hi")',
    comment1: '1. The client asks the server to open a connection',
    comment2: '2. Connection established',
    comment3:
      'Two other clients have already initiated their connection to the hub',
    comment4: '3. The client sends a message',
    comment5: '4. Clients.All: the hub broadcasts to all connected clients',
  },
  fr: {
    client1: 'Client 1',
    client2: 'Client 2',
    client3: 'Client 3',
    hub: 'SignalR Hub',
    sendHeader: 'SendMessage("Salut")',
    comment1: '1. Le client demande au serveur pour ouvrir une connexion',
    comment2: '2. Connexion établie',
    comment3: 'Deux autres clients ont déjà initié leur connexion au hub',
    comment4: '3. Le client envoie un message',
    comment5: '4. Clients.All : le hub diffuse à tous les clients connectés',
  },
};

export const signalr = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'circular',
    nodes: [
      {
        id: 'client1',
        type: 'laptop',
        text: s.client1,
        icon: 'react',
      },
      {
        id: 'client2',
        type: 'laptop',
        text: s.client2,
        icon: 'react',
        // Révélés plus tard : ils ont déjà ouvert leur connexion hors-champ.
        visible: false,
      },
      {
        id: 'client3',
        type: 'laptop',
        text: s.client3,
        icon: 'react',
        visible: false,
      },
      {
        id: 'hub',
        type: 'server',
        text: s.hub,
        icon: 'csharp',
        main: true,
      },
    ],
    packets: [
      {
        id: 'handshake',
        kind: 'http_packet',
        packet_content: { header: 'WebSocket ⇄' },
      },
      {
        id: 'send',
        kind: 'http_packet',
        packet_content: { header: s.sendHeader },
      },
      // Une copie de ReceiveMessage par destinataire : le SendAll les diffuse
      // simultanément, donc trois paquets distincts (un paquet ne peut être
      // qu'à un seul endroit à la fois).
      {
        id: 'recv1',
        kind: 'http_packet',
        packet_content: { header: 'ReceiveMessage' },
      },
      {
        id: 'recv2',
        kind: 'http_packet',
        packet_content: { header: 'ReceiveMessage' },
      },
      {
        id: 'recv3',
        kind: 'http_packet',
        packet_content: { header: 'ReceiveMessage' },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'client1',
        text: s.comment1,
        duration: 1500,
      },
      {
        type: 'set_content',
        id: 'clientCode',
        object: 'client1',
        content: {
          type: 'code',
          language: 'typescript',
          value:
            'const conn = new HubConnectionBuilder()\n  .withUrl("/chatHub").build();\nconn.on("ReceiveMessage", render);\nawait conn.start();',
        },
        keep_until: 'end',
      },
      {
        type: 'move',
        object: 'handshake',
        from: 'client1',
        to: 'hub',
        duration: 1500,
      },
      {
        type: 'parallel',
        duration: 1500,
        actions: [
          {
            type: 'comment',
            object: 'hub',
            text: s.comment2,
          },
          {
            type: 'arrow',
            from: 'client1',
            to: 'hub',
            style: 'dashed',
            keep_until_end: true,
          },
          {
            type: 'arrow',
            from: 'hub',
            to: 'client1',
            style: 'dashed',
            keep_until_end: true,
          },
        ],
      },
      {
        type: 'set_content',
        id: 'hubCode',
        object: 'hub',
        content: {
          type: 'code',
          language: 'csharp',
          value:
            'public async Task SendMessage(string m) =>\n  await Clients.All\n    .SendAsync("ReceiveMessage", m);',
        },
        keep_until: 'end',
      },
      {
        // On dévoile les deux autres clients : ils sont déjà connectés au hub
        // (connexions tracées d'emblée), prêts à recevoir la diffusion.
        type: 'parallel',
        duration: 1800,
        actions: [
          {
            type: 'comment',
            text: s.comment3,
          },
          { type: 'set_visible', object: 'client2', visible: true },
          { type: 'set_visible', object: 'client3', visible: true },
          {
            type: 'arrow',
            from: 'client2',
            to: 'hub',
            style: 'dashed',
            keep_until_end: true,
          },
          {
            type: 'arrow',
            from: 'hub',
            to: 'client2',
            style: 'dashed',
            keep_until_end: true,
          },
          {
            type: 'arrow',
            from: 'client3',
            to: 'hub',
            style: 'dashed',
            keep_until_end: true,
          },
          {
            type: 'arrow',
            from: 'hub',
            to: 'client3',
            style: 'dashed',
            keep_until_end: true,
          },
        ],
      },
      {
        type: 'comment',
        object: 'client1',
        text: s.comment4,
        duration: 500,
      },
      {
        type: 'move',
        object: 'send',
        from: 'client1',
        to: 'hub',
        duration: 800,
      },
      {
        type: 'comment',
        object: 'hub',
        text: s.comment5,
        duration: 500,
      },
      {
        // SendAll : un même message part vers les trois clients simultanément.
        type: 'parallel',
        id: 'end',
        duration: 800,
        actions: [
          { type: 'move', object: 'recv1', from: 'hub', to: 'client1' },
          { type: 'move', object: 'recv2', from: 'hub', to: 'client2' },
          { type: 'move', object: 'recv3', from: 'hub', to: 'client3' },
        ],
      },
    ],
  };
};
