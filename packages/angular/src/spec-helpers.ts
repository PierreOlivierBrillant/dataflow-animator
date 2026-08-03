import { Component, NgZone, signal } from '@angular/core';
import type { DataFlowSpec, PlayerLabels } from '@dataflow-animator/core';
import { DataFlowPlayerComponent } from './DataFlowPlayerComponent';

/**
 * Shared scaffolding for the specs. NOT part of the library — excluded from
 * `tsconfig.lib.json`, so it is never compiled into the published package.
 *
 * The specs mount the REAL core renderer, with no stub in sight: the only thing
 * worth asserting about a wrapper this thin is that the real player comes out the
 * other end.
 */

export const SPEC: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'editor', type: 'laptop', text: 'IDE', icon: 'typescript', lane: 1 },
    { id: 'server', type: 'server', text: 'Server', icon: 'node', lane: 2 },
  ],
  packets: [
    { id: 'd', kind: 'http_packet', packet_content: { header: 'GET /' } },
  ],
  timeline: [
    { type: 'move', object: 'd', from: 'editor', to: 'server', duration: 600 },
  ],
};

/** A second spec, structurally different from {@link SPEC}. */
export const OTHER_SPEC: DataFlowSpec = {
  ...SPEC,
  nodes: [
    ...SPEC.nodes,
    { id: 'db', type: 'database', text: 'PostgreSQL', lane: 3 },
  ],
};

/**
 * A spec the compiler accepts but complains about: a `move` with no `to`.
 *
 * The cast is the point of the fixture — `to` is required by the TYPES, and what
 * is being exercised is the compiler's runtime tolerance of a spec that came from
 * JSON and never saw a typechecker.
 */
export const WARNING_SPEC: DataFlowSpec = {
  ...SPEC,
  timeline: [
    {
      type: 'move',
      object: 'd',
      from: 'editor',
    } as DataFlowSpec['timeline'][number],
  ],
};

/**
 * A ResizeObserver that jsdom does not provide.
 *
 * Installed for real rather than left absent: the core guards
 * `typeof ResizeObserver === 'undefined'` and skips observing entirely, so without
 * this any "nothing is left observing" assertion would pass against an observer
 * that was never created — a green test proving nothing.
 */
export class StubResizeObserver {
  static instances: StubResizeObserver[] = [];
  observed = 0;
  disconnected = false;
  constructor() {
    StubResizeObserver.instances.push(this);
  }
  observe(): void {
    this.observed++;
  }
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
}

/**
 * The host every spec drives. Inputs are signals so a test can change several of
 * them synchronously and check that they coalesce into ONE remount.
 *
 * Bindings use the signal values directly rather than a method call, except
 * `specFactory`, which exists to reproduce the hazard the structural spec key is
 * there for: a template that rebuilds the spec object on every pass.
 */
@Component({
  imports: [DataFlowPlayerComponent],
  template: `<dfa-player
    [spec]="rebuildSpec() ? { ...spec() } : spec()"
    [labels]="rebuildLabels() ? { ...labels() } : labels()"
    [theme]="theme()"
    [density]="density()"
    [height]="height()"
    [controls]="controls()"
    [exportable]="exportable()"
    [playerClass]="playerClass()"
    [initialT]="initialT()"
    [autoPlay]="autoPlay()"
    [debug]="debug()"
    (mounted)="onMounted($event.warnings)"
    (error)="errors.push($event.error)"
  />`,
})
export class HostComponent {
  readonly spec = signal<DataFlowSpec>(SPEC);
  readonly rebuildSpec = signal(false);
  readonly labels = signal<Partial<PlayerLabels> | undefined>(undefined);
  /** Same hazard as `rebuildSpec`, for the labels object. */
  readonly rebuildLabels = signal(false);
  readonly theme = signal<'default' | 'blueprint' | undefined>(undefined);
  readonly density = signal<'compact' | 'comfortable' | 'spacious' | undefined>(
    undefined
  );
  readonly height = signal<number | string | undefined>(undefined);
  readonly controls = signal<boolean | undefined>(undefined);
  readonly exportable = signal<boolean | undefined>(undefined);
  readonly playerClass = signal<string | undefined>(undefined);
  readonly initialT = signal<number | undefined>(undefined);
  readonly autoPlay = signal<boolean | undefined>(undefined);
  readonly debug = signal<boolean | undefined>(undefined);

  /** One entry per successful mount, in order. */
  readonly mounts: (readonly string[])[] = [];
  /**
   * The zone each `mounted` notification arrived in. An `output()` calls its
   * subscribers synchronously, in the emitter's zone, so this records where the
   * component actually was when it emitted — which is the point: the mount runs
   * outside the zone, the notification must not.
   */
  readonly mountZones: boolean[] = [];
  readonly errors: unknown[] = [];

  onMounted(warnings: readonly string[]): void {
    this.mounts.push(warnings);
    this.mountZones.push(NgZone.isInAngularZone());
  }
}
