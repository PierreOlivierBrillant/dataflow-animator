import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { loadKit, pluginSkillDir, repoRoot } from './claude-kit-inputs.mjs';

// Writes the plugin's copy of the skill folder. Unlike static/claude/, this copy
// is COMMITTED: a plugin marketplace is read from a git repository, so the
// files have to be in one. `check-claude-plugin-is-fresh.mjs` keeps it honest.

const { kit, inputs } = await loadKit();
const files = kit.buildSkill(inputs);

// A demo removed from the gallery must not leave its example behind.
rmSync(pluginSkillDir, { recursive: true, force: true });
for (const file of files) {
  const dest = join(pluginSkillDir, file.path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, file.content);
}

console.log(
  `claude plugin skill written: ${files.length} files in ${relative(repoRoot, pluginSkillDir)}/`
);
