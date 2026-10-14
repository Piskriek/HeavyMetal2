// Checks that the Git LFS files (music, voice, the HD pack, the monster pack, the generated models) are real files and
// not LFS pointers. A machine that cloned without Git LFS gets small text pointers instead, and the game then plays
// silent, with low-detail models, and no error on screen. PLAY.bat runs this before building.
//   node scripts/check-lfs.mjs     exit 0 when the files are real, 1 (with the fix) when they are pointers
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
/** One file from each LFS-tracked folder in .gitattributes. */
const SAMPLES = ['apps/web/public/audio', 'apps/web/public/vo', 'apps/web/public/hd/astro', 'apps/web/src/assets/gen', 'apps/web/public/monsters'];

const pointers = [];
for (const dir of SAMPLES) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  const stack = [abs];
  let file = null;
  while (stack.length && !file) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (/\.(mp3|glb|bin|webp)$/.test(e.name)) { file = p; break; }
    }
  }
  if (!file) continue;
  const head = Buffer.alloc(40);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, head, 0, 40, 0);
  fs.closeSync(fd);
  if (head.toString('latin1').startsWith('version https://git-lfs')) pointers.push(path.relative(root, file));
}

if (pointers.length) {
  console.error(`These are Git LFS pointers, not the real files:\n  ${pointers.join('\n  ')}`);
  console.error('Without them the game plays silent and low-detail. Fix it once, in this folder:\n  git lfs install\n  git lfs pull');
  process.exit(1);
}
console.log('Git LFS files: present.');
