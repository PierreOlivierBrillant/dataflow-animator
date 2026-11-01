import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { loadKit, pluginSkillDir, repoRoot } from './claude-kit-inputs.mjs';

const { kit, inputs } = await loadKit();
const expected = new Map(
  kit.buildSkill(inputs).map((f) => [f.path, Buffer.from(f.content)])
);

const committed = existsSync(pluginSkillDir)
  ? readdirSync(pluginSkillDir, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => relative(pluginSkillDir, join(d.parentPath, d.name)))
  : [];

// Both directions: a stale file, a missing one, and an orphan left behind by a
// demo that left the gallery.
const problems = [
  ...[...expected].flatMap(([path, content]) => {
    const file = join(pluginSkillDir, path);
    if (!existsSync(file)) return [`missing: ${path}`];
    return readFileSync(file).equals(content) ? [] : [`stale: ${path}`];
  }),
  ...committed.filter((p) => !expected.has(p)).map((p) => `orphan: ${p}`),
];

if (problems.length > 0) {
  console.error(
    `ERROR: ${relative(repoRoot, pluginSkillDir)}/ is out of date:\n` +
      problems.map((p) => `  - ${p}`).join('\n') +
      '\nRun `npm run generate:claude-plugin` to regenerate.'
  );
  process.exit(1);
}

console.log('claude plugin skill is up to date');
