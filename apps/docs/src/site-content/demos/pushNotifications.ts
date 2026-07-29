import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    bob_device: 'Bob (sender)',
    alice_device: 'Alice (recipient)',
    app_server: 'Application Server',
    token_db: 'Tokens DB',
    fcm: 'FCM Server (Firebase)',
    body1: '{\n  "userId": "alice",\n  "fcmToken": "dQw4-eY1...kZ9"\n}',
    body2: '{\n  "to": "alice",\n  "text": "Hi Alice!"\n}',
    resHeader: '1 row',
    body3:
      '{\n  "token": "dQw4-eY1...kZ9",\n  "notification": {\n    "title": "Bob",\n    "body": "Hi Alice!"\n  }\n}',
    pushContent: '🔔 Bob: Hi Alice!',
    connText1: 'registration',
    zoneLabel: 'Infrastructure',
    comment1:
      "Phase 1 — Token registration. First and foremost, Alice's device must make its FCM token known to the application server.",
    comment2: 'Upon app launch, Alice gets a unique token from FCM.',
    comment3:
      'The server receives the token and associates it with user "alice".',
    comment4: 'The token is now persistently stored, ready to be used.',
    comment5: 'Phase 2 — Bob sends a message to Alice.',
    comment6: "The server must find the token of Alice's device to reach her.",
    comment7: 'With the token in hand, the server prepares the request to FCM.',
    comment8: 'Phase 3 — Routing via the FCM server.',
    comment9:
      "FCM identifies the device using the token and pushes the notification — even if Alice's app is closed.",
    comment10: 'Alice receives the notification: "🔔 Bob: Hi Alice!"',
  },
  fr: {
    bob_device: 'Bob (expéditeur)',
    alice_device: 'Alice (destinataire)',
    app_server: "Serveur d'application",
    token_db: 'BD des tokens',
    fcm: 'Serveur FCM (Firebase)',
    body1: '{\n  "userId": "alice",\n  "fcmToken": "dQw4-eY1...kZ9"\n}',
    body2: '{\n  "to": "alice",\n  "text": "Salut Alice !"\n}',
    resHeader: '1 ligne',
    body3:
      '{\n  "token": "dQw4-eY1...kZ9",\n  "notification": {\n    "title": "Bob",\n    "body": "Salut Alice !"\n  }\n}',
    pushContent: '🔔 Bob : Salut Alice !',
    connText1: 'enregistrement',
    zoneLabel: 'Infrastructure',
    comment1:
      "Phase 1 — Enregistrement du token. Avant tout, l'appareil d'Alice doit faire connaître son token FCM au serveur d'application.",
    comment2:
      "Au démarrage de l'app, Alice obtient un token unique auprès de FCM.",
    comment3:
      "Le serveur reçoit le token et l'associe à l'utilisateur 'alice'.",
    comment4:
      'Le token est désormais stocké de façon persistante, prêt à être utilisé.',
    comment5: 'Phase 2 — Bob envoie un message à Alice.',
    comment6:
      "Le serveur doit retrouver le token de l'appareil d'Alice pour la joindre.",
    comment7: 'Avec le token en main, le serveur prépare la requête vers FCM.',
    comment8: 'Phase 3 — Acheminement via le serveur FCM.',
    comment9:
      "FCM identifie l'appareil grâce au token et pousse la notification — même si l'app d'Alice est fermée.",
    comment10: 'Alice reçoit la notification : « 🔔 Bob : Salut Alice ! »',
  },
};

/**
 * Cycle de vie complet d'une notification push : comment l'appareil d'Alice
 * fait connaître son adresse de livraison (le token FCM), puis comment un
 * message envoyé par Bob est acheminé jusqu'à elle, même si son application
 * est fermée.
 */
export const pushNotifications = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      {
        id: 'bob_device',
        type: 'bob',
        text: s.bob_device,
        lane: 1,
        align_with: 'app_server',
      },
      {
        id: 'alice_device',
        type: 'alice',
        text: s.alice_device,
        lane: 3,
        align_with: 'app_server',
      },
      {
        id: 'token_db',
        type: 'database',
        text: s.token_db,
        icon: 'postgres',
        lane: 2,
      },
      {
        id: 'app_server',
        type: 'server',
        text: s.app_server,
        icon: 'api',
        lane: 2,
        background_color: '#3b82f6',
      },
      {
        id: 'fcm',
        type: 'cloud',
        text: s.fcm,
        icon: 'firebase',
        lane: 2,
        background_color: '#f59e0b',
      },
    ],
    packets: [
      {
        id: 'register_token',
        kind: 'http_packet',
        packet_content: {
          header: 'POST /api/devices',
          body: {
            type: 'text',
            value: s.body1,
            language: 'json',
          },
        },
      },
      {
        id: 'store_token',
        kind: 'sql_request',
        request_content:
          "INSERT INTO device_tokens (user_id, token)\nVALUES ('alice', 'dQw4-eY1...kZ9');",
      },
      {
        id: 'send_message',
        kind: 'http_packet',
        packet_content: {
          header: 'POST /api/messages',
          body: {
            type: 'text',
            value: s.body2,
            language: 'json',
          },
        },
      },
      {
        id: 'lookup_token',
        kind: 'sql_request',
        request_content:
          "SELECT token FROM device_tokens\nWHERE user_id = 'alice';",
      },
      {
        id: 'token_result',
        kind: 'sql_response',
        response_content: {
          rows: 1,
          header: s.resHeader,
          body: {
            type: 'table',
            columns: ['token'],
            rows_data: [['dQw4-eY1...kZ9']],
          },
        },
      },
      {
        id: 'fcm_request',
        kind: 'http_packet',
        packet_content: {
          header: 'POST fcm/send',
          body: {
            type: 'text',
            value: s.body3,
            language: 'json',
          },
        },
      },
      {
        id: 'push_notification',
        kind: 'http_packet',
        packet_content: {
          header: 'Push (data)',
          body: {
            type: 'text',
            value: s.pushContent,
          },
        },
      },
    ],
    connections: [
      { from: 'bob_device', to: 'app_server', style: 'solid', text: 'HTTPS' },
      { from: 'app_server', to: 'token_db', style: 'solid', text: 'SQL' },
      { from: 'app_server', to: 'fcm', style: 'solid', text: 'HTTPS' },
      { from: 'fcm', to: 'alice_device', style: 'dashed', text: 'push' },
      {
        from: 'alice_device',
        to: 'app_server',
        style: 'dotted',
        arrow_head: 'forward',
        text: s.connText1,
      },
    ],
    zones: [
      {
        id: 'zone_backend',
        contains: ['app_server', 'token_db', 'fcm'],
        color: 'steelblue',
        label: s.zoneLabel,
      },
    ],
    timeline: [
      {
        type: 'comment',
        text: s.comment1,
      },
      {
        type: 'comment',
        object: 'alice_device',
        text: s.comment2,
      },
      {
        type: 'move',
        object: 'register_token',
        from: 'alice_device',
        to: 'app_server',
        duration: 1400,
      },
      {
        type: 'comment',
        object: 'app_server',
        text: s.comment3,
      },
      {
        type: 'move',
        object: 'store_token',
        from: 'app_server',
        to: 'token_db',
        duration: 1200,
      },
      {
        type: 'loading',
        object: 'token_db',
        duration: 900,
      },
      {
        type: 'comment',
        object: 'token_db',
        text: s.comment4,
      },
      {
        type: 'comment',
        text: s.comment5,
      },
      {
        type: 'move',
        object: 'send_message',
        from: 'bob_device',
        to: 'app_server',
        duration: 1400,
      },
      {
        type: 'comment',
        object: 'app_server',
        text: s.comment6,
      },
      {
        type: 'move',
        object: 'lookup_token',
        from: 'app_server',
        to: 'token_db',
        duration: 1200,
      },
      {
        type: 'loading',
        object: 'token_db',
        duration: 800,
      },
      {
        type: 'move',
        object: 'token_result',
        from: 'token_db',
        to: 'app_server',
        duration: 1200,
      },
      {
        type: 'comment',
        object: 'app_server',
        text: s.comment7,
      },
      {
        type: 'comment',
        text: s.comment8,
      },
      {
        type: 'move',
        object: 'fcm_request',
        from: 'app_server',
        to: 'fcm',
        duration: 1400,
      },
      {
        type: 'loading',
        object: 'fcm',
        duration: 900,
      },
      {
        type: 'comment',
        object: 'fcm',
        text: s.comment9,
      },
      {
        type: 'move',
        object: 'push_notification',
        from: 'fcm',
        to: 'alice_device',
        duration: 1600,
      },
      {
        type: 'comment',
        object: 'alice_device',
        text: s.comment10,
      },
    ],
  };
};
