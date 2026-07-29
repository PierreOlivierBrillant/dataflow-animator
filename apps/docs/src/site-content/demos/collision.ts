import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    app: 'Application',
    db: 'Database',
    ackHeader: '1 row inserted',
    rowsHeader: '42 rows',
    comment1:
      'Traffic flows in both directions on the same App ↔ DB link, at the same time.',
    comment2:
      'The two packets do not overlap: they take offset parallel lanes.',
    comment3:
      'The offset direction is deterministic (identifier order), thus stable when scrubbing.',
    arrowWrite: 'write',
    arrowRead: 'read',
  },
  fr: {
    app: 'Application',
    db: 'Base de données',
    ackHeader: '1 ligne insérée',
    rowsHeader: '42 lignes',
    comment1:
      'Du trafic circule dans les deux sens sur la même liaison App ↔ BD, en même temps.',
    comment2:
      'Les deux paquets ne se chevauchent pas : ils empruntent des voies parallèles décalées.',
    comment3:
      'Le sens du décalage est déterministe (ordre des identifiants), donc stable au scrubbing.',
    arrowWrite: 'écriture',
    arrowRead: 'lecture',
  },
};

/**
 * Démo de l'anti-collision (référencée par la page « Connexions &
 * anti-collision »). Le segment App ↔ BD est emprunté dans les deux sens en
 * même temps : le moteur décale automatiquement les deux trajets sur des voies
 * parallèles plutôt que de les superposer.
 */
export const collision = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'app', type: 'server', text: s.app, icon: 'node', lane: 1 },
      {
        id: 'db',
        type: 'database',
        text: s.db,
        icon: 'postgres',
        lane: 2,
      },
    ],
    connections: [
      { from: 'app', to: 'db', arrow_head: 'both', style: 'dashed' },
    ],
    packets: [
      {
        id: 'write',
        kind: 'sql_request',
        request_content: 'INSERT INTO events …',
      },
      {
        id: 'ack',
        kind: 'sql_response',
        response_content: { rows: 1, header: s.ackHeader },
      },
      {
        id: 'read',
        kind: 'sql_request',
        request_content: 'SELECT * FROM events',
      },
      {
        id: 'rows',
        kind: 'sql_response',
        response_content: { rows: 42, header: s.rowsHeader },
      },
    ],
    timeline: [
      {
        type: 'comment',
        text: s.comment1,
        duration: 2800,
      },
      {
        type: 'parallel',
        duration: 1800,
        actions: [
          { type: 'move', object: 'write', from: 'app', to: 'db' },
          { type: 'move', object: 'read', from: 'db', to: 'app' },
        ],
      },
      {
        type: 'comment',
        text: s.comment2,
        duration: 2800,
      },
      {
        type: 'parallel',
        duration: 1800,
        actions: [
          { type: 'move', object: 'ack', from: 'db', to: 'app' },
          { type: 'move', object: 'rows', from: 'app', to: 'db' },
        ],
      },
      {
        type: 'comment',
        text: s.comment3,
        duration: 2800,
      },
      {
        type: 'parallel',
        duration: 1400,
        actions: [
          {
            type: 'arrow',
            from: 'app',
            to: 'db',
            text: s.arrowWrite,
            style: 'solid',
            keep_until_end: true,
          },
          {
            type: 'arrow',
            from: 'db',
            to: 'app',
            text: s.arrowRead,
            style: 'solid',
            keep_until_end: true,
          },
        ],
      },
      { type: 'wait', duration: 1400 },
    ],
  };
};
