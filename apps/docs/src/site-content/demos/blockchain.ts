import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

/**
 * Cycle de vie d'une transaction sur une blockchain à preuve de travail. La
 * transaction signée rejoint le mempool, plusieurs mineurs entrent en
 * compétition, l'un trouve le bloc et le diffuse au réseau. Démo « hors web »
 * volontairement étalée pour bien voir la compétition puis la confirmation.
 */
const strings = {
  en: {
    wallet: 'Wallet',
    minerA: 'Miner A',
    minerB: 'Miner B',
    minerC: 'Miner C',
    chain: 'Blockchain',
    txHeader: 'signed tx',
    txBody: '0.5 ₿ → Bob\nfee 0.0002 ₿',
    blockHeader: 'block #842,317',
    blockBody: 'nonce found · hash 0000a3f…',
    newBlock: 'new block',
    waiting: '⏳ waiting to be mined',
    included: '✅ included in block',
    c1: '1. The wallet signs a transaction and broadcasts it to the network',
    c2: '2. The transaction joins the mempool: all miners pick it up',
    c3: '3. Miners search in parallel for a valid nonce (proof of work).',
    c4: '4. Miner B finds the nonce first and forges the block 🎉',
    c5: '5. The block is added; B propagates it to the other nodes, which verify it',
    cEnd: 'As further blocks are mined, the transaction accumulates confirmations.',
  },
  fr: {
    wallet: 'Portefeuille',
    minerA: 'Mineur A',
    minerB: 'Mineur B',
    minerC: 'Mineur C',
    chain: 'Chaîne de blocs',
    txHeader: 'tx signée',
    txBody: '0,5 ₿ → Bob\nfrais 0,0002 ₿',
    blockHeader: 'bloc #842 317',
    blockBody: 'nonce trouvé · hash 0000a3f…',
    newBlock: 'nouveau bloc',
    waiting: '⏳ en attente de minage',
    included: '✅ incluse au bloc',
    c1: '1. Le portefeuille signe une transaction et la diffuse au réseau',
    c2: '2. La transaction rejoint le mempool : tous les mineurs la récupèrent',
    c3: '3. Les mineurs cherchent en parallèle un nonce valide (preuve de travail).',
    c4: '4. Le mineur B trouve le nonce le premier et forge le bloc 🎉',
    c5: '5. Le bloc est ajouté ; B le propage aux autres nœuds, qui le vérifient',
    cEnd: 'Au fil des blocs suivants, la transaction accumule des confirmations.',
  },
};

export const blockchain = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'left-to-right',
    nodes: [
      { id: 'wallet', type: 'mobile', text: s.wallet, lane: 1 },
      { id: 'mempool', type: 'server', text: 'Mempool', lane: 2 },
      { id: 'm1', type: 'desktop', text: s.minerA, lane: 3 },
      { id: 'm2', type: 'desktop', text: s.minerB, lane: 3 },
      { id: 'm3', type: 'desktop', text: s.minerC, lane: 3 },
      { id: 'chain', type: 'database', text: s.chain, lane: 4 },
    ],
    connections: [
      { from: 'wallet', to: 'mempool', style: 'dotted' },
      { from: 'mempool', to: 'm1', style: 'dotted' },
      { from: 'mempool', to: 'm2', style: 'dotted' },
      { from: 'mempool', to: 'm3', style: 'dotted' },
      { from: 'm2', to: 'chain', style: 'dotted' },
    ],
    packets: [
      {
        id: 'tx',
        kind: 'http_packet',
        packet_content: {
          header: s.txHeader,
          body: { type: 'text', value: s.txBody },
        },
      },
      { id: 'p1', kind: 'http_packet', packet_content: { header: 'tx' } },
      { id: 'p2', kind: 'http_packet', packet_content: { header: 'tx' } },
      { id: 'p3', kind: 'http_packet', packet_content: { header: 'tx' } },
      {
        id: 'block',
        kind: 'http_packet',
        packet_content: {
          header: s.blockHeader,
          body: { type: 'text', value: s.blockBody },
        },
      },
      {
        id: 'gossip1',
        kind: 'http_packet',
        packet_content: { header: s.newBlock },
      },
      {
        id: 'gossip3',
        kind: 'http_packet',
        packet_content: { header: s.newBlock },
      },
    ],
    timeline: [
      {
        type: 'comment',
        object: 'wallet',
        text: s.c1,
        duration: 2400,
      },
      {
        type: 'move',
        object: 'tx',
        from: 'wallet',
        to: 'mempool',
        duration: 1300,
      },
      {
        type: 'set_content',
        object: 'mempool',
        content: { type: 'text', value: s.waiting },
        keep_until: 'mined',
      },
      {
        type: 'comment',
        object: 'mempool',
        text: s.c2,
        duration: 2600,
      },
      {
        type: 'parallel',
        duration: 1400,
        actions: [
          { type: 'move', object: 'p1', from: 'mempool', to: 'm1' },
          { type: 'move', object: 'p2', from: 'mempool', to: 'm2' },
          { type: 'move', object: 'p3', from: 'mempool', to: 'm3' },
        ],
      },
      {
        type: 'comment',
        text: s.c3,
        duration: 2800,
      },
      {
        type: 'parallel',
        duration: 1800,
        actions: [
          { type: 'loading', object: 'm1' },
          { type: 'loading', object: 'm2' },
          { type: 'loading', object: 'm3' },
        ],
      },
      {
        type: 'comment',
        object: 'm2',
        text: s.c4,
        duration: 2600,
      },
      {
        type: 'move',
        id: 'mined',
        object: 'block',
        from: 'm2',
        to: 'chain',
        duration: 1400,
      },
      {
        type: 'set_content',
        object: 'mempool',
        content: { type: 'text', value: s.included },
        keep_until_end: true,
      },
      {
        type: 'comment',
        object: 'chain',
        text: s.c5,
        duration: 2600,
      },
      {
        type: 'parallel',
        duration: 1400,
        actions: [
          { type: 'move', object: 'gossip1', from: 'm2', to: 'm1' },
          {
            type: 'move',
            object: 'gossip3',
            from: 'm2',
            to: 'm3',
            delay_ms: 250,
          },
        ],
      },
      {
        type: 'comment',
        text: s.cEnd,
        duration: 2600,
      },
      { type: 'wait', duration: 1400 },
    ],
  };
};
