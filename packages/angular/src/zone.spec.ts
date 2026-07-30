import { NgZone, provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HostComponent, StubResizeObserver } from './spec-helpers';

/**
 * INVARIANT: the core's rAF loop must not run inside the Angular zone.
 *
 * The clock schedules a frame for as long as the player plays. Inside the zone,
 * every one of those frames would trigger change detection across the whole
 * application — the single Angular-specific correctness point of this binding.
 *
 * The assertion is on the ZONE AT SCHEDULE TIME, not on a spy over
 * `runOutsideAngular`, and both halves of that sentence matter:
 *
 *  - zone.js captures the zone when a frame is SCHEDULED, which is why wrapping
 *    the mount is enough for the whole loop: the clock reschedules from inside its
 *    own tick, and that tick already runs outside.
 *  - counting `runOutsideAngular` calls would be noise. Angular calls it itself
 *    (four times, measured), so the count says nothing about this component.
 *
 * The setup below is what makes the test FALSIFIABLE, and it took a wrong version
 * first: under the default TestBed, `detectChanges` does not run inside the
 * Angular zone at all, so the assertion passed even with `runOutsideAngular`
 * removed — green, and proving nothing. With `provideZoneChangeDetection()` and
 * change detection triggered inside `zone.run(...)` — which is what a real
 * zone-based application does — removing `runOutsideAngular` from the component
 * yields `["angular"]` and this test fails. That was verified by hand.
 */

/** The zone recorded at each `requestAnimationFrame` call. */
let zonesAtSchedule: (string | undefined)[] = [];
let realRaf: typeof requestAnimationFrame;

const currentZoneName = (): string | undefined =>
  (globalThis as unknown as { Zone?: { current: { name: string } } }).Zone
    ?.current.name;

beforeEach(() => {
  StubResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', StubResizeObserver);

  zonesAtSchedule = [];
  realRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    zonesAtSchedule.push(currentZoneName());
    return realRaf(callback);
  }) as typeof requestAnimationFrame;

  TestBed.configureTestingModule({
    providers: [provideZoneChangeDetection()],
  });
});

afterEach(() => {
  globalThis.requestAnimationFrame = realRaf;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('schedules every animation frame OUTSIDE the Angular zone', () => {
  const zone = TestBed.inject(NgZone);
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.autoPlay.set(true);

  // Inside the zone, as a real application's change detection is.
  zone.run(() => fixture.detectChanges());

  expect(zonesAtSchedule.length).toBeGreaterThan(0);
  expect(zonesAtSchedule).not.toContain('angular');
  fixture.destroy();
});

it('keeps the frames outside the zone across a remount too', () => {
  const zone = TestBed.inject(NgZone);
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.autoPlay.set(true);
  zone.run(() => fixture.detectChanges());

  const afterFirstMount = zonesAtSchedule.length;
  zone.run(() => {
    fixture.componentInstance.theme.set('blueprint');
    fixture.detectChanges();
  });

  expect(zonesAtSchedule.length).toBeGreaterThan(afterFirstMount);
  expect(zonesAtSchedule).not.toContain('angular');
  fixture.destroy();
});

it('emits `mounted` INSIDE the zone, even though it mounted outside it', () => {
  // The other half of the invariant. `runOutsideAngular` restores the zone before
  // returning, so the notification lands inside it — without that, a consumer's
  // handler that writes a signal would get no change detection. Emitting from
  // inside the `runOutsideAngular` callback would make this `[false, false]`.
  const zone = TestBed.inject(NgZone);
  const fixture = TestBed.createComponent(HostComponent);
  zone.run(() => fixture.detectChanges());
  zone.run(() => {
    fixture.componentInstance.theme.set('blueprint');
    fixture.detectChanges();
  });

  expect(fixture.componentInstance.mounts).toHaveLength(2);
  expect(fixture.componentInstance.mountZones).toEqual([true, true]);
  fixture.destroy();
});
