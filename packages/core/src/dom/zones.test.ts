/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import {
  buildZoneRect,
  computeZoneBounds,
  createZoneLabel,
  placeZoneLabel,
  zoneKey,
} from './zones';
import type { GeometryMap, NodeGeom } from '../engine/geometry';
import type { Zone } from '../types';

const geom = (over: Partial<NodeGeom> & { id: string }): NodeGeom => ({
  x: 100,
  y: 100,
  width: 40,
  height: 40,
  ...over,
});

const map = (...nodes: NodeGeom[]): GeometryMap =>
  Object.fromEntries(nodes.map((n) => [n.id, n]));

describe('zoneKey', () => {
  it('prefers the id and falls back to the index', () => {
    expect(zoneKey({ contains: [], id: 'z' }, 3)).toBe('z');
    expect(zoneKey({ contains: [] }, 3)).toBe('__zone_3');
  });
});

describe('computeZoneBounds', () => {
  it('returns nothing without zones', () => {
    expect(computeZoneBounds(undefined, {})).toEqual({});
    expect(computeZoneBounds([], {})).toEqual({});
  });

  it('pads the bounding box of the contained nodes', () => {
    const zones: Zone[] = [{ id: 'z', contains: ['a'] }];
    const bounds = computeZoneBounds(zones, map(geom({ id: 'a' })));

    // Node spans 80..120 on both axes; ZONE_PADDING is 20.
    expect(bounds.z).toEqual({ x: 60, y: 60, width: 80, height: 80 });
  });

  it('reserves extra room at the TOP for a label, growing upward only', () => {
    const plain = computeZoneBounds(
      [{ id: 'z', contains: ['a'] }],
      map(geom({ id: 'a' }))
    ).z;
    const labelled = computeZoneBounds(
      [{ id: 'z', contains: ['a'], label: 'Backend' }],
      map(geom({ id: 'a' }))
    ).z;

    expect(labelled.y).toBe(plain.y - 20);
    expect(labelled.height).toBe(plain.height + 20);
    expect(labelled.x).toBe(plain.x);
    expect(labelled.width).toBe(plain.width);
  });

  it('includes a node label in the box, both below and sideways', () => {
    const bounds = computeZoneBounds(
      [{ id: 'z', contains: ['a'] }],
      map(geom({ id: 'a', labelH: 14, labelW: 120 }))
    ).z;

    // Label is wider than the node: the box widens to half-label either side.
    expect(bounds.width).toBe(120 + 2 * 20);
    // And grows downward by NODE_LABEL_GAP + labelH.
    expect(bounds.height).toBe(40 + 6 + 14 + 2 * 20);
  });

  it('falls back to a synthetic label width when only the height is known', () => {
    const narrow = computeZoneBounds(
      [{ id: 'z', contains: ['a'] }],
      map(geom({ id: 'a', width: 40, labelH: 14 }))
    ).z;

    // max(width * 1.5, 60) = 60.
    expect(narrow.width).toBe(60 + 2 * 20);
  });

  it('resolves a nested zone before the zone that contains it', () => {
    const zones: Zone[] = [
      // Declared OUTER FIRST, so the fixed point has to iterate.
      { id: 'outer', contains: ['inner', 'b'] },
      { id: 'inner', contains: ['a'] },
    ];
    const bounds = computeZoneBounds(
      zones,
      map(geom({ id: 'a' }), geom({ id: 'b', x: 300 }))
    );

    expect(bounds.inner).toBeDefined();
    expect(bounds.outer.x).toBeLessThanOrEqual(bounds.inner.x);
    expect(bounds.outer.x + bounds.outer.width).toBeGreaterThan(300);
  });

  it('silently ignores an unknown id', () => {
    const bounds = computeZoneBounds(
      [{ id: 'z', contains: ['a', 'ghost'] }],
      map(geom({ id: 'a' }))
    );

    expect(bounds.z).toEqual({ x: 60, y: 60, width: 80, height: 80 });
  });

  it('drops a zone whose members are all unmeasured', () => {
    expect(computeZoneBounds([{ id: 'z', contains: ['ghost'] }], {})).toEqual(
      {}
    );
  });

  it('widens around its middle to fit the label and its insets', () => {
    const bounds = computeZoneBounds(
      [{ id: 'z', contains: ['a'], label: 'Client · untrusted' }],
      map(geom({ id: 'a' })),
      { labelWidths: { z: 136 } }
    ).z;

    // 136 + 2 × ZONE_LABEL_INSET_X (12) = 160, centred on the node at x = 100.
    expect(bounds.width).toBe(160);
    expect(bounds.x).toBe(20);
  });

  it('ignores a label narrower than the members, and a zone with no label', () => {
    const zones: Zone[] = [
      { id: 'short', contains: ['a'], label: 'DB' },
      { id: 'bare', contains: ['a'] },
    ];
    const bounds = computeZoneBounds(zones, map(geom({ id: 'a' })), {
      labelWidths: { short: 20, bare: 500 },
    });

    expect(bounds.short.width).toBe(80);
    expect(bounds.bare.width).toBe(80);
  });

  it('leans the label widening away from a stage edge', () => {
    const bounds = computeZoneBounds(
      [{ id: 'z', contains: ['a'], label: 'Edge' }],
      map(geom({ id: 'a', x: 40 })),
      { labelWidths: { z: 136 }, stage: { width: 800, height: 600 } }
    ).z;

    // Members span 20..60, padded 0..80: no room on the left, so the whole
    // 80px of widening goes right. The 2px stage inset clips the left side.
    expect(bounds.x).toBe(2);
    expect(bounds.x + bounds.width).toBe(160);
  });

  it('clips a zone whose members reach past the stage edge', () => {
    const bounds = computeZoneBounds(
      [{ id: 'z', contains: ['a'] }],
      map(geom({ id: 'a', x: 790, y: 590 })),
      { stage: { width: 800, height: 600 } }
    ).z;

    expect(bounds.x + bounds.width).toBe(798);
    expect(bounds.y + bounds.height).toBe(598);
    expect(bounds.x).toBe(750);
  });
});

describe('buildZoneRect', () => {
  it('positions the rect in pixels', () => {
    const el = buildZoneRect(
      { id: 'z', contains: [] },
      { x: 10, y: 20, width: 300, height: 200 }
    );

    expect(el.getAttribute('class')).toBe('rdfa-zone');
    expect(el.style.left).toBe('10px');
    expect(el.style.top).toBe('20px');
    expect(el.style.width).toBe('300px');
    expect(el.style.height).toBe('200px');
  });

  it('sets the zone colour variable only when given', () => {
    const bounds = { x: 0, y: 0, width: 1, height: 1 };
    const tinted = buildZoneRect(
      { id: 'z', contains: [], color: '#f00' },
      bounds
    );
    const plain = buildZoneRect({ id: 'z', contains: [] }, bounds);

    expect(tinted.style.getPropertyValue('--rdfa-zone-color')).toBe('#f00');
    expect(plain.style.getPropertyValue('--rdfa-zone-color')).toBe('');
  });
});

describe('createZoneLabel / placeZoneLabel', () => {
  it('builds an unplaced label, then offsets it from the box origin', () => {
    const el = createZoneLabel({ id: 'z', contains: [], label: 'Backend' });

    expect(el.getAttribute('class')).toBe('rdfa-zone-label');
    expect(el.style.left).toBe('');
    expect(el.textContent).toBe('Backend');

    placeZoneLabel(el, { x: 10, y: 20, width: 300, height: 200 });

    expect(el.style.left).toBe('22px');
    expect(el.style.top).toBe('28px');
  });

  it('carries the zone colour', () => {
    const el = createZoneLabel({
      id: 'z',
      contains: [],
      label: 'Backend',
      color: '#f00',
    });

    expect(el.style.getPropertyValue('--rdfa-zone-color')).toBe('#f00');
  });

  it('renders rich text in the label', () => {
    const el = createZoneLabel({ id: 'z', contains: [], label: 'zone $x$' });

    expect(el.querySelector('.rdfa-tex')).not.toBeNull();
  });
});
