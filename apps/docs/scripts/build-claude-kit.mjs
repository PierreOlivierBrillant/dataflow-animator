import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runnerImport } from 'vite';

// Writes what the site publishes for language models — the Claude skill zip,
// llms.txt / llms-full.txt, the playground's "Ask Claude" prompt — into
// static/, where Docusaurus serves it as-is. Everything written here is
// GENERATED (gitignored): the hand-written sources live in claude-kit/, the
// assembly logic in src/claude-kit/kit.ts (pure, unit-tested), and the examples
// are the gallery demos themselves.
//
// The demos and the kit are TypeScript with extension-less imports, which plain
// `node` cannot load; Vite's module runner (the root's devDependency) resolves
// them the way the site's bundler does.

const docsRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(docsRoot, '..', '..');
const staticDir = join(docsRoot, 'static');
const kitDir = join(docsRoot, 'claude-kit');

async function load(path) {
  const { module } = await runnerImport(path, {
    configFile: false,
    logLevel: 'silent',
    root: docsRoot,
  });
  return module;
}

const [{ buildKit }, { COMPONENT_PINS }, { default: siteConfig }] =
  await Promise.all([
    load(join(docsRoot, 'src', 'claude-kit', 'kit.ts')),
    // Build tooling reaching into the core's source, like copy-schema.mjs: the
    // terminal map is not (and should not be) part of the core's public barrel.
    load(join(repoRoot, 'packages', 'core', 'src', 'engine', 'pins.ts')),
    load(join(docsRoot, 'docusaurus.config.ts')),
  ]);

const siteUrl = `${siteConfig.url}${siteConfig.baseUrl}`;
const scriptsDir = join(kitDir, 'scripts');
const scripts = Object.fromEntries(
  readdirSync(scriptsDir).map((name) => [
    name,
    readFileSync(join(scriptsDir, name), 'utf8'),
  ])
);

const files = buildKit({
  schema: JSON.parse(
    readFileSync(
      join(repoRoot, 'packages', 'core', 'src', 'schema.generated.json'),
      'utf8'
    )
  ),
  componentPins: COMPONENT_PINS,
  skill: readFileSync(join(kitDir, 'SKILL.md'), 'utf8'),
  guide: readFileSync(join(kitDir, 'guide.md'), 'utf8'),
  scripts,
  siteUrl,
});

// A demo removed from the gallery must not leave its example behind.
rmSync(join(staticDir, 'claude'), { recursive: true, force: true });
for (const file of files) {
  const dest = join(staticDir, file.path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, file.content);
}

console.log(`claude kit written: ${files.length} files in static/`);
