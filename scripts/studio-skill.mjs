/**
 * Writes `apps/web/public/studio-skill.md` from the Studio's own command registry (plan 40 §1: one skill file, generated, so it cannot
 * drift from the tools it describes). The file is what an agent fetches from the Studio; `apps/web/src/studio/studio-skill.test.ts`
 * compares the committed copy to the generator, so editing a command without re-running this script is a test failure.
 *
 *   node --import tsx scripts/studio-skill.mjs           (write the file)
 *   node --import tsx scripts/studio-skill.mjs --check   (exit 1 when the file is stale; prints the reason)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { studioSkillMarkdown } from '../apps/web/src/studio/studio-skill.ts';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const target = path.join(root, 'apps/web/public/studio-skill.md');
const markdown = studioSkillMarkdown();
const check = process.argv.includes('--check');

if (check) {
  if (!existsSync(target)) {
    console.error(`studio-skill: ${target} is missing (run node --import tsx scripts/studio-skill.mjs)`);
    process.exit(1);
  }
  const onDisk = readFileSync(target, 'utf8');
  if (onDisk !== markdown) {
    console.error('studio-skill: apps/web/public/studio-skill.md is stale (run node --import tsx scripts/studio-skill.mjs)');
    process.exit(1);
  }
  console.log(`studio-skill: up to date (${markdown.length} bytes, ${markdown.split('\n').length} lines)`);
} else {
  writeFileSync(target, markdown);
  console.log(`studio-skill: wrote ${path.relative(root, target)} (${markdown.length} bytes)`);
}
