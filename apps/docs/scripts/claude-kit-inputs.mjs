import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runnerImport } from 'vite';

// What the Claude kit is assembled from, read once for the three scripts that
// consume it: build-claude-kit.mjs (the site's static/ files), and the
// generate/check pair for the committed plugin copy.
//
// The demos and the kit are TypeScript with extension-less imports, which plain
// `node` cannot load; Vite's module runner (the root's devDependency) resolves
// them the way the site's bundler does.

export const docsRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = join(docsRoot, '..', '..');
const kitDir = join(docsRoot, 'claude-kit');

/** Where the plugin commits its copy of the skill folder. */
export const pluginSkillDir = join(
  repoRoot,
  'plugins',
  'dataflow-animator',
  'skills',
  'dataflow-animator'
);

async function load(path) {
  const { module } = await runnerImport(path, {
    configFile: false,
    logLevel: 'silent',
    root: docsRoot,
  });
  return module;
}

/** The kit module (`buildKit`, `buildSkill`) and the inputs both take. */
export async function loadKit() {
  const [kit, { COMPONENT_PINS }, { default: siteConfig }] = await Promise.all([
    load(join(docsRoot, 'src', 'claude-kit', 'kit.ts')),
    // Build tooling reaching into the core's source, like copy-schema.mjs: the
    // terminal map is not (and should not be) part of the core's public barrel.
    load(join(repoRoot, 'packages', 'core', 'src', 'engine', 'pins.ts')),
    load(join(docsRoot, 'docusaurus.config.ts')),
  ]);

  const scriptsDir = join(kitDir, 'scripts');
  const inputs = {
    schema: JSON.parse(
      readFileSync(
        join(repoRoot, 'packages', 'core', 'src', 'schema.generated.json'),
        'utf8'
      )
    ),
    componentPins: COMPONENT_PINS,
    skill: readFileSync(join(kitDir, 'SKILL.md'), 'utf8'),
    guide: readFileSync(join(kitDir, 'guide.md'), 'utf8'),
    scripts: Object.fromEntries(
      readdirSync(scriptsDir).map((name) => [
        name,
        readFileSync(join(scriptsDir, name), 'utf8'),
      ])
    ),
    siteUrl: `${siteConfig.url}${siteConfig.baseUrl}`,
  };
  return { kit, inputs };
}
