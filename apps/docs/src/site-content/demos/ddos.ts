import type { Action, DataFlowSpec, Packet } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

/**
 * Distributed Denial of Service (DDoS). A command-and-control server (C&C)
 * orders a botnet of compromised machines to attack a target; all the bots then
 * flood the server SIMULTANEOUSLY. The flood is generated programmatically:
 * each bot fires a burst of requests, the bursts are interleaved (delay_ms) so
 * the streams converge on the target as a single overwhelming wall of traffic.
 * Counterpoint to the `dos` demo — here the traffic is spread across many IPs,
 * which is exactly what makes a DDoS so hard to block.
 */
const strings = {
  en: {
    cnc: 'C&C server',
    bot: 'Bot',
    user: 'Legitimate user',
    server: 'Web server',
    cmd: 'attack target',
    commandComment:
      'The command-and-control server (C&C) orders the whole botnet to attack the target.',
    floodComment:
      'On cue, every bot floods the server at the same time: the requests converge from everywhere at once.',
    saturatedComment:
      'Hundreds of thousands of requests pile up: bandwidth and server are saturated.',
    down: '🛑 503\nService unavailable',
    deniedComment:
      'Drowned in the flood, the legitimate user gets no answer: denial of service.',
    legitReq: 'GET /home',
    timeout: '⏳ Timeout…',
    endComment:
      'The traffic comes from thousands of distinct IPs: you cannot just block one address. That is what makes a DDoS so formidable.',
  },
  fr: {
    cnc: 'Serveur C&C',
    bot: 'Bot',
    user: 'Utilisateur légitime',
    server: 'Serveur Web',
    cmd: 'attaque la cible',
    commandComment:
      'Le serveur de commande (C&C) ordonne à tout le botnet d’attaquer la cible.',
    floodComment:
      'Au signal, tous les bots inondent le serveur en même temps : les requêtes convergent de partout à la fois.',
    saturatedComment:
      'Des centaines de milliers de requêtes s’accumulent : la bande passante et le serveur sont saturés.',
    down: '🛑 503\nService indisponible',
    deniedComment:
      'Noyé sous le flood, l’utilisateur légitime n’obtient aucune réponse : déni de service.',
    legitReq: 'GET /home',
    timeout: '⏳ Délai dépassé…',
    endComment:
      'Le trafic vient de milliers d’IP distinctes : impossible de bloquer une seule adresse. C’est ce qui rend un DDoS si redoutable.',
  },
};

/** Botnet size and how many requests each bot fires. */
const BOTS = 5;
const PER_BOT = 6;
const botIds = Array.from({ length: BOTS }, (_, b) => `bot${b}`);

export const ddos = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];

  // One short command packet per bot (C&C → bot fan-out).
  const commandPackets: Packet[] = botIds.map((id) => ({
    id: `cmd-${id}`,
    kind: 'http_packet',
    packet_content: { header: s.cmd },
  }));

  const commandMoves: Action[] = botIds.map((id, b) => ({
    type: 'move',
    object: `cmd-${id}`,
    from: 'cnc',
    to: id,
    duration: 900,
    delay_ms: b * 70,
  }));

  // The flood: each bot fires PER_BOT requests. Bursts are interleaved so the
  // streams converge on the target at the same time (the simultaneity is the
  // whole point of the animation).
  const floodPackets: Packet[] = botIds.flatMap((id) =>
    Array.from({ length: PER_BOT }, (_, i) => ({
      id: `${id}-g${i}`,
      kind: 'http_packet' as const,
      packet_content: { header: 'GET /' },
    }))
  );

  const floodMoves: Action[] = botIds.flatMap((id, b) =>
    Array.from(
      { length: PER_BOT },
      (_, i): Action => ({
        type: 'move',
        object: `${id}-g${i}`,
        from: id,
        to: 'server',
        duration: 850,
        delay_ms: b * 60 + i * 110,
        fade_in_ms: 0,
        fade_out_ms: 120,
      })
    )
  );

  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'cnc', type: 'eve', text: s.cnc, lane: 1 },
      { id: 'user', type: 'user', text: s.user, lane: 1 },
      ...botIds.map((id): DataFlowSpec['nodes'][number] => ({
        id,
        type: 'desktop',
        text: s.bot,
        lane: 2,
      })),
      { id: 'server', type: 'server', text: s.server, icon: 'nginx', lane: 3 },
    ],
    connections: [
      ...botIds.map((id): NonNullable<DataFlowSpec['connections']>[number] => ({
        from: 'cnc',
        to: id,
        style: 'dotted',
      })),
      ...botIds.map((id): NonNullable<DataFlowSpec['connections']>[number] => ({
        from: id,
        to: 'server',
        style: 'dotted',
      })),
      { from: 'user', to: 'server', style: 'dotted', arrow_head: 'both' },
    ],
    packets: [
      ...commandPackets,
      ...floodPackets,
      {
        id: 'legit',
        kind: 'http_packet',
        packet_content: { header: s.legitReq },
      },
    ],
    timeline: [
      // 1. The C&C wakes the botnet.
      {
        type: 'comment',
        object: 'cnc',
        text: s.commandComment,
        duration: 3000,
      },
      { type: 'parallel', duration: 1100, actions: commandMoves },
      // 2. The flood: every bot hits the target at once, server struggling.
      {
        type: 'comment',
        text: s.floodComment,
        duration: 3000,
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
      // 3. The legitimate user is drowned out.
      {
        type: 'comment',
        object: 'user',
        text: s.deniedComment,
        duration: 2800,
      },
      {
        type: 'move',
        object: 'legit',
        from: 'user',
        to: 'server',
        duration: 900,
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
        duration: 3400,
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
