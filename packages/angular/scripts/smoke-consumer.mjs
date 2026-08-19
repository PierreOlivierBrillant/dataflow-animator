import { execFileSync } from 'node:child_process';
import { createReadStream, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The external consumer smoke test: `@dataflow-animator/core` and
 * `@dataflow-animator/angular`, installed together from real tarballs, into a real
 * Angular CLI workspace, OUTSIDE this monorepo.
 *
 * For an Angular library this is not a nicety, it is THE gate — more so than for
 * the other bindings. The published package is **partial-compiled**: its component
 * ships as `ɵɵngDeclareComponent` metadata that the CONSUMER's own Angular
 * compiler links during their AOT build. Nothing inside this repository ever
 * exercises that link. `ng build` here does, and it is the only thing that can.
 *
 * Everything in-repo also resolves the core to its SOURCE through a tsconfig
 * `paths` alias, which leaves the same three things unverified as for the element:
 * the core's published `exports` map, the flattened `.d.ts` of both packages, and
 * the dependency RANGE this package declares (npm workspaces satisfies any range
 * with a symlink, so `"*"` would look fine forever).
 *
 * Not wired into CI: it needs the network, a full Angular CLI install and a
 * browser. It is the gate to run before publishing — and the core must be
 * published BEFORE the binding.
 *
 * Usage: `npm run smoke:consumer -w @dataflow-animator/angular [-- --keep]`
 */

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ANGULAR_DIR = join(HERE, '..');
const REPO_ROOT = join(ANGULAR_DIR, '..', '..');
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

const workDir = mkdtempSync(join(tmpdir(), 'dfa-angular-smoke-'));
const consumerDir = join(workDir, 'consumer');
mkdirSync(join(consumerDir, 'src'), { recursive: true });

let server;

try {
  // ── 1. Build, so the tarballs carry the current sources ───────────────────
  heading('Building @dataflow-animator/core and @dataflow-animator/angular');
  run('npm', ['run', 'build', '-w', '@dataflow-animator/core'], REPO_ROOT);
  run('npm', ['run', 'build', '-w', '@dataflow-animator/angular'], REPO_ROOT);
  ok('both packages built');

  // ── 2. Pack ───────────────────────────────────────────────────────────────
  //
  // The core packs from its workspace root like every other package here. The
  // Angular one packs from `dist/`: ng-packagr GENERATES the published manifest
  // (its own `exports`, `module`, `typings`, and a `dependencies` section with the
  // devDependencies stripped), so `dist/` — not the workspace root — is the
  // package. Packing the root would ship the sources and none of the entry points.
  heading('Packing both tarballs');
  const packOne = (args, cwd) => {
    const raw = JSON.parse(run('npm', ['pack', ...args, '--pack-destination', workDir, '--json'], cwd));
    const entry = (Array.isArray(raw) ? raw : Object.values(raw))[0];
    ok(`${entry.name} → ${entry.filename} (${entry.size} B packed, ${entry.unpackedSize} B unpacked, ${entry.files.length} files)`);
    return { path: join(workDir, entry.filename), entry };
  };
  const core = packOne(['-w', '@dataflow-animator/core'], REPO_ROOT);
  const angular = packOne(['.'], join(ANGULAR_DIR, 'dist'));

  // ── 3. Publish-shape checks on the Angular tarball ────────────────────────
  heading('Checking what the Angular tarball actually ships');
  const contents = run('tar', ['-tzf', angular.path], workDir).split('\n').filter(Boolean);
  const has = (file) => contents.includes(`package/${file}`);

  const manifest = JSON.parse(readFileSync(join(ANGULAR_DIR, 'dist', 'package.json'), 'utf8'));
  const fesm = manifest.module;
  const types = manifest.typings;

  check(has(fesm), `${fesm} is present`);
  check(has(types), `${types} is present`);
  check(has('LICENSE'), 'LICENSE is present');
  check(has('README.md'), 'README.md is present');
  // The stylesheet ships ONCE, from the core. A .css here would be a second copy
  // of the same bytes in every install.
  check(!contents.some((f) => f.endsWith('.css')), 'no stylesheet in the tarball (the CSS belongs to the core)');

  // Partial compilation is what lets a consumer's own Angular version link this
  // package. Left in FULL mode, ng-packagr writes a `prepublishOnly` into the
  // manifest that hard-fails `npm publish` — so this pair of checks is the early
  // warning for a broken `angularCompilerOptions`.
  check(manifest.scripts === undefined, 'no `scripts` in the published manifest (i.e. not a full-compilation build)');

  const range = manifest.dependencies?.['@dataflow-animator/core'];
  check(/^\^\d+\.\d+\.\d+$/.test(range ?? ''), `the core is a real semver range (${range}), not "*", "file:" or "workspace:"`);
  check(manifest.peerDependencies?.['@angular/core'] !== undefined, 'Angular is a peer dependency, not a bundled one');

  const declaration = readFileSync(join(ANGULAR_DIR, 'dist', types), 'utf8');
  check(declaration.includes("from '@dataflow-animator/core'"), "the declaration REFERENCES the core's types by import");
  // A flattened copy would be a fork waiting to drift: a consumer must resolve ONE
  // `DataFlowSpec` whichever package they import it from.
  check(!/\b(interface|type)\s+DataFlowSpec\b/.test(declaration), 'no core type is inlined into the declaration');

  const bundle = readFileSync(join(ANGULAR_DIR, 'dist', fesm), 'utf8');
  check(bundle.includes('ɵɵngDeclareComponent'), 'the component is partial-compiled (ɵɵngDeclareComponent)');
  check(!bundle.includes('ɵɵdefineComponent'), 'the component is NOT full-compiled (no ɵɵdefineComponent)');

  // Anchored to the start of a line: ng-packagr KEEPS the JSDoc, and this
  // package's own comments quote import statements and `.rdfa-player` in prose.
  // An unanchored grep for either would be a false positive — the same trap the
  // React bundle has with its pre-mount placeholder, arriving here by a different
  // road.
  const imports = [...bundle.matchAll(/^import\s[^;]*?from\s*'([^']+)'/gm)].map((m) => m[1]);
  const allowed = new Set(['@angular/core', '@angular/common', '@dataflow-animator/core', 'tslib']);
  check(
    imports.length > 0 && imports.every((id) => allowed.has(id)),
    `the bundle imports only Angular and the core (${[...new Set(imports)].join(', ') || 'nothing'})`
  );
  // Quoted, for the same reason: `.rdfa-player` appears in this package's own
  // documentation comments, but a class name the engine EMITS would be a string.
  for (const canary of ["'rdfa-", '"rdfa-', 'createPlayerClock', 'requestAnimationFrame', 'ResizeObserver'])
    check(!bundle.includes(canary), `no \`${canary}\` inlined in the bundle`);

  // ── 4. A throwaway Angular CLI workspace, outside the monorepo ────────────
  heading('Scaffolding a minimal Angular workspace and installing both tarballs');
  const devDeps = JSON.parse(readFileSync(join(ANGULAR_DIR, 'package.json'), 'utf8')).devDependencies;

  writeFileSync(
    join(consumerDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'dataflow-angular-consumer',
        private: true,
        version: '0.0.0',
        dependencies: {
          '@angular/common': devDeps['@angular/common'],
          '@angular/compiler': devDeps['@angular/compiler'],
          '@angular/core': devDeps['@angular/core'],
          '@angular/platform-browser': devDeps['@angular/platform-browser'],
          '@dataflow-animator/angular': `file:${angular.path}`,
          '@dataflow-animator/core': `file:${core.path}`,
          'zone.js': devDeps['zone.js'],
        },
        devDependencies: {
          '@angular/build': devDeps['@angular/build'],
          '@angular/cli': devDeps['@angular/cli'],
          '@angular/compiler-cli': devDeps['@angular/compiler-cli'],
          typescript: devDeps.typescript,
        },
        // Without this, npm resolves the binding's own `^1.0.0` dependency on the
        // core from the REGISTRY — where it may not exist yet, and where it would
        // certainly not be the build under test.
        overrides: { '@dataflow-animator/core': `file:${core.path}` },
      },
      null,
      2
    )}\n`
  );

  writeFileSync(
    join(consumerDir, 'angular.json'),
    `${JSON.stringify(
      {
        $schema: './node_modules/@angular/cli/lib/config/schema.json',
        version: 1,
        projects: {
          consumer: {
            projectType: 'application',
            root: '',
            sourceRoot: 'src',
            architect: {
              build: {
                builder: '@angular/build:application',
                options: {
                  browser: 'src/main.ts',
                  index: 'src/index.html',
                  tsConfig: 'tsconfig.json',
                  polyfills: ['zone.js'],
                  // The ONLY place the core's published `exports` entry for
                  // "./styles.css" is resolved by a real consumer toolchain.
                  styles: ['@dataflow-animator/core/styles.css'],
                  outputHashing: 'none',
                },
                configurations: { production: { optimization: true } },
                defaultConfiguration: 'production',
              },
            },
          },
        },
      },
      null,
      2
    )}\n`
  );

  writeFileSync(
    join(consumerDir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          module: 'preserve',
          moduleResolution: 'bundler',
          strict: true,
          experimentalDecorators: true,
          // NOT skipped: the point is to typecheck the published declarations
          // themselves, not just this app against them.
          skipLibCheck: false,
        },
        angularCompilerOptions: { strictTemplates: true },
        include: ['src/**/*.ts'],
      },
      null,
      2
    )}\n`
  );

  writeFileSync(
    join(consumerDir, 'src', 'index.html'),
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>consumer</title></head><body><app-root></app-root></body></html>\n'
  );

  writeFileSync(
    join(consumerDir, 'src', 'app.ts'),
    `import { Component } from '@angular/core';
// The two imports the README tells a consumer to write. \`strictTemplates\` is on,
// so every binding below is typechecked against the PUBLISHED declaration —
// including the signal inputs, which only exist because the component was
// partial-compiled and the consumer's compiler linked it.
import {
  DataFlowPlayerComponent,
  type DataFlowSpec,
} from '@dataflow-animator/angular';

const SPEC: DataFlowSpec = {
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

@Component({
  selector: 'app-root',
  imports: [DataFlowPlayerComponent],
  template: \`<dfa-player
    [spec]="spec"
    [height]="420"
    theme="blueprint"
    [exportable]="true"
  />\`,
})
export class AppComponent {
  readonly spec = SPEC;
}
`
  );

  writeFileSync(
    join(consumerDir, 'src', 'main.ts'),
    `import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app';

void bootstrapApplication(AppComponent);
`
  );

  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], consumerDir);
  ok('installed');

  // ── 5. THE gate: an AOT production build ──────────────────────────────────
  heading('Building the consumer app (AOT, production)');
  console.log(run('npx', ['ng', 'build'], consumerDir));
  ok('ng build succeeded — the consumer compiler linked the partial-compiled component');

  // ── 6. And it actually renders ────────────────────────────────────────────
  heading('Rendering the built app headlessly');
  const outDir = join(consumerDir, 'dist', 'consumer', 'browser');
  const MIME = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.map': 'application/json',
  };
  server = createServer((request, response) => {
    const path = request.url === '/' ? '/index.html' : request.url.split('?')[0];
    const file = join(outDir, path);
    response.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
    createReadStream(file)
      .on('error', () => {
        response.statusCode = 404;
        response.end();
      })
      .pipe(response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    await page.goto(url);
    await page.waitForSelector('.rdfa-player', { timeout: 15_000 });

    check((await page.locator('.rdfa-player').count()) === 1, 'exactly one .rdfa-player is rendered');
    check((await page.locator('.rdfa-controls').count()) === 1, 'the control bar is there (the unbound `controls` default survived)');
    check((await page.locator('[aria-label="JSON specification"]').count()) === 1, '`exportable` reached the core as an option');
    check(await page.locator('.rdfa-player').evaluate((el) => el.dataset.theme === 'blueprint'), '`theme` reached the core as an option');
    // Without the core's stylesheet nothing has a size — which is exactly what the
    // README warns about, and what `angular.json`'s `styles` entry proves here.
    check(
      await page.locator('.rdfa-stage').evaluate((el) => el.getBoundingClientRect().height > 100),
      'the stage has a real size, so `@dataflow-animator/core/styles.css` resolved and applied'
    );
    check(consoleErrors.length === 0, `no runtime errors (${consoleErrors.join(' | ') || 'none'})`);
  } finally {
    await browser.close();
  }
} finally {
  server?.close();
  if (KEEP) console.log(`\nkept: ${workDir}`);
  else rmSync(workDir, { recursive: true, force: true });
}

console.log('');
if (failures.length > 0) {
  console.error(`${failures.length} check(s) FAILED:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log('External Angular consumer smoke test: all checks passed.');
