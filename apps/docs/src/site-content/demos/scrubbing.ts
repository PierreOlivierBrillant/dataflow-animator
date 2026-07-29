import type { Action, DataFlowSpec, Packet } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

/**
 * Mitigation of a DDoS with an edge SCRUBBING CENTER (the model of managed
 * anti-DDoS services: Cloudflare, Akamai…). All traffic is routed through a
 * high-capacity filtering layer that absorbs the volumetric flood and drops
 * malicious requests; only clean traffic is forwarded to the origin, which
 * never sees the attack. The botnet flood (generated programmatically, finely
 * staggered) converges on the scrubber as a dense wall and is filtered out
 * there, while the single legitimate request, mixed into the flood, is
 * recognized and forwarded. Counterpart to the `ddos` demo.
 */
const strings = {
  en: {
    bot: 'Bot',
    user: 'Legitimate user',
    scrub: '🛡️ Scrubbing center',
    origin: 'Origin server',
    introComment:
      'All traffic is routed through a scrubbing center: a high-capacity edge that absorbs the flood and filters out malicious requests before the origin.',
    floodComment:
      'The botnet flood and one legitimate request reach the scrubber together — convergence of thousands of sources.',
    filterComment:
      'The scrubber absorbs the volume and drops the bot traffic (behavioral analysis, challenges); only the clean request survives.',
    filtering: '🛡️ filtering\nbots dropped',
    forwardComment:
      'Only the legitimate, scrubbed traffic is forwarded to the origin.',
    legitReq: 'GET /home',
    ok200: '200 OK',
    healthy: '🟢 OK',
    healthyComment:
      'The origin only ever sees clean traffic: it stays up, the user is served.',
    endComment:
      'Distributed edge capacity (Anycast) absorbs the volume, and filtering drops the bots: the origin never faces the attack. This is how managed DDoS protection works.',
  },
  fr: {
    bot: 'Bot',
    user: 'Utilisateur légitime',
    scrub: '🛡️ Centre de nettoyage',
    origin: 'Serveur d’origine',
    introComment:
      'Tout le trafic transite par un centre de nettoyage : une bordure à très grande capacité qui absorbe le flood et filtre les requêtes malveillantes avant l’origine.',
    floodComment:
      'Le flood du botnet et une requête légitime atteignent le scrubber ensemble — convergence de milliers de sources.',
    filterComment:
      'Le scrubber absorbe le volume et jette le trafic des bots (analyse comportementale, défis) ; seule la requête saine survit.',
    filtering: '🛡️ filtrage\nbots rejetés',
    forwardComment:
      'Seul le trafic légitime, nettoyé, est transmis à l’origine.',
    legitReq: 'GET /home',
    ok200: '200 OK',
    healthy: '🟢 OK',
    healthyComment:
      'L’origine ne voit que du trafic propre : elle reste debout, l’utilisateur est servi.',
    endComment:
      'La capacité distribuée en bordure (Anycast) absorbe le volume, et le filtrage jette les bots : l’origine n’affronte jamais l’attaque. C’est ainsi qu’opère une protection DDoS managée.',
  },
};

/** Botnet size and how many requests each bot fires. */
const BOTS = 4;
const PER_BOT = 7;
const botIds = Array.from({ length: BOTS }, (_, b) => `bot${b}`);

export const scrubbing = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];

  // The flood: each bot fires PER_BOT requests at the scrubber. Bursts are
  // interleaved (delay_ms) so the streams converge at the same time, then are
  // absorbed (fade_out) on arrival — none of it is forwarded to the origin.
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
        to: 'scrub',
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
      ...botIds.map((id): DataFlowSpec['nodes'][number] => ({
        id,
        type: 'desktop',
        text: s.bot,
        lane: 1,
      })),
      { id: 'user', type: 'user', text: s.user, lane: 1 },
      { id: 'scrub', type: 'cloud', text: s.scrub, lane: 2 },
      { id: 'origin', type: 'server', text: s.origin, icon: 'node', lane: 3 },
    ],
    connections: [
      ...botIds.map((id): NonNullable<DataFlowSpec['connections']>[number] => ({
        from: id,
        to: 'scrub',
        style: 'dotted',
      })),
      { from: 'user', to: 'scrub', style: 'dotted', arrow_head: 'both' },
      { from: 'scrub', to: 'origin', style: 'dotted', arrow_head: 'both' },
    ],
    packets: [
      ...floodPackets,
      {
        id: 'legit',
        kind: 'http_packet',
        packet_content: { header: s.legitReq },
      },
      {
        id: 'fwd',
        kind: 'http_packet',
        packet_content: { header: s.legitReq },
      },
      { id: 'resp', kind: 'http_packet', packet_content: { header: s.ok200 } },
      {
        id: 'resp2',
        kind: 'http_packet',
        packet_content: { header: s.ok200 },
      },
    ],
    timeline: [
      {
        type: 'comment',
        text: s.introComment,
        duration: 3400,
      },
      // 1. Flood + one legitimate request converge on the scrubber.
      {
        type: 'comment',
        text: s.floodComment,
        duration: 2800,
      },
      {
        type: 'parallel',
        actions: [
          ...floodMoves,
          {
            type: 'move',
            object: 'legit',
            from: 'user',
            to: 'scrub',
            duration: 900,
            delay_ms: 700,
            fade_out_ms: 0,
            keep_until: 'forward',
          },
          { type: 'loading', object: 'scrub', keep_until: 'filtering' },
        ],
      },
      // 2. The scrubber drops the bot traffic, keeps the clean request.
      {
        type: 'comment',
        object: 'scrub',
        text: s.filterComment,
        duration: 3000,
      },
      {
        id: 'filtering',
        type: 'set_content',
        object: 'scrub',
        content: { type: 'text', value: s.filtering },
        keep_until_end: true,
      },
      // 3. Only the clean request is forwarded; the origin stays healthy.
      {
        type: 'comment',
        object: 'origin',
        text: s.forwardComment,
        duration: 2600,
      },
      {
        id: 'forward',
        type: 'move',
        object: 'fwd',
        from: 'scrub',
        to: 'origin',
        duration: 800,
      },
      { type: 'loading', id: 'originwork', object: 'origin', duration: 600 },
      {
        type: 'set_content',
        object: 'origin',
        content: { type: 'text', value: s.healthy },
        keep_until_end: true,
        wait_for: 'originwork',
      },
      {
        type: 'move',
        object: 'resp',
        from: 'origin',
        to: 'scrub',
        duration: 800,
        wait_for: 'originwork',
      },
      {
        type: 'move',
        object: 'resp2',
        from: 'scrub',
        to: 'user',
        duration: 800,
      },
      {
        type: 'comment',
        object: 'user',
        text: s.healthyComment,
        duration: 2800,
      },
      {
        type: 'comment',
        text: s.endComment,
        duration: 3600,
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
