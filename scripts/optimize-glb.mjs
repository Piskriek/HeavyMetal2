/**
 * Shrinks a Meshy GLB for shipping: every embedded texture is re-encoded as a JPEG at most
 * MAX_TEXTURE px wide (quality 85), and the binary chunk is rebuilt around it. Geometry is untouched.
 *
 *   node scripts/optimize-glb.mjs <in.glb> <out.glb> [maxTexture=1024]
 *
 * Meshy's 2K texture is ~3 MB of a ~3.5 MB model; at 1024 px the whole model is ~0.6 MB, which keeps
 * the kit inside the shipped-art budget (tests/art-budget.test.ts). The re-encode uses Windows'
 * own imaging (WPF) through PowerShell, fed on stdin, so nothing is installed.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const [input, output, maxArg] = process.argv.slice(2);
if (!input || !output) { console.error('usage: optimize-glb.mjs <in.glb> <out.glb> [maxTexture]'); process.exit(2); }
const MAX = Number(maxArg ?? 1024);

const glb = readFileSync(input);
if (glb.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLen));

function resizeJpeg(bytes) {
  const dir = join(tmpdir(), `glb-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const src = join(dir, 'in.img'), dst = join(dir, 'out.jpg');
  writeFileSync(src, bytes);
  const ps = `
Add-Type -AssemblyName PresentationCore
$fs = [IO.File]::OpenRead('${src}')
$dec = [Windows.Media.Imaging.BitmapDecoder]::Create($fs, 'PreservePixelFormat', 'OnLoad')
$bmp = $dec.Frames[0]; $fs.Close()
$s = [Math]::Min(1.0, ${MAX} / [Math]::Max($bmp.PixelWidth, $bmp.PixelHeight))
$img = if ($s -lt 1) { New-Object Windows.Media.Imaging.TransformedBitmap($bmp, (New-Object Windows.Media.ScaleTransform($s, $s))) } else { $bmp }
$enc = New-Object Windows.Media.Imaging.JpegBitmapEncoder
$enc.QualityLevel = 85
$enc.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($img))
$out = [IO.File]::Create('${dst}'); $enc.Save($out); $out.Close()
`;
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', '-'], { input: ps, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`texture re-encode failed: ${r.stderr}`);
  const out = readFileSync(dst);
  rmSync(dir, { recursive: true, force: true });
  return out;
}

// Re-encode each image's bufferView, then lay every bufferView out again, 4-byte aligned.
const replaced = new Map();
for (const image of json.images ?? []) {
  if (image.bufferView == null) continue;
  const view = json.bufferViews[image.bufferView];
  const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  replaced.set(image.bufferView, resizeJpeg(bytes));
  image.mimeType = 'image/jpeg';
}
const parts = [];
let offset = 0;
json.bufferViews.forEach((view, i) => {
  const data = replaced.get(i) ?? bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  view.byteOffset = offset;
  view.byteLength = data.length;
  parts.push(data);
  const pad = (4 - (data.length % 4)) % 4;
  if (pad) parts.push(Buffer.alloc(pad));
  offset += data.length + pad;
});
json.buffers = [{ byteLength: offset }];
let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
if (jsonBuf.length % 4) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(4 - (jsonBuf.length % 4), 0x20)]);
const binBuf = Buffer.concat(parts);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binBuf.length, 8);
const chunk = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, Buffer.concat([header, chunk(jsonBuf.length, 0x4e4f534a), jsonBuf, chunk(binBuf.length, 0x004e4942), binBuf]));
console.log(`${input} ${(glb.length / 1e6).toFixed(2)} MB → ${output} ${((12 + 16 + jsonBuf.length + binBuf.length) / 1e6).toFixed(2)} MB`);
