// Writes a Code Arena battle's two answers into arena-gathered/<package>/{A,B}/ from what the browser page returned.
//   node scripts/arena-collect.mjs <package> <file>
// <file> is the saved result of the page script in arena-gathered/README.md ("Collecting"): either that JSON itself
// ({ answers: [{ opt, files: [{ name, text }] }] }) or the browser tool's wrapper around it ([{ type: 'text', text: '<json>' }]).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [pkg, file] = process.argv.slice(2);
if (!pkg || !file) { console.error('usage: node scripts/arena-collect.mjs <package> <file>'); process.exit(2); }
let data = JSON.parse(fs.readFileSync(file, 'utf8'));
if (Array.isArray(data) && data[0] && typeof data[0].text === 'string') data = JSON.parse(data[0].text);
if (typeof data === 'string') data = JSON.parse(data);
const root = fileURLToPath(new URL(`../arena-gathered/${pkg}/`, import.meta.url));
for (const answer of data.answers) {
  for (const f of answer.files) {
    const safe = f.name.replace(/\\/g, '/').replace(/^\/+/, '');
    if (safe.includes('..')) throw new Error(`refusing path ${f.name}`);
    const out = path.join(root, answer.opt, safe);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, f.text.endsWith('\n') ? f.text : `${f.text}\n`);
    console.log(`${answer.opt}/${safe}  ${f.text.length} chars`);
  }
}
