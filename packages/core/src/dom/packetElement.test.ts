/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { applyPacketPose, buildPacketElement } from './packetElement';
import type { Highlighter, Packet } from '../types';

/** A marker highlighter, so a test can tell the highlighted path was taken. */
const highlight: Highlighter = (code, language) =>
  `<mark data-lang="${language}">${code}</mark>`;

function build(
  object: Packet,
  over?: Parameters<typeof buildPacketElement>[1]
) {
  return buildPacketElement(object, { x: 10, y: 20, ...over });
}

describe('buildPacketElement — wrapper', () => {
  it('positions the packet and applies opacity and scale', () => {
    const el = build(
      { id: 'p', kind: 'http_packet' },
      { x: 12.5, y: 40, opacity: 0.5, scale: 0.9 }
    );

    expect(el.className).toBe('rdfa-packet rdfa-packet-http_packet');
    expect(el.style.left).toBe('12.5px');
    expect(el.style.top).toBe('40px');
    expect(el.style.opacity).toBe('0.5');
    expect(el.style.transform).toBe('translate(-50%, -50%) scale(0.9)');
  });

  it('defaults opacity and scale to 1, as the React component does', () => {
    const el = build({ id: 'p', kind: 'sql_request' });

    expect(el.style.opacity).toBe('1');
    expect(el.style.transform).toBe('translate(-50%, -50%) scale(1)');
  });

  it('renders an empty wrapper for an unknown kind', () => {
    const el = build({ id: 'p', kind: 'mystery' as Packet['kind'] });

    expect(el.className).toBe('rdfa-packet rdfa-packet-mystery');
    expect(el.childNodes).toHaveLength(0);
  });
});

describe('applyPacketPose — stage confinement', () => {
  /** jsdom lays nothing out: the card's size has to be given. */
  const sized = (width: number, height: number): HTMLElement => {
    const el = buildPacketElement(
      { id: 'p', kind: 'http_packet' },
      {
        x: 0,
        y: 0,
      }
    );
    Object.defineProperty(el, 'offsetWidth', { value: width });
    Object.defineProperty(el, 'offsetHeight', { value: height });
    return el;
  };
  const stage = { width: 400, height: 300 };

  it('pulls a card centred near an edge back inside, 8px from it', () => {
    const el = sized(200, 100);
    applyPacketPose(el, { x: 30, y: 290, stage });

    expect(el.style.left).toBe('108px');
    expect(el.style.top).toBe('242px');
  });

  it('leaves a card that already fits where the path put it', () => {
    const el = sized(200, 100);
    applyPacketPose(el, { x: 200, y: 150, stage });

    expect(el.style.left).toBe('200px');
    expect(el.style.top).toBe('150px');
  });

  it('pins a card larger than the stage to the start edge', () => {
    const el = sized(200, 400);
    applyPacketPose(el, { x: 200, y: 150, stage });

    expect(el.style.top).toBe('208px');
  });

  it('does not confine without a stage, nor a card with no size yet', () => {
    const free = sized(200, 100);
    applyPacketPose(free, { x: 30, y: 20 });
    const unmeasured = sized(0, 0);
    applyPacketPose(unmeasured, { x: 30, y: 20, stage });

    expect(free.style.left).toBe('30px');
    expect(unmeasured.style.left).toBe('30px');
  });
});

describe('buildPacketElement — http_packet', () => {
  it('highlights the header as HTTP when a highlighter is given', () => {
    const el = build(
      { id: 'p', kind: 'http_packet', packet_content: { header: 'GET /api' } },
      { x: 0, y: 0, highlight }
    );
    const header = el.querySelector('.rdfa-packet-header');

    expect(header?.classList.contains('rdfa-code')).toBe(true);
    expect(header?.innerHTML).toBe('<mark data-lang="http">GET /api</mark>');
  });

  it('renders the header as plain text without a highlighter', () => {
    const el = build({
      id: 'p',
      kind: 'http_packet',
      packet_content: { header: 'GET /api' },
    });
    const header = el.querySelector('.rdfa-packet-header');

    expect(header?.classList.contains('rdfa-code')).toBe(false);
    expect(header?.textContent).toBe('GET /api');
  });

  it('renders an image body as an <img>', () => {
    const el = build({
      id: 'p',
      kind: 'http_packet',
      packet_content: { body: { type: 'image', value: 'cat.png' } },
    });
    const img = el.querySelector<HTMLImageElement>('.rdfa-packet-body img');

    expect(img?.getAttribute('src')).toBe('cat.png');
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('highlights a code body in its declared language', () => {
    const el = build(
      {
        id: 'p',
        kind: 'http_packet',
        packet_content: { body: { value: '{"a":1}', language: 'json' } },
      },
      { x: 0, y: 0, highlight }
    );
    const surface = el.querySelector('.rdfa-packet-surface');

    expect(surface?.classList.contains('rdfa-code')).toBe(true);
    expect(surface?.innerHTML).toBe('<mark data-lang="json">{"a":1}</mark>');
  });

  it('falls back to a plain text surface without a language', () => {
    const el = build({
      id: 'p',
      kind: 'http_packet',
      packet_content: { body: { value: 'hello' } },
    });
    const surface = el.querySelector('.rdfa-packet-surface');

    expect(surface?.classList.contains('rdfa-code')).toBe(false);
    expect(surface?.textContent).toBe('hello');
  });

  it('renders an empty surface when the body has no value, as React does', () => {
    const el = build({
      id: 'p',
      kind: 'http_packet',
      packet_content: { body: {} },
    });

    expect(el.querySelector('.rdfa-packet-surface')?.textContent).toBe('');
  });
});

describe('buildPacketElement — sql_request', () => {
  it('highlights the request as SQL', () => {
    const el = build(
      { id: 'p', kind: 'sql_request', request_content: 'SELECT 1' },
      { x: 0, y: 0, highlight }
    );

    expect(el.querySelector('.rdfa-packet-header')?.innerHTML).toBe(
      '<mark data-lang="sql">SELECT 1</mark>'
    );
  });

  it("defaults to the literal 'SQL' and to plain text without a highlighter", () => {
    const el = build({ id: 'p', kind: 'sql_request' });
    const header = el.querySelector('.rdfa-packet-header');

    expect(header?.classList.contains('rdfa-code')).toBe(false);
    expect(header?.textContent).toBe('SQL');
  });
});

describe('buildPacketElement — sql_response', () => {
  it('derives the legacy row-count header, pluralised', () => {
    const one = build({
      id: 'p',
      kind: 'sql_response',
      response_content: { rows: 1 },
    });
    const many = build({
      id: 'p',
      kind: 'sql_response',
      response_content: { rows: 3 },
    });

    expect(one.querySelector('.rdfa-packet-header')?.textContent).toBe(
      '▦ 1 ligne'
    );
    expect(many.querySelector('.rdfa-packet-header')?.textContent).toBe(
      '▦ 3 lignes'
    );
  });

  it('falls back to the generic result header, overridden by an explicit one', () => {
    const generic = build({ id: 'p', kind: 'sql_response' });
    const explicit = build({
      id: 'p',
      kind: 'sql_response',
      response_content: { header: 'OK' },
    });

    expect(generic.querySelector('.rdfa-packet-header')?.textContent).toBe(
      '▦ résultat'
    );
    expect(explicit.querySelector('.rdfa-packet-header')?.textContent).toBe(
      'OK'
    );
  });

  it('renders a text body as a plain surface', () => {
    const el = build({
      id: 'p',
      kind: 'sql_response',
      response_content: { body: { type: 'text', value: 'done' } },
    });

    expect(el.querySelector('.rdfa-packet-surface')?.textContent).toBe('done');
  });

  it('renders a table body with header row and stringified cells', () => {
    const el = build({
      id: 'p',
      kind: 'sql_response',
      response_content: {
        body: {
          type: 'table',
          columns: ['id', 'name'],
          rows_data: [
            [1, 'Alice'],
            [2, 'Bob'],
          ],
        },
      },
    });
    const wrapper = el.querySelector('.rdfa-sql-table-wrapper');
    const table = wrapper?.querySelector('table.rdfa-sql-table');

    expect(wrapper?.classList.contains('rdfa-packet-surface')).toBe(true);
    expect(
      [...(table?.querySelectorAll('thead th') ?? [])].map(
        (th) => th.textContent
      )
    ).toEqual(['id', 'name']);
    expect(
      [...(table?.querySelectorAll('tbody tr:first-child td') ?? [])].map(
        (td) => td.textContent
      )
    ).toEqual(['1', 'Alice']);
  });

  it('omits thead/tbody when columns or rows are absent, and the body for other types', () => {
    const bare = build({
      id: 'p',
      kind: 'sql_response',
      response_content: { body: { type: 'table' } },
    });
    const unknown = build({
      id: 'p',
      kind: 'sql_response',
      response_content: { body: {} },
    });

    expect(bare.querySelector('thead')).toBeNull();
    expect(bare.querySelector('tbody')).toBeNull();
    expect(unknown.querySelector('.rdfa-packet-body')).toBeNull();
  });
});

describe('buildPacketElement — panel packets', () => {
  it('renders a travelling simple_node panel with the panel modifier', () => {
    const el = build({ id: 'p', kind: 'simple_node', body: 'note' });

    expect(el.className).toBe(
      'rdfa-packet rdfa-packet-simple_node rdfa-packet--panel'
    );
    expect(el.querySelector('.rdfa-node-panel')).not.toBeNull();
    expect(el.querySelector('.rdfa-node-panel-body')?.textContent).toBe('note');
  });

  it('renders a complex_node panel with its header', () => {
    const el = build({
      id: 'p',
      kind: 'complex_node',
      header: 'H',
      body: 'B',
    });

    expect(
      el.querySelector('.rdfa-node-panel--complex .rdfa-node-panel-header')
        ?.textContent
    ).toBe('H');
  });

  it('escapes panel code content when no highlighter is given', () => {
    const el = build({
      id: 'p',
      kind: 'simple_node',
      body: 'a < b',
      language: 'js',
    });

    // The escapeHtml fallback keeps the text intact without injecting markup.
    expect(el.querySelector('.rdfa-node-panel-body')?.textContent).toBe(
      'a < b'
    );
    expect(el.querySelector('.rdfa-node-panel-body mark')).toBeNull();
  });
});

describe('buildPacketElement — subicon', () => {
  it('renders the travelling badge with the subicon modifier', () => {
    const el = build({ id: 'p', kind: 'subicon', icon: 'react' });

    expect(el.className).toBe(
      'rdfa-packet rdfa-packet-subicon rdfa-packet--subicon'
    );
    expect(el.querySelector('.rdfa-node-subicon svg')).not.toBeNull();
  });

  it('tolerates a missing icon (empty free-text badge)', () => {
    const el = build({ id: 'p', kind: 'subicon' });

    expect(el.querySelector('.rdfa-node-subicon')).not.toBeNull();
  });
});
