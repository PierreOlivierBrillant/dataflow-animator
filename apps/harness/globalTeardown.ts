import { readAbResults, type AbResultRow } from './abResults';

function printSelfTest(rows: AbResultRow[]): void {
  if (rows.length === 0) return;
  const lines = [
    '',
    'Self-test calibration — vanilla vs itself (0.00% required everywhere)',
    '',
    'label'.padEnd(40) + 'diff',
  ];
  for (const r of rows) {
    lines.push(r.label.padEnd(40) + `${(r.ratio * 100).toFixed(4)}%`);
  }
  const failing = rows.filter((r) => r.ratio !== 0);
  lines.push(
    '',
    failing.length > 0
      ? `${failing.length}/${rows.length} check(s) NOT calibrated (non-zero drift) — DOM measurement is nondeterministic.`
      : `All ${rows.length} check(s) at exactly 0.00% — the measurement floor is zero.`
  );
  console.log(lines.join('\n'));
}

/**
 * Mount-vs-update: the retained renderer against itself.
 *
 * `html` is the verdict that counts. The pixel column is printed beside it as a
 * corroborating signal, but a structural divergence is real whether or not it
 * has grown large enough to move a pixel yet, so it is the one that decides.
 */
function printMountUpdate(rows: AbResultRow[]): void {
  if (rows.length === 0) return;
  const lines = [
    '',
    'mount(t) vs mount(0)+update(...) — the retained renderer against itself',
    '',
    'label'.padEnd(30) + 'html'.padEnd(10) + 'pixels'.padEnd(12) + 'note',
  ];
  for (const r of rows) {
    lines.push(
      r.label.padEnd(30) +
        (r.htmlEqual ? 'equal' : 'DIFF').padEnd(10) +
        `${(r.ratio * 100).toFixed(4)}%`.padEnd(12) +
        (r.note ?? '')
    );
  }
  const asserted = rows.filter((r) => !r.note);
  const drifting = asserted.filter((r) => !r.htmlEqual);
  lines.push(
    '',
    drifting.length > 0
      ? `${drifting.length}/${asserted.length} asserted cell(s) DRIFTED — retained mode does not converge to a fresh mount.`
      : `All ${asserted.length} asserted cell(s) identical; ${rows.length - asserted.length} excluded (documented path dependence).`
  );
  console.log(lines.join('\n'));
}

/**
 * The custom element against the call it wraps.
 *
 * `<dataflow-player>` does nothing but `mountPlayer(this, spec, options)`, so
 * anything other than 0.0000% means the wrapper is changing the picture — either
 * its own box is interfering or an attribute is not landing as the option it
 * claims to be. There is no tolerance to spend here.
 */
function printElement(rows: AbResultRow[]): void {
  if (rows.length === 0) return;
  const lines = [
    '',
    'mountPlayer vs <dataflow-player> — the custom element adds no pixel',
    '',
    'label'.padEnd(44) + 'diff',
  ];
  for (const r of rows) {
    lines.push(r.label.padEnd(44) + `${(r.ratio * 100).toFixed(4)}%`);
  }
  const failing = rows.filter((r) => r.ratio !== 0);
  lines.push(
    '',
    failing.length > 0
      ? `${failing.length}/${rows.length} cell(s) DIFFER — the element is not a transparent wrapper.`
      : `All ${rows.length} cell(s) at exactly 0.0000% — the element renders what mountPlayer renders.`
  );
  console.log(lines.join('\n'));
}

/**
 * Runs exactly once, in the main process, after every worker has finished —
 * unlike a `test.afterAll` inside a spec, immune to the per-worker module resets
 * that per-test failures trigger (see abResults.ts). It only prints the
 * accumulated tables; the pass/fail verdicts are asserted inside each spec.
 */
export default function globalTeardown(): void {
  printSelfTest(readAbResults('selftest'));
  printMountUpdate(readAbResults('mountupdate'));
  printElement(readAbResults('element'));
}
