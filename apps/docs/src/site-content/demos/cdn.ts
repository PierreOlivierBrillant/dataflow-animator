import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    user: 'Visitor',
    edge: 'Edge Node (CDN)',
    origin: 'Origin Server',
    missFill: 'fill cache',
    originBody: 'logo.png + Cache-Control',
    hitBody: 'logo.png — served from edge',
    comment1: 'First visitor: the resource is not yet cached near them.',
    commentMiss:
      '1. Cache MISS → the edge fetches the resource from the origin',
    storeContent: '💾 cached (TTL 24h)',
    commentStore: '2. The edge stores the copy then responds to the visitor',
    comment2: 'Later, a second visitor requests the exact same resource...',
    commentHit: '3. Cache HIT ⚡ → immediate response, without touching origin',
    commentEnd: 'Latency reduced: the whole point of a CDN ✅',
    missContent: '❌ cache MISS',
  },
  fr: {
    user: 'Visiteur',
    edge: 'Nœud de bord (CDN)',
    origin: 'Serveur d’origine',
    missFill: 'au cache de remplir',
    originBody: 'logo.png + Cache-Control',
    hitBody: 'logo.png — servi du bord',
    comment1:
      'Premier visiteur : la ressource n’est pas encore en cache au plus près de lui.',
    commentMiss: '1. Cache MISS → le bord va chercher la ressource à l’origine',
    storeContent: '💾 mis en cache (TTL 24 h)',
    commentStore: '2. Le bord mémorise la copie puis répond au visiteur',
    comment2:
      'Plus tard, un second visiteur demande exactement la même ressource…',
    commentHit: '3. Cache HIT ⚡ → réponse immédiate, sans toucher l’origine',
    commentEnd: 'Latence divisée : tout l’intérêt du CDN ✅',
    missContent: '❌ cache MISS',
  },
};

/**
 * Cache d'un CDN : la même ressource est demandée deux fois. Le premier appel
 * rate le cache (cache MISS → aller jusqu'à l'origine), le second le touche
 * (cache HIT → réponse immédiate depuis le bord). Les deux phases sont bien
 * séparées pour faire ressortir le gain.
 */
export const cdn = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'user', type: 'user', text: s.user, lane: 1 },
      {
        id: 'edge',
        type: 'server',
        text: s.edge,
        icon: 'cloud',
        lane: 2,
      },
      {
        id: 'origin',
        type: 'server',
        text: s.origin,
        icon: 'nginx',
        lane: 3,
      },
    ],
    connections: [
      { from: 'user', to: 'edge', style: 'dotted' },
      { from: 'edge', to: 'origin', style: 'dotted' },
    ],
    packets: [
      {
        id: 'req1',
        kind: 'http_packet',
        packet_content: { header: 'GET /logo.png' },
      },
      {
        id: 'pull',
        kind: 'http_packet',
        packet_content: {
          header: 'GET /logo.png',
          body: { type: 'text', value: s.missFill },
        },
      },
      {
        id: 'fromOrigin',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK',
          body: { type: 'text', value: s.originBody },
        },
      },
      {
        id: 'res1',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK (MISS)',
          body: { type: 'text', value: 'logo.png' },
        },
      },
      {
        id: 'req2',
        kind: 'http_packet',
        packet_content: { header: 'GET /logo.png' },
      },
      {
        id: 'res2',
        kind: 'http_packet',
        packet_content: {
          header: '200 OK (HIT) ⚡',
          body: { type: 'text', value: s.hitBody },
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
        type: 'move',
        object: 'req1',
        from: 'user',
        to: 'edge',
        duration: 1300,
      },
      {
        type: 'set_content',
        object: 'edge',
        content: { type: 'text', value: s.missContent },
        keep_until: 'store',
      },
      {
        type: 'comment',
        object: 'edge',
        text: s.commentMiss,
        duration: 2400,
      },
      {
        type: 'move',
        object: 'pull',
        from: 'edge',
        to: 'origin',
        duration: 1300,
      },
      { type: 'loading', id: 'gen', object: 'origin', duration: 1100 },
      {
        type: 'move',
        object: 'fromOrigin',
        from: 'origin',
        to: 'edge',
        duration: 1300,
        wait_for: 'gen',
      },
      {
        type: 'set_content',
        id: 'store',
        object: 'edge',
        content: { type: 'text', value: s.storeContent },
        keep_until_end: true,
      },
      {
        type: 'comment',
        object: 'edge',
        text: s.commentStore,
        duration: 2400,
      },
      {
        type: 'move',
        object: 'res1',
        from: 'edge',
        to: 'user',
        duration: 1300,
      },
      { type: 'wait', duration: 1400 },
      {
        type: 'comment',
        text: s.comment2,
        duration: 2600,
      },
      {
        type: 'move',
        object: 'req2',
        from: 'user',
        to: 'edge',
        duration: 1300,
      },
      {
        type: 'comment',
        object: 'edge',
        text: s.commentHit,
        duration: 2600,
      },
      {
        type: 'move',
        object: 'res2',
        from: 'edge',
        to: 'user',
        duration: 1100,
      },
      {
        type: 'comment',
        object: 'user',
        text: s.commentEnd,
        duration: 2200,
      },
      { type: 'wait', duration: 1200 },
    ],
  };
};
