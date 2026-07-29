import type { Action, DataFlowSpec, Packet } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

/**
 * Denial of Service (DoS) from a SINGLE source. One attacker machine floods the
 * target with a burst of requests until it saturates and can no longer serve a
 * legitimate user. The flood is generated programmatically: many packets sent
 * almost at once along the same path, finely staggered so they read as a dense
 * wall of traffic rather than a single blob. Pedagogical counterpoint to the
 * `ddos` demo — here the traffic comes from one IP, so it stays blockable.
 */
const strings = {
  en: {
    attacker: 'Attacker',
    user: 'Legitimate user',
    server: 'Web server',
    normalComment: 'Normally, the server answers each request in a few ms.',
    legitReq: 'GET /home',
    ok200: '200 OK',
    served: 'Served ✅',
    floodComment:
      'The attacker launches a flood: thousands of requests per second from a single machine.',
    saturatedComment:
      'The request queue overflows: CPU and sockets are exhausted, the server can no longer keep up.',
    down: '🛑 503\nService unavailable',
    deniedComment:
      'The legitimate user no longer gets any answer: the service is denied.',
    timeout: '⏳ Timeout…',
    endComment:
      'All the traffic comes from a single IP: it can be identified and blocked. That is the weakness this attack — and the strength of a DDoS.',
  },
  fr: {
    attacker: 'Attaquant',
    user: 'Utilisateur légitime',
    server: 'Serveur Web',
    normalComment:
      'Normalement, le serveur répond à chaque requête en quelques ms.',
    legitReq: 'GET /home',
    ok200: '200 OK',
    served: 'Servi ✅',
    floodComment:
      'L’attaquant lance un flood : des milliers de requêtes par seconde depuis une seule machine.',
    saturatedComment:
      'La file de requêtes déborde : CPU et sockets sont épuisés, le serveur ne suit plus.',
    down: '🛑 503\nService indisponible',
    deniedComment:
      'L’utilisateur légitime n’obtient plus aucune réponse : le service lui est refusé.',
    timeout: '⏳ Délai dépassé…',
    endComment:
      'Tout le trafic vient d’une seule IP : on peut l’identifier et la bloquer. C’est la faiblesse de cette attaque — et la force d’un DDoS.',
  },
};

/** Number of requests in the flood burst (single source). */
const FLOOD = 16;

export const dos = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];

  // Generate the flood: many tiny GET packets fired from the attacker, finely
  // staggered (delay_ms) so they overlap on the wire as a dense barrage.
  const floodPackets: Packet[] = Array.from({ length: FLOOD }, (_, i) => ({
    id: `f${i}`,
    kind: 'http_packet',
    packet_content: { header: 'GET /' },
  }));

  const floodMoves: Action[] = floodPackets.map((p, i) => ({
    type: 'move',
    object: p.id,
    from: 'attacker',
    to: 'server',
    duration: 650,
    delay_ms: i * 45,
    fade_in_ms: 0,
    fade_out_ms: 120,
  }));

  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'attacker', type: 'eve', text: s.attacker, lane: 1 },
      { id: 'user', type: 'user', text: s.user, lane: 1 },
      { id: 'server', type: 'server', text: s.server, icon: 'nginx', lane: 2 },
    ],
    connections: [
      { from: 'user', to: 'server', style: 'dotted', arrow_head: 'both' },
      { from: 'attacker', to: 'server', style: 'dotted' },
    ],
    packets: [
      ...floodPackets,
      {
        id: 'legit',
        kind: 'http_packet',
        packet_content: { header: s.legitReq },
      },
      {
        id: 'resp',
        kind: 'http_packet',
        packet_content: { header: s.ok200 },
      },
      {
        id: 'legit2',
        kind: 'http_packet',
        packet_content: { header: s.legitReq },
      },
    ],
    timeline: [
      // 1. Baseline: the service works for a legitimate user.
      {
        type: 'comment',
        object: 'user',
        text: s.normalComment,
        duration: 2400,
      },
      {
        type: 'move',
        object: 'legit',
        from: 'user',
        to: 'server',
        duration: 800,
      },
      { type: 'loading', id: 'work', object: 'server', duration: 700 },
      {
        type: 'move',
        object: 'resp',
        from: 'server',
        to: 'user',
        duration: 800,
        wait_for: 'work',
      },
      {
        type: 'comment',
        object: 'user',
        text: s.served,
        duration: 1400,
      },
      // 2. The attack: a flood from a single machine, server struggling in parallel.
      {
        type: 'comment',
        object: 'attacker',
        text: s.floodComment,
        duration: 2800,
      },
      {
        type: 'parallel',
        actions: [
          ...floodMoves,
          { type: 'loading', object: 'server', keep_until: 'down' },
        ],
      },
      {
        type: 'comment',
        object: 'server',
        text: s.saturatedComment,
        duration: 2800,
      },
      {
        id: 'down',
        type: 'set_content',
        object: 'server',
        content: { type: 'text', value: s.down },
        keep_until_end: true,
      },
      // 3. The legitimate user is now denied service.
      {
        type: 'comment',
        object: 'user',
        text: s.deniedComment,
        duration: 2600,
      },
      {
        type: 'move',
        object: 'legit2',
        from: 'user',
        to: 'server',
        duration: 800,
      },
      {
        type: 'parallel',
        duration: 2000,
        actions: [
          { type: 'loading', object: 'user' },
          {
            type: 'comment',
            object: 'user',
            text: s.timeout,
            keep_until_next: true,
          },
        ],
      },
      {
        type: 'comment',
        text: s.endComment,
        duration: 3200,
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
