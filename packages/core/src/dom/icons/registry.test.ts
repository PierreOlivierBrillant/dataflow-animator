/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import {
  customNodeIcon,
  customSubIcon,
  registerNodeIcon,
  registerSubIcon,
} from './registry';
import { renderNodeIcon } from './nodeIcons';
import { renderSubIcon } from './subIcons';

/**
 * The registries are module-global and there is no reset hook (a test-only
 * export would need a knip exemption to survive). Every test therefore uses a
 * key of its own, which is also closer to how a consumer uses them: once.
 */

const MARKUP = '<svg viewBox="0 0 24 24"><rect width="10" height="10"/></svg>';

describe('registry — markup sources', () => {
  it('resolves registered markup to an SVG element', () => {
    registerNodeIcon('rdfa-test-markup', MARKUP);

    const el = customNodeIcon('rdfa-test-markup');

    expect(el).toBeInstanceOf(SVGElement);
    expect(el?.querySelector('rect')).not.toBeNull();
  });

  it('returns a fresh node each time, so one icon can appear on many nodes', () => {
    registerNodeIcon('rdfa-test-fresh', MARKUP);

    const first = customNodeIcon('rdfa-test-fresh');
    const second = customNodeIcon('rdfa-test-fresh');

    expect(first).not.toBe(second);
    expect(first?.outerHTML).toBe(second?.outerHTML);
  });

  it('parses the markup once and clones it afterwards', () => {
    const createElement = vi.spyOn(document, 'createElement');
    registerNodeIcon('rdfa-test-parse-once', MARKUP);

    customNodeIcon('rdfa-test-parse-once');
    customNodeIcon('rdfa-test-parse-once');
    customNodeIcon('rdfa-test-parse-once');

    const templates = createElement.mock.calls.filter(
      ([tag]) => tag === 'template'
    );
    expect(templates).toHaveLength(1);
    createElement.mockRestore();
  });

  it('rejects markup that is not an SVG element', () => {
    registerNodeIcon('rdfa-test-bad-markup', '<div>nope</div>');

    expect(() => customNodeIcon('rdfa-test-bad-markup')).toThrow(TypeError);
  });

  it('rejects empty markup', () => {
    registerNodeIcon('rdfa-test-empty', '   ');

    expect(() => customNodeIcon('rdfa-test-empty')).toThrow(TypeError);
  });
});

describe('registry — factory sources', () => {
  it('calls the factory on every resolution rather than caching it', () => {
    const factory = vi.fn(() =>
      document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    );
    registerNodeIcon('rdfa-test-factory', factory);

    customNodeIcon('rdfa-test-factory');
    customNodeIcon('rdfa-test-factory');

    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('rejects a factory that returns something other than an SVGElement', () => {
    registerNodeIcon(
      'rdfa-test-bad-factory',
      () => document.createElement('div') as unknown as SVGElement
    );

    expect(() => customNodeIcon('rdfa-test-bad-factory')).toThrow(TypeError);
  });
});

describe('registry — lookup semantics', () => {
  it('returns undefined for an unregistered key', () => {
    expect(customNodeIcon('rdfa-test-never-registered')).toBeUndefined();
    expect(customSubIcon('rdfa-test-never-registered')).toBeUndefined();
  });

  it('replaces a previous registration, re-parsing the new markup', () => {
    registerNodeIcon('rdfa-test-replace', MARKUP);
    customNodeIcon('rdfa-test-replace');

    registerNodeIcon(
      'rdfa-test-replace',
      '<svg viewBox="0 0 24 24"><circle r="5"/></svg>'
    );

    expect(
      customNodeIcon('rdfa-test-replace')?.querySelector('circle')
    ).not.toBeNull();
  });

  it('folds sub-icon names to lower case', () => {
    registerSubIcon('RDFA-TEST-CASE', MARKUP);

    expect(customSubIcon('rdfa-test-case')).not.toBeUndefined();
    expect(customSubIcon('Rdfa-Test-Case')).not.toBeUndefined();
  });

  it('keeps node-icon keys case-sensitive', () => {
    registerNodeIcon('rdfaTestExact', MARKUP);

    expect(customNodeIcon('rdfatestexact')).toBeUndefined();
  });

  // A `Record` keyed by a consumer's string would resolve these to
  // `Object.prototype` members; a `Map` does not.
  it('is not confused by keys that collide with Object.prototype', () => {
    expect(customSubIcon('constructor')).toBeUndefined();
    expect(customSubIcon('__proto__')).toBeUndefined();

    registerSubIcon('constructor', MARKUP);

    expect(customSubIcon('constructor')).toBeInstanceOf(SVGElement);
  });
});

describe('registry — precedence in the renderers', () => {
  it('lets a custom sub-icon beat the built-in catalogue', () => {
    registerSubIcon(
      'redis',
      '<svg viewBox="0 0 24 24"><rect id="mine"/></svg>'
    );

    expect(renderSubIcon('redis').querySelector('#mine')).not.toBeNull();
  });

  // The legacy React renderer tested `switch` before its registry, so
  // registering over it did nothing. Registration now wins everywhere,
  // deliberately.
  it('lets a custom node icon beat the stateful switch geometry', () => {
    registerNodeIcon(
      'switch',
      '<svg viewBox="0 0 24 24"><rect id="custom-switch"/></svg>'
    );

    expect(
      renderNodeIcon('switch', { closed: 0.5 }).querySelector('#custom-switch')
    ).not.toBeNull();
  });
});
