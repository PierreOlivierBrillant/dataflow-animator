import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * On-disk accumulator for `compare.ab.spec.ts` / `selftest.ab.spec.ts`.
 *
 * Playwright restarts the worker process (fresh module state) after a
 * FAILING test, to isolate it from the next one — and every cell of
 * `compare.ab.spec.ts` currently fails (panel B is a placeholder), so an
 * in-memory array pushed to per-test and printed from a `test.afterAll`
 * would silently reset on every single test instead of accumulating. Writing
 * each row to disk and reading the full set back in `globalTeardown` (which
 * Playwright guarantees runs exactly once, in the main process, regardless
 * of worker restarts) is what makes one final table possible.
 */
export interface AbResultRow {
  label: string;
  ratio: number;
  /**
   * Mount-vs-update only: whether the two normalised DOM serialisations were
   * identical. It is the PRIMARY signal there — the pixel ratio beside it is a
   * backstop, since a structural drift can be real long before it moves a pixel.
   */
  htmlEqual?: boolean;
  /** Why a cell is not asserted strictly (see the crossfade note in the spec). */
  note?: string;
}

export type AbSpec = 'selftest' | 'mountupdate' | 'element';

const RESULTS_DIR = fileURLToPath(new URL('./.ab-results', import.meta.url));

function resultsFile(spec: AbSpec): string {
  return `${RESULTS_DIR}/${spec}.ndjson`;
}

export function clearAbResults(spec: AbSpec): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(resultsFile(spec), '');
}

export function appendAbResult(spec: AbSpec, row: AbResultRow): void {
  appendFileSync(resultsFile(spec), `${JSON.stringify(row)}\n`);
}

export function readAbResults(spec: AbSpec): AbResultRow[] {
  const file = resultsFile(spec);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as AbResultRow);
}
