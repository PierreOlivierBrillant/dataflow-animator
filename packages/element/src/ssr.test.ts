import { describe, expect, it } from 'vitest';

/**
 * SSR-safety, in the environment that actually proves it.
 *
 * This file runs in the package's DEFAULT vitest environment — `node`, where
 * `HTMLElement` and `customElements` simply do not exist. That is the whole
 * point: `class X extends HTMLElement` evaluates its base AT IMPORT, so a naive
 * implementation throws on the `import` line of any server bundle, long before
 * anyone asks to mount a player. No mocking can demonstrate that; only importing
 * for real with the globals absent can.
 */

describe('server-side import', () => {
  it('has no DOM globals to lean on', () => {
    expect(typeof HTMLElement).toBe('undefined');
    expect(typeof customElements).toBe('undefined');
  });

  it('imports the barrel without throwing, and registers nothing', async () => {
    const module = await import('./index');
    expect(typeof module.DataFlowPlayerElement).toBe('function');
    expect(module.DEFAULT_TAG_NAME).toBe('dataflow-player');
    // The barrel's auto-registration ran during that import and found no
    // registry, so it returned early instead of throwing.
    expect(() => module.defineDataFlowPlayer()).not.toThrow();
    expect(() => module.defineDataFlowPlayer('other-player')).not.toThrow();
  });
});
