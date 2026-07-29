import type { Action, DataFlowSpec, Packet } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

/**
 * Mitigation of a single-source DoS with per-IP RATE LIMITING. A reverse proxy
 * counts requests per client: beyond the threshold it answers 429 itself,
 * without ever bothering the backend. The flood (generated programmatically and
 * finely staggered) hits the proxy as a dense wall and is absorbed there; the
 * legitimate user, staying under the limit, keeps being served during the
 * attack. Counterpart to the `dos` demo. Its own limit — a DISTRIBUTED attack
 * whose IPs each stay under the cap — is what the `scrubbing` demo addresses.
 */
const strings = {
  en: {
    attacker: 'Attacker',
    user: 'Legitimate user',
    proxy: '🛡️ Reverse proxy',
    app: 'App server',
    introComment:
      'A reverse proxy caps how many requests each IP may send. Past the limit, it answers 429 itself — the backend never sees the flood.',
    floodComment:
      'The attacker floods from a single IP: every request lands on the proxy.',
    blockComment:
      'Same source IP, over the quota: the proxy drops the excess and replies 429 Too Many Requests.',
    limited: '🛡️ 429\nrate-limited',
    reject: '429 Too Many',
    protectedComment:
      'The backend stays healthy: the flood was stopped at the edge, it never reached the app.',
    healthy: '🟢 OK',
    legitReq: 'GET /home',
    ok200: '200 OK',
    servedComment:
      'The legitimate user, well under the limit, is still served normally during the attack.',
    endComment:
      'Per-IP rate limiting absorbs a single-source flood. Its weak spot: an attack spread over thousands of IPs, each below the quota — that is the job of an upstream scrubbing layer.',
  },
  fr: {
    attacker: 'Attaquant',
    user: 'Utilisateur légitime',
    proxy: '🛡️ Reverse proxy',
    app: 'Serveur applicatif',
    introComment:
      'Un reverse proxy plafonne le nombre de requêtes par IP. Au-delà de la limite, il répond 429 lui-même — le backend ne voit jamais le flood.',
    floodComment:
      'L’attaquant inonde depuis une seule IP : chaque requête arrive sur le proxy.',
    blockComment:
      'Même IP source, au-dessus du quota : le proxy jette le surplus et répond 429 Too Many Requests.',
    limited: '🛡️ 429\ndébit limité',
    reject: '429 Too Many',
    protectedComment:
      'Le backend reste sain : le flood a été stoppé en bordure, il n’a jamais atteint l’app.',
    healthy: '🟢 OK',
    legitReq: 'GET /home',
    ok200: '200 OK',
    servedComment:
      'L’utilisateur légitime, bien en deçà de la limite, reste servi normalement pendant l’attaque.',
    endComment:
      'La limitation par IP absorbe un flood mono-source. Son point faible : une attaque répartie sur des milliers d’IP, chacune sous le quota — c’est le rôle d’une couche de nettoyage en amont.',
  },
};

/** Number of requests in the single-source flood. */
const FLOOD = 16;
/** How many 429 rejections bounce back (representative subset of the flood). */
const REJECTS = 4;

export const rateLimit = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];

  // The flood: tiny GET packets fired from the attacker to the proxy, finely
  // staggered so they overlap on the wire as a dense barrage, then absorbed
  // (fade_out) on arrival — they never get forwarded to the app.
  const floodPackets: Packet[] = Array.from({ length: FLOOD }, (_, i) => ({
    id: `f${i}`,
    kind: 'http_packet',
    packet_content: { header: 'GET /' },
  }));

  const floodMoves: Action[] = floodPackets.map((p, i) => ({
    type: 'move',
    object: p.id,
    from: 'attacker',
    to: 'proxy',
    duration: 650,
    delay_ms: i * 45,
    fade_in_ms: 0,
    fade_out_ms: 120,
  }));

  const rejectPackets: Packet[] = Array.from({ length: REJECTS }, (_, i) => ({
    id: `r${i}`,
    kind: 'http_packet',
    packet_content: { header: s.reject },
  }));

  const rejectMoves: Action[] = rejectPackets.map((p, i) => ({
    type: 'move',
    object: p.id,
    from: 'proxy',
    to: 'attacker',
    duration: 650,
    delay_ms: i * 120,
    fade_out_ms: 120,
  }));

  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'attacker', type: 'eve', text: s.attacker, lane: 1 },
      { id: 'user', type: 'user', text: s.user, lane: 1 },
      { id: 'proxy', type: 'server', text: s.proxy, icon: 'nginx', lane: 2 },
      { id: 'app', type: 'server', text: s.app, icon: 'node', lane: 3 },
    ],
    connections: [
      { from: 'user', to: 'proxy', style: 'dotted', arrow_head: 'both' },
      { from: 'attacker', to: 'proxy', style: 'dotted', arrow_head: 'both' },
      { from: 'proxy', to: 'app', style: 'dotted', arrow_head: 'both' },
    ],
    packets: [
      ...floodPackets,
      ...rejectPackets,
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
        duration: 3200,
      },
      // 1. The flood hits the proxy.
      {
        type: 'comment',
        object: 'attacker',
        text: s.floodComment,
        duration: 2600,
      },
      {
        type: 'parallel',
        actions: [
          ...floodMoves,
          { type: 'loading', object: 'proxy', keep_until: 'limited' },
        ],
      },
      // 2. The proxy rate-limits: 429 back, nothing forwarded.
      {
        type: 'comment',
        object: 'proxy',
        text: s.blockComment,
        duration: 2800,
      },
      {
        id: 'limited',
        type: 'set_content',
        object: 'proxy',
        content: { type: 'text', value: s.limited },
        keep_until: 'served',
      },
      { type: 'parallel', actions: rejectMoves },
      {
        type: 'comment',
        object: 'app',
        text: s.protectedComment,
        duration: 2800,
      },
      // 3. The legitimate user, under the limit, is still served.
      {
        type: 'comment',
        object: 'user',
        text: s.servedComment,
        duration: 2800,
      },
      {
        type: 'move',
        object: 'legit',
        from: 'user',
        to: 'proxy',
        duration: 700,
      },
      { type: 'move', object: 'fwd', from: 'proxy', to: 'app', duration: 700 },
      { type: 'loading', id: 'appwork', object: 'app', duration: 600 },
      {
        type: 'move',
        object: 'resp',
        from: 'app',
        to: 'proxy',
        duration: 700,
        wait_for: 'appwork',
      },
      {
        id: 'served',
        type: 'move',
        object: 'resp2',
        from: 'proxy',
        to: 'user',
        duration: 700,
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
