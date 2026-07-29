import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

const strings = {
  en: {
    cand: 'Candidate (term 4)',
    f1: 'Follower',
    ackHeader: 'Vote ✅',
    comment1:
      'No news from the leader: this node times out, becomes candidate and starts a new term (term 4).',
    comment2: '1. It requests votes from all followers in parallel',
    comment3:
      '2. Three followers have not yet voted in this term: they grant their vote',
    comment4: '3. Majority reached (3 votes + its own) → it becomes leader 👑',
    candContent: '👑 LEADER — term 4',
    comment5: '4. The leader asserts its authority via regular heartbeats',
    comment6:
      'As long as heartbeats arrive, no follower triggers an election. Consensus maintained.',
  },
  fr: {
    cand: 'Candidat (mandat 4)',
    f1: 'Suiveur',
    ackHeader: 'Vote ✅',
    comment1:
      'Aucune nouvelle du leader : ce nœud expire, passe candidat et ouvre un nouveau mandat (term 4).',
    comment2: '1. Il sollicite le vote de tous les suiveurs en parallèle',
    comment3:
      '2. Trois suiveurs n’ont pas encore voté ce mandat : ils accordent leur voix',
    comment4:
      '3. Majorité atteinte (3 voix + la sienne) → il devient leader 👑',
    candContent: '👑 LEADER — term 4',
    comment5:
      '4. Le leader impose son autorité par des battements de cœur réguliers',
    comment6:
      'Tant que les battements arrivent, aucun suiveur ne déclenche d’élection. Consensus maintenu.',
  },
};

/**
 * Élection de leader dans le protocole de consensus Raft (disposition
 * circulaire). Un candidat au centre sollicite les votes des suiveurs répartis
 * autour, obtient la majorité, puis maintient son autorité par des battements
 * de cœur. Démo distribuée, hors du flux client/serveur habituel.
 */
export const raft = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'circular',
    nodes: [
      {
        id: 'cand',
        type: 'server',
        text: s.cand,
        icon: 'go',
        main: true,
      },
      { id: 'f1', type: 'server', text: s.f1, lane: 1 },
      { id: 'f2', type: 'server', text: s.f1, lane: 2 },
      { id: 'f3', type: 'server', text: s.f1, lane: 3 },
      { id: 'f4', type: 'server', text: s.f1, lane: 4 },
    ],
    packets: [
      {
        id: 'rv1',
        kind: 'http_packet',
        packet_content: {
          header: 'RequestVote',
          body: { type: 'text', value: 'term 4' },
        },
      },
      {
        id: 'rv2',
        kind: 'http_packet',
        packet_content: {
          header: 'RequestVote',
          body: { type: 'text', value: 'term 4' },
        },
      },
      {
        id: 'rv3',
        kind: 'http_packet',
        packet_content: {
          header: 'RequestVote',
          body: { type: 'text', value: 'term 4' },
        },
      },
      {
        id: 'rv4',
        kind: 'http_packet',
        packet_content: {
          header: 'RequestVote',
          body: { type: 'text', value: 'term 4' },
        },
      },
      {
        id: 'ack1',
        kind: 'http_packet',
        packet_content: { header: s.ackHeader },
      },
      {
        id: 'ack2',
        kind: 'http_packet',
        packet_content: { header: s.ackHeader },
      },
      {
        id: 'ack3',
        kind: 'http_packet',
        packet_content: { header: s.ackHeader },
      },
      {
        id: 'hb1',
        kind: 'http_packet',
        packet_content: { header: 'AppendEntries ♥' },
      },
      {
        id: 'hb2',
        kind: 'http_packet',
        packet_content: { header: 'AppendEntries ♥' },
      },
      {
        id: 'hb3',
        kind: 'http_packet',
        packet_content: { header: 'AppendEntries ♥' },
      },
      {
        id: 'hb4',
        kind: 'http_packet',
        packet_content: { header: 'AppendEntries ♥' },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'cand',
        text: s.comment1,
        duration: 2800,
      },
      {
        type: 'comment',
        object: 'cand',
        text: s.comment2,
        duration: 2200,
      },
      {
        type: 'parallel',
        duration: 1400,
        actions: [
          { type: 'move', object: 'rv1', from: 'cand', to: 'f1' },
          { type: 'move', object: 'rv2', from: 'cand', to: 'f2' },
          { type: 'move', object: 'rv3', from: 'cand', to: 'f3' },
          { type: 'move', object: 'rv4', from: 'cand', to: 'f4' },
        ],
      },
      {
        type: 'comment',
        object: 'cand',
        text: s.comment3,
        duration: 2600,
      },
      {
        type: 'parallel',
        duration: 1400,
        actions: [
          { type: 'move', object: 'ack1', from: 'f1', to: 'cand' },
          { type: 'move', object: 'ack2', from: 'f2', to: 'cand' },
          {
            type: 'move',
            object: 'ack3',
            from: 'f3',
            to: 'cand',
            delay_ms: 300,
          },
        ],
      },
      {
        type: 'comment',
        object: 'cand',
        text: s.comment4,
        duration: 2600,
      },
      {
        type: 'set_content',
        object: 'cand',
        content: { type: 'text', value: s.candContent },
        keep_until_end: true,
      },
      {
        type: 'comment',
        object: 'cand',
        text: s.comment5,
        duration: 2400,
      },
      {
        type: 'parallel',
        duration: 1400,
        actions: [
          { type: 'move', object: 'hb1', from: 'cand', to: 'f1' },
          { type: 'move', object: 'hb2', from: 'cand', to: 'f2' },
          { type: 'move', object: 'hb3', from: 'cand', to: 'f3' },
          { type: 'move', object: 'hb4', from: 'cand', to: 'f4' },
        ],
      },
      {
        type: 'comment',
        text: s.comment6,
        duration: 2800,
      },
      { type: 'wait', duration: 1400 },
    ],
  };
};
