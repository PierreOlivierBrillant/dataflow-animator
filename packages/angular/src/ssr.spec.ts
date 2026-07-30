import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HostComponent, StubResizeObserver } from './spec-helpers';

/**
 * INVARIANT: nothing reaches the DOM on a server.
 *
 * Angular SSR is ordinary, so the component renders a bare, empty host element
 * server-side and mounts only in a browser — the same contract as the React
 * binding's client effect and the custom element's conditional base class.
 *
 * The platform is faked rather than the DOM removed, and that is on purpose: it is
 * the `isPlatformBrowser` GUARD that is under test. A jsdom run with a real
 * `document` present is the harsher setting — if the guard were missing, the
 * player would happily mount here and every assertion below would fail.
 */

let zonesAtSchedule: number;
let realRaf: typeof requestAnimationFrame;

beforeEach(() => {
  StubResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', StubResizeObserver);

  zonesAtSchedule = 0;
  realRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    zonesAtSchedule++;
    return realRaf(callback);
  }) as typeof requestAnimationFrame;

  TestBed.configureTestingModule({
    providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
  });
});

afterEach(() => {
  globalThis.requestAnimationFrame = realRaf;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('mounts nothing when the platform is the server', () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.autoPlay.set(true);
  fixture.detectChanges();

  expect(document.querySelectorAll('.rdfa-player')).toHaveLength(0);
  expect(fixture.componentInstance.mounts).toHaveLength(0);
  expect(fixture.componentInstance.errors).toHaveLength(0);
});

it('starts no clock and observes nothing on the server', () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.autoPlay.set(true);
  fixture.detectChanges();

  expect(zonesAtSchedule).toBe(0);
  expect(StubResizeObserver.instances).toHaveLength(0);
});

it('leaves the host element untouched, styles included', () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();

  const host: HTMLElement = fixture.nativeElement.querySelector('dfa-player');
  expect(host.children).toHaveLength(0);
  // Not even the `display: contents` fix-up: it is DOM mutation, so it lives
  // behind the same guard as the mount.
  expect(host.style.display).toBe('');
});

it('destroys cleanly without ever having mounted', () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  expect(() => fixture.destroy()).not.toThrow();
});
