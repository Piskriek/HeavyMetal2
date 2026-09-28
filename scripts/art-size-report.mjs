#!/usr/bin/env node
/**
 * M2 — how much art the game ships, and how much of it the game actually references.
 *
 * Walks `public/art`, totals the bytes, and splits them into files whose path, file name or stem
 * appears somewhere in `src/`, `public/**.json|css|js|html` or `index.html` (referenced) and files
 * that appear nowhere (likely pipeline inputs or leftovers that could move to `art-src/`). The
 * match is by name, so a file loaded by a path built at runtime can show as unreferenced: treat the
 * list as candidates to check, not as files to delete.
 *
 * Usage: node scripts/art-size-report.mjs [--json]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out); else out.push(path);
  }
  return out;
};

export function artReport() {
  const art = walk(join(root, 'public', 'art'));
  const sources = [
    ...walk(join(root, 'src')),
    ...walk(join(root, 'public')).filter((path) => /\.(json|css|html|js)$/.test(path)),
    join(root, 'index.html'),
  ].filter((path) => /\.(ts|tsx|css|json|html|js|mjs)$/.test(path));
  const text = sources.map((path) => readFileSync(path, 'utf8')).join('\n');
  const files = art.map((path) => {
    const rel = relative(join(root, 'public'), path).split(sep).join('/');
    const base = rel.split('/').pop();
    const referenced = text.includes(rel) || text.includes(base) || text.includes(base.replace(/\.[^.]+$/, ''));
    return { path: rel, bytes: statSync(path).size, referenced };
  }).sort((a, b) => b.bytes - a.bytes);
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  const unreferenced = files.filter((file) => !file.referenced);
  return {
    files: files.length,
    totalBytes: total,
    referencedBytes: total - unreferenced.reduce((sum, file) => sum + file.bytes, 0),
    unreferencedBytes: unreferenced.reduce((sum, file) => sum + file.bytes, 0),
    largest: files.slice(0, 15),
    unreferenced,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = artReport();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;
    console.log(`public/art: ${report.files} files, ${mb(report.totalBytes)} (referenced ${mb(report.referencedBytes)}, unreferenced ${mb(report.unreferencedBytes)})`);
    console.log('\nLargest:');
    for (const file of report.largest) console.log(`  ${mb(file.bytes).padStart(9)}  ${file.path}${file.referenced ? '' : '  (unreferenced)'}`);
    console.log(`\nUnreferenced (${report.unreferenced.length}), candidates for art-src/:`);
    for (const file of report.unreferenced) console.log(`  ${mb(file.bytes).padStart(9)}  ${file.path}`);
  }
}
