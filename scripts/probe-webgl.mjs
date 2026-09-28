#!/usr/bin/env node
/**
 * scripts/probe-webgl.mjs
 *
 * Environment diagnostic for the browser suites: does the bundled headless Chromium
 * (`@sparticuz/chromium`) expose a WebGL context here?
 *
 * The race screen needs one (`new THREE.WebGLRenderer` in `src/game/renderer-3d.ts`), so
 * when this probe reports "no" the race-entering suites (`browser-recovery`, `art-check`,
 * `ticket02-visual`, `ticket07-visual`) time out for an environment reason rather than a
 * code regression. Recorded in docs/BASELINE_VERIFICATION.md §5.1.
 *
 * Usage: node scripts/probe-webgl.mjs        (exit 0 if any configuration has WebGL)
 */

import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';

const root = fileURLToPath(new URL('../', import.meta.url));

const libs = await mkdtemp(join(tmpdir(), 'probe-libs-'));
const swiftshader = await mkdtemp(join(tmpdir(), 'probe-sws-'));
for (const [archive, destination] of [['al2023.tar.br', libs], ['swiftshader.tar.br', swiftshader]]) {
  const tar = join(tmpdir(), `probe-${archive}.tar`);
  await writeFile(tar, brotliDecompressSync(await readFile(join(root, 'node_modules/@sparticuz/chromium/bin', archive))));
  if (spawnSync('tar', ['-xf', tar, '-C', destination]).status !== 0) {
    throw new Error(`Could not extract ${archive}.`);
  }
}

chromium.setGraphicsMode = false;
const repoArgs = chromium.args.filter((arg) => !['--single-process', '--in-process-gpu', "--headless='shell'"].includes(arg));
const envFor = (swiftshaderLibs) => ({
  ...process.env,
  LD_LIBRARY_PATH: [swiftshaderLibs ? swiftshader : null, `${libs}/lib`, `${libs}/al2023/lib`, process.env.LD_LIBRARY_PATH ?? '']
    .filter(Boolean)
    .join(':'),
  FONTCONFIG_PATH: join(tmpdir(), 'fonts'),
});

const configurations = [
  { name: 'repo args + --disable-gpu (the suites\u2019 configuration)', args: [...repoArgs, '--disable-gpu'], swiftshaderLibs: false },
  { name: 'repo args + --disable-gpu + swiftshader libs', args: [...repoArgs, '--disable-gpu'], swiftshaderLibs: true },
  { name: 'repo args + swiftshader libs, no --disable-gpu', args: [...repoArgs], swiftshaderLibs: true },
  { name: 'repo args + --use-gl=angle --use-angle=swiftshader', args: [...repoArgs, '--use-gl=angle', '--use-angle=swiftshader'], swiftshaderLibs: true },
  { name: 'repo args + --use-gl=swiftshader --enable-unsafe-swiftshader', args: [...repoArgs, '--use-gl=swiftshader', '--enable-unsafe-swiftshader'], swiftshaderLibs: true },
  { name: 'repo args + --use-angle=vulkan --use-vulkan=swiftshader', args: [...repoArgs, '--use-angle=vulkan', '--use-vulkan=swiftshader', '--enable-features=Vulkan'], swiftshaderLibs: true },
  { name: 'repo args + --headless=new', args: [...repoArgs, '--headless=new'], swiftshaderLibs: true },
];

let anyContext = false;
for (const configuration of configurations) {
  let browser;
  try {
    browser = await playwright.launch({
      args: configuration.args,
      executablePath: await chromium.executablePath(),
      headless: true,
      env: envFor(configuration.swiftshaderLibs),
    });
    const page = await browser.newPage();
    const probe = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { ok: false };
      return { ok: true, version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER) };
    });
    anyContext ||= probe.ok;
    console.log(`${probe.ok ? 'WEBGL  ' : 'no gl  '} ${configuration.name}${probe.ok ? ` → ${probe.version} / ${probe.renderer}` : ''}`);
  } catch (error) {
    console.log(`FAILED  ${configuration.name} → ${String(error.message).split('\n')[0]}`);
  } finally {
    await browser?.close();
  }
}

console.log(
  anyContext
    ? 'At least one configuration exposes WebGL: the race-side browser suites can run here.'
    : 'No configuration exposes WebGL: the race-side browser suites cannot run in this environment.',
);
process.exit(anyContext ? 0 : 1);
