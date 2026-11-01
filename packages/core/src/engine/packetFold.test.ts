import { describe, expect, it } from 'vitest';
import {
  foldAt,
  foldEndMs,
  foldedLabel,
  packetCardSize,
  packetTokenLabel,
  sqlResponseHeader,
} from './packetFold';
import type { Packet } from '../types';
import type { MoveClip } from './timeline';

const http = (header: string, body?: string): Packet => ({
  id: 'p',
  kind: 'http_packet',
  packet_content: {
    header,
    ...(body ? { body: { type: 'text', value: body } } : {}),
  },
});

/** A JSON body as wide as a real one: three lines, the longest 40 columns. */
const BODY = '{\n  "result": { "summary": "The college opens…" }\n}';

describe('packetTokenLabel', () => {
  it('takes the first line of an HTTP header', () => {
    expect(packetTokenLabel(http('POST /resumer\nAuthorization: x'))).toBe(
      'POST /resumer'
    );
  });

  it('falls back to the first line of the body without a header', () => {
    expect(
      packetTokenLabel({
        id: 'p',
        kind: 'http_packet',
        packet_content: { body: { type: 'text', value: '\n  ok\nmore' } },
      })
    ).toBe('ok');
  });

  it('cuts a long line with an ellipsis', () => {
    const label = packetTokenLabel({
      id: 'p',
      kind: 'sql_request',
      request_content: 'SELECT * FROM users WHERE email = $1 AND active',
    })!;
    expect(label.length).toBeLessThanOrEqual(32);
    expect(label.endsWith('…')).toBe(true);
  });

  it('uses the shown header of an SQL response, default included', () => {
    expect(
      packetTokenLabel({
        id: 'p',
        kind: 'sql_response',
        response_content: { rows: 3 },
      })
    ).toBe('▦ 3 lignes');
    expect(sqlResponseHeader({ id: 'p', kind: 'sql_response' })).toBe(
      '▦ résultat'
    );
  });

  it('reads a travelling panel’s header, else its body', () => {
    expect(
      packetTokenLabel({
        id: 'p',
        kind: 'complex_node',
        header: 'H',
        body: 'B',
      })
    ).toBe('H');
    expect(packetTokenLabel({ id: 'p', kind: 'simple_node', body: 'B' })).toBe(
      'B'
    );
  });

  it('has nothing for a badge, which never folds', () => {
    expect(
      packetTokenLabel({ id: 'p', kind: 'subicon', icon: 'postgres' })
    ).toBeUndefined();
  });
});

describe('packetCardSize', () => {
  it('counts the widest line, and the lines of header and body', () => {
    expect(packetCardSize(http('200 OK', BODY))).toEqual({
      columns: 40,
      lines: 5,
    });
  });

  it('wraps a line wider than the card into extra rows', () => {
    expect(packetCardSize(http('x'.repeat(100)))).toEqual({
      columns: 40,
      lines: 3,
    });
  });

  it('gives a body that is not text some height', () => {
    const size = packetCardSize({
      id: 'p',
      kind: 'http_packet',
      packet_content: {
        header: 'GET /a.png',
        body: { type: 'image', value: 'a' },
      },
    });
    expect(size.lines).toBeGreaterThan(2);
  });

  it('counts a table row per line', () => {
    expect(
      packetCardSize({
        id: 'p',
        kind: 'sql_response',
        response_content: {
          header: '2 rows',
          body: { type: 'table', columns: ['id'], rows_data: [[1], [2]] },
        },
      }).lines
    ).toBe(4);
  });
});

describe('foldedLabel', () => {
  it('folds a card that spans most of a short trip and has a body', () => {
    // 40 columns × 9 = 360 px along a 384 px hop.
    expect(foldedLabel(http('200 OK', BODY), 384, 0)).toBe('200 OK');
  });

  it('lets the same card travel as it is across a long trip', () => {
    expect(foldedLabel(http('200 OK', BODY), 900, 0)).toBeUndefined();
  });

  it('never folds a card too short to hide the scene', () => {
    // Two lines, wider than half the trip: it still reads as the traveller.
    expect(
      foldedLabel(http('GET /users\nAccept: application/json'), 384, 0)
    ).toBeUndefined();
  });

  it('measures a vertical trip by the card’s height, not its width', () => {
    const card = http('200 OK', BODY);
    // 5 lines × 18 = 90 px: less than half of 300 px down…
    expect(foldedLabel(card, 0, 300)).toBeUndefined();
    // …more than half of 150.
    expect(foldedLabel(card, 0, 150)).toBe('200 OK');
  });

  it('never folds what has no label, or a trip of no length', () => {
    expect(
      foldedLabel({ id: 'p', kind: 'subicon', icon: 'x' }, 10, 0)
    ).toBeUndefined();
    expect(foldedLabel(http('200 OK', BODY), 0, 0)).toBeUndefined();
  });
});

describe('foldAt / foldEndMs', () => {
  const clip = (opened: boolean, travel = 2000): MoveClip => ({
    id: 'm',
    kind: 'move',
    objectId: 'p',
    fromId: 'a',
    toId: 'b',
    startMs: 0,
    animStartMs: 1000,
    endMs: 1000 + travel,
    visibleUntilMs: 1000 + travel + 300,
    stepIndex: 0,
    folded: { label: 'x', opened },
  });

  it('shows the card through the hold, then folds as the trip starts', () => {
    expect(foldAt(clip(true), 500)).toBe(0);
    expect(foldAt(clip(true), 1000)).toBe(0);
    expect(foldAt(clip(true), 1120)).toBeCloseTo(0.5);
    expect(foldAt(clip(true), 1240)).toBe(1);
    expect(foldEndMs(clip(true))).toBe(1240);
  });

  it('folds faster on a short trip, so the token is seen travelling', () => {
    // 35 % of a 400 ms trip = 140 ms.
    expect(foldEndMs(clip(true, 400))).toBe(1140);
  });

  it('starts folded when an earlier leg already showed the card', () => {
    expect(foldAt(clip(false), 0)).toBe(1);
    expect(foldEndMs(clip(false))).toBe(0);
  });
});
