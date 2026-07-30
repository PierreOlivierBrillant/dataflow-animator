import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The external consumer smoke test: `@dataflow-animator/core` and
 * `@dataflow-animator/element`, installed together from real tarballs, OUTSIDE
 * this monorepo.
 *
 * It exists because everything in-repo resolves the core to its SOURCE through an
 * alias — vitest, `tsc` and the harness all agree, which is what removes the
 * build-order coupling, and also what leaves three things completely unverified:
 *
 *  - the core's published `exports` map (in-repo, the alias short-circuits it, so
 *    `@dataflow-animator/core/styles.css` is never actually resolved through it);
 *  - the flattened `dist/index.d.ts` of both packages, and whether the element's
 *    declaration can really reach the core's types by import;
 *  - the dependency RANGE the element declares (npm workspaces satisfies any range
 *    with a symlink, so `"*"` would look fine forever).
 *
 * Not wired into CI: it needs the network and a full install. It is the gate to
 * run before publishing — and the core must be published BEFORE the element.
 *
 * Usage: `npm run smoke:consumer -w @dataflow-animator/element [-- --keep]`
 */

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ELEMENT_DIR = join(HERE, '..');
const REPO_ROOT = join(ELEMENT_DIR, '..', '..');
const KEEP = process.argv.includes('--keep');

let step = 0;
const heading = (text) => console.log(`\n[${++step}] ${text}`);
const ok = (text) => console.log(`    ok   ${text}`);

const failures = [];
function check(condition, text) {
  if (condition) ok(text);
  else {
    console.log(`    FAIL ${text}`);
    failures.push(text);
  }
}

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

const workDir = mkdtempSync(join(tmpdir(), 'dfa-element-smoke-'));
const consumerDir = join(workDir, 'consumer');
mkdirSync(consumerDir);

try {
  // ── 1. Build, so the tarballs carry the current sources ───────────────────
  heading('Building @dataflow-animator/core and @dataflow-animator/element');
  run('npm', ['run', 'build', '-w', '@dataflow-animator/core'], REPO_ROOT);
  run('npm', ['run', 'build', '-w', '@dataflow-animator/element'], REPO_ROOT);
  ok('both packages built');

  // ── 2. Pack ───────────────────────────────────────────────────────────────
  heading('Packing both tarballs');
  const packedRaw = JSON.parse(
    run(
      'npm',
      [
        'pack',
        '-w',
        '@dataflow-animator/core',
        '-w',
        '@dataflow-animator/element',
        '--pack-destination',
        workDir,
        '--json',
      ],
      REPO_ROOT
    )
  );
  // npm 11 returns an object keyed by package name; older npm returns an array of
  // the same entries. Normalise so this script does not pin an npm major.
  const packed = Array.isArray(packedRaw)
    ? packedRaw
    : Object.values(packedRaw);
  const tarballOf = (name) => {
    const entry = packed.find((p) => p.name === name);
    if (!entry) throw new Error(`npm pack produced no tarball for ${name}`);
    return join(workDir, entry.filename);
  };
  const coreTarball = tarballOf('@dataflow-animator/core');
  const elementTarball = tarballOf('@dataflow-animator/element');
  for (const entry of packed)
    ok(
      `${entry.name} → ${entry.filename} (${entry.size} B packed, ${entry.unpackedSize} B unpacked, ${entry.files.length} files)`
    );

  // ── 3. Publish-shape checks on the element tarball ────────────────────────
  heading('Checking what the element tarball actually ships');
  const contents = run('tar', ['-tzf', elementTarball], workDir)
    .split('\n')
    .filter(Boolean);
  check(
    contents.includes('package/dist/index.js'),
    'dist/index.js is present'
  );
  check(
    contents.includes('package/dist/index.d.ts'),
    'dist/index.d.ts is present'
  );
  check(contents.includes('package/LICENSE'), 'LICENSE is present');
  check(contents.includes('package/README.md'), 'README.md is present');
  // The stylesheet ships ONCE, from the core. A .css here would be a second copy
  // of the same bytes in every install.
  check(
    !contents.some((f) => f.endsWith('.css')),
    'no stylesheet in the tarball (the CSS belongs to the core)'
  );

  const manifest = JSON.parse(
    readFileSync(join(ELEMENT_DIR, 'package.json'), 'utf8')
  );
  const range = manifest.dependencies?.['@dataflow-animator/core'];
  check(
    /^\^\d+\.\d+\.\d+$/.test(range ?? ''),
    `the core is a real semver range (${range}), not "*", "file:" or "workspace:"`
  );
  check(
    Array.isArray(manifest.sideEffects) &&
      manifest.sideEffects.includes('./dist/index.js'),
    'dist/index.js is marked as having side effects (it registers the tag)'
  );

  const declaration = readFileSync(
    join(ELEMENT_DIR, 'dist', 'index.d.ts'),
    'utf8'
  );
  check(
    declaration.includes("from '@dataflow-animator/core'"),
    "the declaration REFERENCES the core's types by import"
  );
  // A flattened copy would be a fork waiting to drift: a consumer must resolve
  // ONE `DataFlowSpec` whichever package they import it from.
  check(
    !/\b(interface|type)\s+DataFlowSpec\b/.test(declaration),
    'no core type is inlined into the declaration'
  );

  const bundle = readFileSync(join(ELEMENT_DIR, 'dist', 'index.js'), 'utf8');
  const imports = [...bundle.matchAll(/from ?"([^"]+)"/g)].map((m) => m[1]);
  check(
    imports.length > 0 && imports.every((id) => id === '@dataflow-animator/core'),
    `the bundle imports only the core (${[...new Set(imports)].join(', ') || 'nothing'})`
  );
  // This package renders no markup of its own, so unlike the React bundle (whose
  // pre-mount placeholder makes `rdfa-` a false positive) these are valid
  // canaries for "the engine got inlined".
  for (const canary of ['rdfa-', 'createPlayerClock', 'requestAnimationFrame'])
    check(!bundle.includes(canary), `no \`${canary}\` inlined in the bundle`);

  // ── 4. A throwaway consumer project, outside the monorepo ─────────────────
  heading('Installing both tarballs in a throwaway project');
  const devDeps = manifest.devDependencies;
  writeFileSync(
    join(consumerDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'dataflow-element-consumer',
        private: true,
        version: '0.0.0',
        type: 'module',
        dependencies: {
          '@dataflow-animator/core': `file:${coreTarball}`,
          '@dataflow-animator/element': `file:${elementTarball}`,
        },
        // Without this, npm resolves the element's own `^0.1.0` dependency on the
        // core from the REGISTRY — where it may not exist yet, and where it would
        // certainly not be the build under test.
        overrides: {
          '@dataflow-animator/core': `file:${coreTarball}`,
        },
        devDependencies: {
          jsdom: devDeps.jsdom,
          typescript: devDeps.typescript,
          vitest: devDeps.vitest,
        },
      },
      null,
      2
    )}\n`
  );

  writeFileSync(
    join(consumerDir, 'mount.test.ts'),
    `/** @vitest-environment jsdom */
import { expect, it } from 'vitest';
// The two imports the README tells a consumer to write — and the only place the
// core's published \`exports\` map for "./styles.css" is ever really resolved.
import {
  DEFAULT_TAG_NAME,
  MOUNTED_EVENT,
  type DataFlowPlayerElement,
  type DataFlowSpec,
} from '@dataflow-animator/element';
import '@dataflow-animator/core/styles.css';

const spec: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'browser', type: 'laptop', text: 'Browser', lane: 1 },
    { id: 'api', type: 'server', text: 'API', lane: 2 },
  ],
  packets: [
    { id: 'req', kind: 'http_packet', packet_content: { header: 'GET /users' } },
  ],
  timeline: [{ type: 'move', object: 'req', from: 'browser', to: 'api' }],
};

it('mounts and tears down, installed from the tarballs', async () => {
  const el = document.createElement(DEFAULT_TAG_NAME) as DataFlowPlayerElement;
  el.spec = spec;
  const mounted = new Promise<void>((resolve) =>
    el.addEventListener(MOUNTED_EVENT, () => resolve(), { once: true })
  );
  document.body.append(el);
  await mounted;

  expect(el.querySelector('.rdfa-player')).not.toBeNull();
  expect(el.querySelector('.rdfa-controls')).not.toBeNull();
  expect(el.textContent).toContain('Browser');
  expect(el.textContent).toContain('API');

  el.remove();
  expect(document.querySelectorAll('.rdfa-player')).toHaveLength(0);
});
`
  );

  writeFileSync(
    join(consumerDir, 'types.ts'),
    `// Compiled with \`tsc --noEmit\` against the PUBLISHED declarations, so this file
// is what proves the element's thin d.ts can reach the core's types by import.
import {
  DataFlowPlayerElement,
  defineDataFlowPlayer,
  type DataFlowSpec,
  type Density,
  type Highlighter,
  type PlayerMode,
  type PlayerTheme,
} from '@dataflow-animator/element';

const spec: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [{ id: 'a', type: 'server', text: 'A', lane: 1 }],
  packets: [],
  timeline: [],
};

const theme: PlayerTheme = 'blueprint';
const mode: PlayerMode = 'dark';
const density: Density = 'compact';
const highlight: Highlighter = (code, language) => \`\${language}:\${code}\`;

export function wire(): void {
  defineDataFlowPlayer('my-player');
  // Typed by the HTMLElementTagNameMap augmentation the package ships.
  const el = document.querySelector('dataflow-player');
  if (!el) return;
  const typed: DataFlowPlayerElement = el;
  typed.spec = spec;
  typed.theme = theme;
  typed.mode = mode;
  typed.density = density;
  typed.highlight = highlight;
  typed.height = '60vh';
  typed.controls = false;
  typed.initialT = 1200;
}
`
  );

  writeFileSync(
    join(consumerDir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'es2023',
          lib: ['ES2023', 'DOM', 'DOM.Iterable'],
          module: 'esnext',
          moduleResolution: 'bundler',
          types: [],
          strict: true,
          noEmit: true,
          // NOT skipped: the point is to typecheck the published declarations
          // themselves, not just this file against them.
          skipLibCheck: false,
        },
        include: ['types.ts'],
      },
      null,
      2
    )}\n`
  );

  run(
    'npm',
    ['install', '--no-audit', '--no-fund', '--loglevel=error'],
    consumerDir
  );
  ok('installed');

  // ── 5. (a) it really mounts ───────────────────────────────────────────────
  heading('Running the consumer mount test (vitest + jsdom)');
  console.log(run('npx', ['vitest', 'run'], consumerDir));
  ok('the element mounts and tears down through the published packages');

  // ── 6. (b) the types really resolve ───────────────────────────────────────
  heading('Typechecking a consumer file against the published declarations');
  run('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], consumerDir);
  ok('tsc --noEmit is clean');
} finally {
  if (KEEP) console.log(`\nkept: ${workDir}`);
  else rmSync(workDir, { recursive: true, force: true });
}

console.log('');
if (failures.length > 0) {
  console.error(
    `${failures.length} publish-shape check(s) FAILED:\n  - ${failures.join('\n  - ')}`
  );
  process.exit(1);
}
console.log('External consumer smoke test: all checks passed.');
