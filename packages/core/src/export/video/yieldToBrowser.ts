/**
 * Returns to the event loop so the page can paint and run its own work.
 *
 * The obvious `setTimeout(resolve, 0)` is the wrong tool here: browsers clamp
 * nested timeouts to about 4 ms, and an export yields between frames that
 * themselves take only a few milliseconds — so the clamp alone added roughly
 * six percentage points to the cost of a measured export. The alternatives cost
 * nothing per call and give up the thread just as genuinely:
 *
 *  - `scheduler.yield()` where it exists — the API meant for exactly this, and
 *    the only one that also asks to be resumed ahead of unrelated tasks;
 *  - a `MessageChannel` message otherwise, which is a macrotask (so rendering
 *    gets its turn) with no clamp. A microtask would NOT do: the browser never
 *    paints between microtasks, so the page would still freeze.
 *
 * The channel is created once and reused; one per yield would leak a port pair
 * on every frame of a long export.
 */

interface SchedulerWithYield {
  yield?: () => Promise<void>;
}

let channel: MessageChannel | undefined;

export function yieldToBrowser(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: SchedulerWithYield })
    .scheduler;
  if (typeof scheduler?.yield === 'function') return scheduler.yield();

  if (typeof MessageChannel === 'undefined') {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  channel ??= new MessageChannel();
  const { port1, port2 } = channel;
  return new Promise((resolve) => {
    port1.onmessage = () => {
      port1.onmessage = null;
      resolve();
    };
    port2.postMessage(null);
  });
}
