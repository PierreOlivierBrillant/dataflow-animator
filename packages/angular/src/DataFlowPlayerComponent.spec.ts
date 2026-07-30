import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HostComponent,
  OTHER_SPEC,
  SPEC,
  StubResizeObserver,
  WARNING_SPEC,
} from './spec-helpers';

/**
 * The structural gate for this binding.
 *
 * The pixel proof is INHERITED, deliberately. This component writes no rendering
 * code at all — it turns inputs into `PlayerOptions` and calls the same
 * `mountPlayer` already asserted pixel-identical at 0.0000% by
 * `harness:selftest` (120 cells) and by `harness:element` (60 cells). A third
 * pixel gate would measure `mountPlayer` against itself through a third host.
 *
 * What a wrapper can actually break is the OPTION MAPPING and the LIFECYCLE, and
 * that is what is asserted here — plus, in `zone.spec.ts` and `ssr.spec.ts`, the
 * two Angular-specific invariants nothing else in the repository can catch.
 *
 * Not asserted here, and it is a limitation worth naming: `density` has no
 * observable effect in jsdom. It reaches the renderer as `--rdfa-scale`, which
 * `computeScale` derives from the stage's MEASURED width and height — both 0
 * without layout, so every density collapses to scale 1. The mapping is covered
 * by `options.spec.ts`, and its rendering by the element's option sweep, which
 * includes `compact` and `spacious`.
 */

beforeEach(() => {
  StubResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(): ReturnType<typeof TestBed.createComponent<HostComponent>> {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  return fixture;
}

/** The `.rdfa-player` roots currently in the document. */
function players(): NodeListOf<Element> {
  return document.querySelectorAll('.rdfa-player');
}

describe('mounting', () => {
  it('mounts exactly one real player into its own host element', () => {
    const fixture = mount();
    const host: HTMLElement = fixture.nativeElement.querySelector('dfa-player');

    expect(players()).toHaveLength(1);
    expect(host.querySelector('.rdfa-player')).not.toBeNull();
    expect(host.querySelector('.rdfa-stage')).not.toBeNull();
    expect(host.textContent).toContain('IDE');
    expect(host.textContent).toContain('Server');
  });

  it('emits `mounted` once, with the compile warnings', () => {
    const fixture = mount();
    expect(fixture.componentInstance.mounts).toHaveLength(1);
    expect(fixture.componentInstance.mounts[0]).toEqual([]);
    expect(fixture.componentInstance.errors).toHaveLength(0);
  });

  it('removes the host’s own box so the player inherits the containing block', () => {
    const fixture = mount();
    const host: HTMLElement = fixture.nativeElement.querySelector('dfa-player');
    expect(host.style.display).toBe('contents');
  });

  it('leaves an author-set inline display alone', () => {
    const fixture = TestBed.createComponent(HostComponent);
    const host: HTMLElement = fixture.nativeElement.querySelector('dfa-player');
    host.style.display = 'block';
    fixture.detectChanges();
    expect(host.style.display).toBe('block');
  });
});

describe('input → option mapping, as seen in the rendered player', () => {
  it('keeps the control bar when `controls` is never bound', () => {
    // THE case the "absent writes no key" rule exists for: the core defaults
    // `controls` to true, so an unbound input must not read as false.
    const fixture = mount();
    expect(
      fixture.nativeElement.querySelector('.rdfa-controls')
    ).not.toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('.rdfa-player')
        ?.getAttribute('tabindex')
    ).toBe('0');
  });

  it('drops the control bar (and the focus ring) for `controls=false`', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.controls.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.rdfa-controls')).toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('.rdfa-player')
        ?.getAttribute('tabindex')
    ).toBeNull();
  });

  it('forwards height, theme, mode and the extra class to the player root', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.height.set('60vh');
    fixture.componentInstance.theme.set('blueprint');
    fixture.componentInstance.playerClass.set('mine');
    fixture.detectChanges();

    const root: HTMLElement =
      fixture.nativeElement.querySelector('.rdfa-player');
    expect(root.style.height).toBe('60vh');
    expect(root.dataset.theme).toBe('blueprint');
    // Never bound, so the core's own default is what shows up.
    expect(root.dataset.mode).toBe('auto');
    expect(root.classList.contains('mine')).toBe(true);
  });

  it('takes a number as pixels', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.height.set(300);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('.rdfa-player') as HTMLElement).style
        .height
    ).toBe('300px');
  });

  it('adds the JSON spec button only for `exportable`', () => {
    const jsonButton = '[aria-label="Spécification JSON"]';

    const before = mount();
    expect(before.nativeElement.querySelector(jsonButton)).toBeNull();
    before.destroy();

    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.exportable.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(jsonButton)).not.toBeNull();
  });

  it('opens at `initialT` rather than at 0', () => {
    const fixture = TestBed.createComponent(HostComponent);
    // Past a whole second: the control bar rounds, so a smaller instant would
    // read the same as 0.
    fixture.componentInstance.initialT.set(1200);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.rdfa-time')?.textContent
    ).toMatch(/^1s/);
  });
});

describe('remounting', () => {
  it('coalesces several synchronous input changes into ONE remount', () => {
    const fixture = mount();
    const first = fixture.nativeElement.querySelector('.rdfa-player');

    fixture.componentInstance.theme.set('blueprint');
    fixture.componentInstance.height.set(300);
    fixture.componentInstance.playerClass.set('mine');
    fixture.detectChanges();

    // One new player, not three: the single effect is what makes this true.
    expect(fixture.componentInstance.mounts).toHaveLength(2);
    expect(players()).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.rdfa-player')).not.toBe(first);
  });

  it('does NOT remount for a spec rebuilt inline with the same structure', () => {
    // The Angular-specific hazard: `[spec]="buildSpec()"` yields a fresh object
    // on every change detection pass. Keying on the object would remount forever.
    const fixture = mount();
    fixture.componentInstance.rebuildSpec.set(true);
    fixture.detectChanges();
    fixture.detectChanges();
    fixture.detectChanges();

    expect(fixture.componentInstance.mounts).toHaveLength(1);
    expect(players()).toHaveLength(1);
  });

  it('does remount for a structurally different spec', () => {
    const fixture = mount();
    fixture.componentInstance.spec.set(OTHER_SPEC);
    fixture.detectChanges();

    expect(fixture.componentInstance.mounts).toHaveLength(2);
    expect(players()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('PostgreSQL');
  });

  it('reopens at the previous instant, and stops honouring initialT', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.initialT.set(1200);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.rdfa-time')?.textContent
    ).toMatch(/^1s/);

    // Rewind the input AND change something else, so the remount is real.
    fixture.componentInstance.initialT.set(0);
    fixture.componentInstance.theme.set('blueprint');
    fixture.detectChanges();

    expect(fixture.componentInstance.mounts).toHaveLength(2);
    // The resumed instant wins over the freshly written input: only the FIRST
    // mount reads initialT.
    expect(
      fixture.nativeElement.querySelector('.rdfa-time')?.textContent
    ).toMatch(/^1s/);
  });
});

describe('teardown', () => {
  it('destroys the player with the component', () => {
    const cancelRaf = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const fixture = TestBed.createComponent(HostComponent);
    // Playing, so there IS an rAF loop to cancel. Paused, the clock never
    // scheduled a frame and `cancelAnimationFrame` would go uncalled for a reason
    // that has nothing to do with teardown.
    fixture.componentInstance.autoPlay.set(true);
    fixture.detectChanges();
    expect(StubResizeObserver.instances.length).toBeGreaterThan(0);

    fixture.destroy();

    expect(players()).toHaveLength(0);
    // Not just "Angular detached the host": these prove `handle.destroy()` ran.
    expect(cancelRaf).toHaveBeenCalled();
    expect(StubResizeObserver.instances.every((o) => o.disconnected)).toBe(
      true
    );
  });

  it('leaves nothing observing after a remount either', () => {
    const fixture = mount();
    const firstObservers = [...StubResizeObserver.instances];
    fixture.componentInstance.spec.set(OTHER_SPEC);
    fixture.detectChanges();

    expect(firstObservers.every((o) => o.disconnected)).toBe(true);
    fixture.destroy();
    expect(players()).toHaveLength(0);
  });
});

describe('compile warnings', () => {
  it('surfaces them on `mounted`, and logs them only in debug', () => {
    const consoleWarn = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const quiet = TestBed.createComponent(HostComponent);
    quiet.componentInstance.spec.set(WARNING_SPEC);
    quiet.detectChanges();
    // The warnings always reach the host through the output…
    expect(quiet.componentInstance.mounts[0]?.length).toBeGreaterThan(0);
    // …but the console stays quiet unless the consumer asked for debug.
    expect(consoleWarn).not.toHaveBeenCalled();
    quiet.destroy();

    const loud = TestBed.createComponent(HostComponent);
    loud.componentInstance.spec.set(WARNING_SPEC);
    loud.componentInstance.debug.set(true);
    loud.detectChanges();
    expect(consoleWarn).toHaveBeenCalledWith(
      '[dfa-player]',
      expect.stringContaining('move')
    );
  });
});

describe('a spec the compiler rejects', () => {
  it('reports it on `error` and on the console, leaving no player', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(HostComponent);
    // `nodes` is what the compiler and the layout both walk; nulling it is the
    // shortest way to make `mountPlayer` throw for real rather than with a stub.
    fixture.componentInstance.spec.set({
      ...SPEC,
      nodes: undefined as unknown as typeof SPEC.nodes,
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.errors).toHaveLength(1);
    expect(fixture.componentInstance.mounts).toHaveLength(0);
    expect(players()).toHaveLength(0);
    expect(consoleError).toHaveBeenCalled();
  });
});
