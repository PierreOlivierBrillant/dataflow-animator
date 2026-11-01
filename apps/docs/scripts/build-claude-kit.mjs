import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { docsRoot, loadKit } from './claude-kit-inputs.mjs';

// Writes what the site publishes for language models — llms.txt /
// llms-full.txt, the playground's "Ask Claude" prompt, the reference and the
// examples they link to — into static/, where Docusaurus serves it as-is.
// Everything written here is GENERATED (gitignored): the hand-written sources
// live in claude-kit/, the assembly logic in src/claude-kit/kit.ts (pure,
// unit-tested), and the examples are the gallery demos themselves. The skill
// itself is not among them: the plugin commits it (generate-claude-plugin.mjs).

const staticDir = join(docsRoot, 'static');
const { kit, inputs } = await loadKit();
const files = kit.buildKit(inputs);

// A demo removed from the gallery must not leave its example behind.
rmSync(join(staticDir, 'claude'), { recursive: true, force: true });
for (const file of files) {
  const dest = join(staticDir, file.path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, file.content);
}

console.log(`claude kit written: ${files.length} files in static/`);
