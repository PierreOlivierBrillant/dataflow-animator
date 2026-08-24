import { describe, expect, it } from 'vitest';
import { derivedDuration, packetReadingTime } from './readingTime';
import { compile } from './compiler';
import type { Action, DataFlowSpec, Packet } from '../types';
import { FADE_MS } from './timeline';
import { appearHold } from './motionTime';
import { clipOpacity } from '../render/clipOpacity';

const comment = (text: string, extra: Partial<Action> = {}): Action =>
  ({ type: 'comment', text, ...extra }) as Action;

describe('derivedDuration', () => {
  it('grows with the length of the text', () => {
    const short = derivedDuration(comment('Servi'), 1)!;
    const long = derivedDuration(comment('Servi '.repeat(20)), 1)!;
    expect(long).toBeGreaterThan(short);
  });

  it('is linear in length once past the floor, plus a fixed acquisition cost', () => {
    // Both samples must clear the floor AND stay under the ceiling, which at
    // 24 c/s is reached around 158 characters — hence 60 and 120, not more.
    const a = derivedDuration(comment('x'.repeat(60)), 1)!;
    const b = derivedDuration(comment('x'.repeat(120)), 1)!;
    expect(b - a).toBe(Math.round((60 / 24) * 1000));
  });

  it('holds a two-word label on screen long enough to be seen', () => {
    // 7 characters would compute to ~690 ms; the floor is what saves it.
    expect(derivedDuration(comment('Servi ✅'), 1)).toBe(700);
  });

  it('refuses to hold the animation hostage for a very long text', () => {
    expect(derivedDuration(comment('x'.repeat(5000)), 1)).toBe(7000);
  });

  it('reads code slower than prose of the same length', () => {
    // Short enough that neither hits the ceiling, or both would read 7000.
    const panel = (type: 'text' | 'code') =>
      derivedDuration(
        {
          type: 'set_content',
          object: 'n',
          content: { type, value: 'x'.repeat(60) },
        } as Action,
        1
      )!;
    expect(panel('code')).toBeGreaterThan(panel('text'));
  });

  it('counts the cells of a table, not just its value', () => {
    const empty = derivedDuration(
      {
        type: 'set_content',
        object: 'n',
        content: { type: 'table', columns: ['id'] },
      } as Action,
      1
    )!;
    const full = derivedDuration(
      {
        type: 'set_content',
        object: 'n',
        content: {
          type: 'table',
          columns: ['id', 'email'],
          rows_data: [
            [1, 'alice@corp.io'],
            [2, 'bob@corp.io'],
          ],
        },
      } as Action,
      1
    )!;
    expect(full).toBeGreaterThan(empty);
  });

  it('gives an image a flat beat, since its length says nothing', () => {
    const small = derivedDuration(
      {
        type: 'set_content',
        object: 'n',
        content: { type: 'image', value: 'a.png' },
      } as Action,
      1
    );
    const long = derivedDuration(
      {
        type: 'set_content',
        object: 'n',
        content: { type: 'image', value: 'a-very-long-file-name-here.png' },
      } as Action,
      1
    );
    expect(small).toBe(long);
  });

  it('scales by pace AFTER the bounds, so a capped action can still be slowed', () => {
    const capped = derivedDuration(comment('x'.repeat(5000)), 1)!;
    expect(capped).toBe(7000);
    expect(derivedDuration(comment('x'.repeat(5000)), 2)).toBe(14000);
    // …and the floor is scalable in the same way.
    expect(derivedDuration(comment('Servi'), 2)).toBe(1400);
  });

  it('returns undefined when there is nothing to read', () => {
    expect(derivedDuration(comment(''), 1)).toBeUndefined();
    expect(derivedDuration(comment('   '), 1)).toBeUndefined();
    // Same defensive case as `content` below: `text` is required by the type.
    expect(derivedDuration({ type: 'comment' } as Action, 1)).toBeUndefined();
    expect(
      derivedDuration(
        { type: 'set_content', object: 'n', content: {} } as Action,
        1
      )
    ).toBeUndefined();
    // `content` is required by the type, so only an untyped JS caller feeding a
    // hand-written JSON spec can reach this — which is exactly who does.
    expect(
      derivedDuration({ type: 'set_content', object: 'n' } as Action, 1)
    ).toBeUndefined();
  });

  it('has no opinion about actions that carry nothing to read', () => {
    expect(
      derivedDuration(
        { type: 'move', object: 'p', from: 'a', to: 'b' } as Action,
        1
      )
    ).toBeUndefined();
    expect(
      derivedDuration({ type: 'loading', object: 'a' } as Action, 1)
    ).toBeUndefined();
  });
});

const specWith = (timeline: Action[], pace?: number): DataFlowSpec => ({
  nodes: [{ id: 'a', type: 'server' }],
  packets: [],
  timeline,
  ...(pace === undefined ? {} : { pace }),
});

/** Duration of the single clip a one-action timeline produces. */
const soleClipMs = (spec: DataFlowSpec): number => {
  const { timeline } = compile(spec);
  expect(timeline.clips).toHaveLength(1);
  const clip = timeline.clips[0];
  return clip.endMs - clip.animStartMs;
};

describe('compile — reading time', () => {
  it('derives a comment duration when the author wrote none', () => {
    const text = 'Le répartiteur distribue les requêtes à tour de rôle.';
    expect(soleClipMs(specWith([comment(text)]))).toBe(
      derivedDuration(comment(text), 1)
    );
  });

  it('leaves an explicit duration exactly as written', () => {
    // The whole safety of switching this on: an existing spec is untouched.
    expect(
      soleClipMs(specWith([comment('x'.repeat(300), { duration: 500 })]))
    ).toBe(500);
  });

  it('falls back to the per-type default when nothing can be derived', () => {
    expect(
      soleClipMs(specWith([{ type: 'loading', object: 'a' } as Action]))
    ).toBe(1200);
  });

  it('applies the spec-level pace to derived durations only', () => {
    const text = 'x'.repeat(120);
    const plain = soleClipMs(specWith([comment(text)]));
    const slowed = soleClipMs(specWith([comment(text)], 1.5));
    expect(slowed).toBe(Math.round(plain * 1.5));

    // An explicit duration is an intent, not an estimate: pace leaves it alone.
    expect(soleClipMs(specWith([comment(text, { duration: 800 })], 1.5))).toBe(
      800
    );
  });

  it('gives a comment a fade-in BEFORE its reading time, not inside it', () => {
    // The regression this guards: the bubble used to fade over its whole clip,
    // so a long reading time produced a long fade — the text only becoming
    // readable at the moment it was due to have been read.
    const text = 'x'.repeat(120);
    const { timeline } = compile(specWith([comment(text)]));
    const clip = timeline.clips[0];
    const reading = derivedDuration(comment(text), 1)!;

    expect(clip.animStartMs - clip.startMs).toBe(FADE_MS);
    // The reading time is the FULLY-PRESENT stretch, past the fade.
    expect(clip.endMs - clip.animStartMs).toBe(reading);
    // …and the bubble is opaque for all of it.
    expect(clipOpacity(clip, clip.animStartMs)).toBe(1);
    expect(clipOpacity(clip, clip.startMs + FADE_MS / 2)).toBeCloseTo(0.5, 5);
  });

  it("lets an author's own fade_in_ms set that appearance phase", () => {
    const { timeline } = compile(
      specWith([comment('x'.repeat(120), { fade_in_ms: 0 })])
    );
    const clip = timeline.clips[0];
    expect(clip.animStartMs).toBe(clip.startMs);
    expect(clipOpacity(clip, clip.startMs)).toBe(1);
  });

  it('lengthens the whole timeline rather than only the first step', () => {
    const short = compile(specWith([comment('Bref'), comment('Bref')]));
    const long = compile(
      specWith([comment('x'.repeat(200)), comment('x'.repeat(200))])
    );
    expect(long.timeline.durationMs).toBeGreaterThan(short.timeline.durationMs);
  });
});

describe('packetReadingTime', () => {
  const http = (header: string, body?: string): Packet => ({
    id: 'p',
    kind: 'http_packet',
    packet_content: {
      header,
      ...(body ? { body: { type: 'text', value: body } } : {}),
    },
  });

  it('grows with what the packet carries', () => {
    expect(
      packetReadingTime(http('200 OK', 'a-much-longer-body-here'), 1)!
    ).toBeGreaterThan(packetReadingTime(http('200 OK'), 1)!);
  });

  it('reads a SQL query slower than an HTTP header of the same length', () => {
    const query = 'SELECT id FROM t';
    const sql = packetReadingTime(
      { id: 'p', kind: 'sql_request', request_content: query },
      1
    )!;
    const header = packetReadingTime(http(query), 1)!;
    expect(sql).toBeGreaterThan(header);
  });

  it('counts a SQL response’s rows and table cells', () => {
    const bare = packetReadingTime(
      { id: 'p', kind: 'sql_response', response_content: { rows: 1 } },
      1
    )!;
    const full = packetReadingTime(
      {
        id: 'p',
        kind: 'sql_response',
        response_content: {
          rows: 2,
          body: {
            type: 'table',
            columns: ['id', 'email'],
            rows_data: [[1, 'alice@corp.io']],
          },
        },
      },
      1
    )!;
    expect(full).toBeGreaterThan(bare);
  });

  it("has NO floor of its own — the caller's hold is the floor", () => {
    // A bare acknowledgement must not be given the 700 ms a two-word label needs.
    expect(
      packetReadingTime(
        { id: 'p', kind: 'sql_response', response_content: { rows: 1 } },
        1
      )!
    ).toBeLessThan(400);
  });

  it('caps a long payload, since the packet stays legible while it travels', () => {
    expect(packetReadingTime(http('x'.repeat(5000)), 1)).toBe(1600);
  });

  it('ignores a badge, which is recognised rather than read', () => {
    expect(
      packetReadingTime({ id: 'p', kind: 'subicon', icon: 'postgres' }, 1)
    ).toBeUndefined();
  });

  it('reads a travelling panel’s own header and body', () => {
    // `complex_node` / `simple_node` packets carry their text directly.
    const panel = packetReadingTime(
      {
        id: 'p',
        kind: 'complex_node',
        header: 'POST /login',
        body: '{ "user": 1 }',
      },
      1
    )!;
    const bare = packetReadingTime(
      { id: 'p', kind: 'simple_node', body: 'x' },
      1
    )!;
    expect(panel).toBeGreaterThan(bare);
  });

  it('treats a highlighted panel as code', () => {
    const plain = packetReadingTime(
      { id: 'p', kind: 'simple_node', body: 'x'.repeat(15) },
      1
    )!;
    const coloured = packetReadingTime(
      { id: 'p', kind: 'simple_node', body: 'x'.repeat(15), language: 'sql' },
      1
    )!;
    expect(coloured).toBeGreaterThan(plain);
  });

  it('reads a SQL response’s header, and skips an image body', () => {
    const withHeader = packetReadingTime(
      {
        id: 'p',
        kind: 'sql_response',
        response_content: { header: 'rows returned', rows: 3 },
      },
      1
    )!;
    expect(withHeader).toBeGreaterThan(
      packetReadingTime(
        { id: 'p', kind: 'sql_response', response_content: { rows: 3 } },
        1
      )!
    );
    // An image carries no text to read.
    expect(
      packetReadingTime(
        {
          id: 'p',
          kind: 'http_packet',
          packet_content: { body: { type: 'image', value: 'a.png' } },
        },
        1
      )
    ).toBeUndefined();
  });

  it('treats a highlighted HTTP body as code', () => {
    const plain = packetReadingTime(
      {
        id: 'p',
        kind: 'http_packet',
        packet_content: { body: { type: 'text', value: 'x'.repeat(15) } },
      },
      1
    )!;
    const coloured = packetReadingTime(
      {
        id: 'p',
        kind: 'http_packet',
        packet_content: {
          body: { type: 'text', value: 'x'.repeat(40), language: 'json' },
        },
      },
      1
    )!;
    expect(coloured).toBeGreaterThan(plain);
  });

  it('scales by pace', () => {
    expect(packetReadingTime(http('x'.repeat(5000)), 2)).toBe(3200);
  });
});

describe('compile — a packet is held long enough to be read', () => {
  const spec = (): DataFlowSpec => ({
    direction: 'left-to-right',
    nodes: [
      { id: 'a', type: 'server', lane: 1 },
      { id: 'b', type: 'server', lane: 2 },
      { id: 'c', type: 'server', lane: 3 },
    ],
    packets: [
      {
        id: 'q',
        kind: 'sql_request',
        request_content: 'SELECT * FROM users WHERE email = ?',
      },
    ],
    timeline: [
      {
        type: 'move',
        id: 'first',
        object: 'q',
        from: 'a',
        to: 'b',
        duration: 600,
      },
      {
        type: 'move',
        id: 'second',
        object: 'q',
        from: 'b',
        to: 'c',
        duration: 600,
      },
    ],
  });

  const hold = (id: string) => {
    const clip = compile(spec()).timeline.clips.find((c) => c.id === id)!;
    return clip.animStartMs - clip.startMs;
  };

  it('holds the first appearance for as long as its content needs', () => {
    const packet = spec().packets[0];
    expect(hold('first')).toBe(packetReadingTime(packet, 1));
    // …which is far more than the fraction of the trip it used to get.
    expect(hold('first')).toBeGreaterThan(500);
  });

  it('does NOT charge the reader again on the next leg', () => {
    // Same packet, same text: re-paying would only pad the animation.
    expect(hold('second')).toBeLessThan(hold('first'));
    expect(hold('second')).toBe(appearHold(600));
  });
});
