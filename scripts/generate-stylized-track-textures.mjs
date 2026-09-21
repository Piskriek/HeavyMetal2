#!/usr/bin/env node
/**
 * Builds the deliberately low-detail, hand-painted material tiles used by the
 * Three.js course.  These are original vector paintings rather than photo/noise
 * textures: every tile has a small palette, large readable forms, and no baked
 * micro-detail that turns into visual static when the course moves quickly.
 *
 * Runtime tiles live in public/textures/ (512px PNG + WebP).  The matching
 * 1024px copies under public/art/tracks/ keep the legacy canvas/art preload path
 * visually consistent with the active 3D course.
 *
 * Usage: node scripts/generate-stylized-track-textures.mjs
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { brotliDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import chromiumBundle from '@sparticuz/chromium';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtimeOut = join(root, 'public/textures');
const artOut = join(root, 'public/art/tracks');
const work = join(tmpdir(), 'hm2-stylized-textures');

const svg = (body) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3" /></filter>
  </defs>
  ${body}
</svg>`;

// Texture paintings intentionally favour broad value groups over high-frequency
// detail.  Long paths extend past the tile edge so the horizontal repeat reads as
// one brush stroke, while contained accents never get visibly sliced at a seam.
const tiles = {
  dirt: svg(`
    <rect width="512" height="512" fill="#9b633c"/>
    <path d="M-32 78 C96 46 178 102 300 74 S454 45 548 84 L548 132 C427 99 342 135 226 119 S69 119 -32 143Z" fill="#b9814e" opacity=".74"/>
    <path d="M-30 184 C73 147 172 191 284 168 S427 151 544 198 L544 248 C405 209 325 233 210 218 S59 220 -30 246Z" fill="#805037" opacity=".48"/>
    <path d="M-36 305 C71 266 159 315 265 290 S434 276 548 322 L548 369 C423 335 334 356 224 344 S60 356 -36 379Z" fill="#bd8750" opacity=".6"/>
    <path d="M-35 419 C80 385 174 430 281 406 S439 397 547 438 L547 486 C428 453 341 473 231 459 S65 467 -35 493Z" fill="#7d4b35" opacity=".42"/>
    <path d="M-20 119 C90 96 144 130 231 112 S410 93 532 127" fill="none" stroke="#d4a66b" stroke-width="10" opacity=".2"/>
    <path d="M-24 358 C86 331 171 365 255 347 S412 335 535 367" fill="none" stroke="#e0b775" stroke-width="8" opacity=".16"/>
    <g fill="#604033" opacity=".72"><ellipse cx="88" cy="270" rx="17" ry="9" transform="rotate(-18 88 270)"/><ellipse cx="366" cy="109" rx="13" ry="8" transform="rotate(24 366 109)"/><ellipse cx="423" cy="386" rx="18" ry="10" transform="rotate(-12 423 386)"/><ellipse cx="190" cy="447" rx="10" ry="6" transform="rotate(20 190 447)"/></g>
    <g fill="#d7a96c" opacity=".55"><ellipse cx="105" cy="262" rx="9" ry="4"/><ellipse cx="383" cy="102" rx="7" ry="4"/><ellipse cx="440" cy="377" rx="9" ry="4"/></g>
  `),
  grass: svg(`
    <rect width="512" height="512" fill="#547a35"/>
    <path d="M-40 126 C74 78 133 143 232 112 S417 77 552 142 L552 211 C418 156 331 182 239 174 S70 194 -40 226Z" fill="#699448" opacity=".85"/>
    <path d="M-34 311 C72 260 169 326 264 292 S410 273 545 332 L545 398 C412 347 326 367 228 360 S75 372 -34 407Z" fill="#42672f" opacity=".72"/>
    <path d="M-22 55 C101 21 191 69 279 42 S442 25 534 72" fill="none" stroke="#8db557" stroke-width="20" opacity=".35"/>
    <path d="M-22 249 C81 214 155 256 246 234 S429 209 536 259" fill="none" stroke="#9abb5b" stroke-width="16" opacity=".29"/>
    <path d="M-18 468 C92 428 182 477 273 449 S424 436 535 474" fill="none" stroke="#84a94f" stroke-width="17" opacity=".33"/>
    <g fill="none" stroke-linecap="round">
      <path d="M78 181 Q91 144 111 129 M105 184 Q119 151 142 138 M331 226 Q340 184 364 160 M359 231 Q385 190 405 181 M175 411 Q195 368 216 356 M203 416 Q228 377 246 372" stroke="#b4cd69" stroke-width="7" opacity=".53"/>
      <path d="M68 189 Q65 154 47 139 M321 231 Q306 200 298 182 M164 417 Q148 383 131 373 M446 107 Q455 73 476 58" stroke="#315527" stroke-width="9" opacity=".6"/>
    </g>
    <g fill="#c5d979" opacity=".5"><ellipse cx="129" cy="271" rx="18" ry="8" transform="rotate(-23 129 271)"/><ellipse cx="405" cy="358" rx="23" ry="9" transform="rotate(18 405 358)"/><ellipse cx="264" cy="79" rx="17" ry="7" transform="rotate(-14 264 79)"/></g>
  `),
  cliff: svg(`
    <rect width="512" height="512" fill="#5c5a58"/>
    <path d="M-44 22 L163 -24 L290 88 L224 204 L-34 177Z" fill="#77736b"/>
    <path d="M164 -22 L524 8 L551 150 L354 190 L290 88Z" fill="#474a4b"/>
    <path d="M-48 180 L224 204 L326 321 L183 408 L-44 349Z" fill="#67645e"/>
    <path d="M224 204 L354 190 L549 289 L542 403 L326 321Z" fill="#3f4446"/>
    <path d="M-33 350 L183 408 L328 540 L-37 546Z" fill="#45494a"/>
    <path d="M183 408 L542 402 L549 542 L328 540Z" fill="#69655c"/>
    <path d="M-34 176 L224 204 L326 321 L542 403" fill="none" stroke="#292f33" stroke-width="15" opacity=".75"/>
    <path d="M-43 29 L163 -17 L290 88 L524 8" fill="none" stroke="#aaa08c" stroke-width="11" opacity=".42"/>
    <path d="M-41 351 L183 408 L328 540" fill="none" stroke="#a69d8c" stroke-width="9" opacity=".32"/>
    <path d="M6 146 L143 117 M358 150 L472 118 M65 316 L179 289 M371 353 L498 330" fill="none" stroke="#b1a790" stroke-width="8" opacity=".26"/>
  `),
  caverock: svg(`
    <rect width="512" height="512" fill="#34383d"/>
    <path d="M43 44 L159 18 L231 89 L209 189 L99 213 L26 139Z" fill="#53565a"/>
    <path d="M254 26 L404 38 L473 132 L418 224 L286 194 L234 101Z" fill="#464a50"/>
    <path d="M86 250 L201 210 L294 291 L265 414 L122 435 L49 352Z" fill="#4d5156"/>
    <path d="M336 250 L441 210 L501 305 L459 431 L338 452 L284 363Z" fill="#57585a"/>
    <path d="M213 88 L254 26 L286 194 L294 291 L201 210Z" fill="#292f35"/>
    <path d="M99 213 L209 189 L201 210 L86 250Z" fill="#6d6c67" opacity=".7"/>
    <path d="M418 224 L473 132 L501 305 L441 210Z" fill="#292e32"/>
    <path d="M122 435 L265 414 L338 452 L273 494 L158 489Z" fill="#2a3035"/>
    <g fill="none" stroke-linejoin="round"><path d="M43 44 L159 18 L231 89 L209 189 L99 213 L26 139Z M254 26 L404 38 L473 132 L418 224 L286 194 L234 101Z M86 250 L201 210 L294 291 L265 414 L122 435 L49 352Z M336 250 L441 210 L501 305 L459 431 L338 452 L284 363Z" stroke="#20262c" stroke-width="10" opacity=".8"/><path d="M52 55 L157 33 M264 42 L397 52 M101 265 L193 228 M348 266 L433 230" stroke="#85847d" stroke-width="7" opacity=".28"/></g>
  `),
  lava: svg(`
    <rect width="512" height="512" fill="#c94b1b"/>
    <path d="M-28 36 L154 -20 L245 80 L213 188 L34 206 L-38 136Z" fill="#29282c" stroke="#121417" stroke-width="15"/>
    <path d="M282 -15 L477 22 L550 136 L435 217 L288 168 L244 72Z" fill="#333238" stroke="#121417" stroke-width="15"/>
    <path d="M27 259 L194 217 L283 310 L245 455 L85 477 L-24 384Z" fill="#302f34" stroke="#121417" stroke-width="15"/>
    <path d="M332 253 L452 213 L544 312 L506 475 L347 458 L278 359Z" fill="#24252a" stroke="#121417" stroke-width="15"/>
    <path d="M-10 224 C86 207 164 205 227 216 M269 190 C310 210 353 225 434 222 M263 300 C301 283 324 272 345 260" fill="none" stroke="#ffb34a" stroke-width="12" opacity=".72"/>
    <path d="M-8 236 C90 216 165 217 224 226 M275 202 C325 222 369 235 438 231 M267 313 C302 295 322 286 341 274" fill="none" stroke="#ffd174" stroke-width="4" opacity=".8"/>
    <g fill="#f58a2d" opacity=".78"><ellipse cx="251" cy="223" rx="18" ry="11"/><ellipse cx="289" cy="188" rx="14" ry="8"/><ellipse cx="274" cy="297" rx="13" ry="8"/></g>
  `),
  wood: svg(`
    <rect width="512" height="512" fill="#805238"/>
    <path d="M0 0 H122 L114 512 H0Z" fill="#9a6843"/>
    <path d="M130 0 H258 L267 512 H124Z" fill="#71452f"/>
    <path d="M266 0 H395 L384 512 H259Z" fill="#a16c45"/>
    <path d="M402 0 H512 V512 H391Z" fill="#754a33"/>
    <path d="M122 0 L114 512 M263 0 L267 512 M398 0 L384 512" stroke="#3d2a23" stroke-width="13"/>
    <path d="M39 -10 C70 74 23 144 59 221 S36 378 70 522 M181 -10 C148 97 203 173 172 263 S201 424 168 522 M326 -8 C356 94 303 176 338 264 S309 415 342 520 M455 -8 C422 93 477 164 443 248 S473 423 440 520" fill="none" stroke="#c58b59" stroke-width="12" opacity=".43"/>
    <path d="M82 0 C44 90 98 173 71 260 S98 417 59 512 M222 0 C193 80 235 170 215 256 S243 397 210 512 M361 0 C332 88 378 160 354 251 S381 428 352 512 M488 0 C463 99 501 188 479 269 S498 418 475 512" fill="none" stroke="#4b3027" stroke-width="8" opacity=".42"/>
    <g fill="#332923"><circle cx="121" cy="111" r="12"/><circle cx="121" cy="396" r="12"/><circle cx="264" cy="214" r="12"/><circle cx="264" cy="453" r="12"/><circle cx="397" cy="100" r="12"/><circle cx="397" cy="363" r="12"/></g>
    <g fill="#d5a56c" opacity=".55"><circle cx="117" cy="107" r="3"/><circle cx="260" cy="210" r="3"/><circle cx="393" cy="96" r="3"/></g>
  `),
  cobble: svg(`
    <rect width="512" height="512" fill="#424b47"/>
    <g stroke="#293330" stroke-width="13" stroke-linejoin="round">
      <path d="M-25 24 L96 7 L151 74 L122 153 L-24 173Z" fill="#697267"/>
      <path d="M158 13 L296 23 L333 96 L275 170 L143 149 L120 79Z" fill="#7c806e"/>
      <path d="M342 19 L494 5 L538 86 L489 163 L348 151 L316 96Z" fill="#606a63"/>
      <path d="M-19 192 L119 171 L173 252 L121 337 L-29 322Z" fill="#737967"/>
      <path d="M173 185 L304 176 L357 252 L316 338 L166 326 L139 251Z" fill="#606963"/>
      <path d="M362 184 L495 172 L538 256 L486 337 L346 326 L323 254Z" fill="#7b806f"/>
      <path d="M-25 352 L119 347 L163 430 L111 523 L-23 533Z" fill="#606960"/>
      <path d="M172 351 L314 354 L351 430 L300 524 L155 526 L136 438Z" fill="#777c6d"/>
      <path d="M360 351 L503 348 L538 431 L487 527 L342 526 L324 434Z" fill="#656d64"/>
    </g>
    <g fill="none" stroke="#b4b393" stroke-width="8" opacity=".36"><path d="M-4 38 L86 25 M176 31 L280 39 M361 36 L476 23 M10 208 L108 193 M185 202 L288 193 M376 202 L482 190 M5 369 L108 364 M185 368 L297 371 M376 367 L490 364"/></g>
  `),
  iron: svg(`
    <rect width="512" height="512" fill="#45545b"/>
    <path d="M0 0 H250 V250 H0Z" fill="#657780"/><path d="M262 0 H512 V250 H262Z" fill="#52636c"/><path d="M0 262 H250 V512 H0Z" fill="#53646d"/><path d="M262 262 H512 V512 H262Z" fill="#687a80"/>
    <path d="M0 250 H512 M256 0 V512" stroke="#27373e" stroke-width="20"/>
    <path d="M12 18 H238 M274 18 H500 M12 280 H238 M274 280 H500" stroke="#a7b7ae" stroke-width="8" opacity=".35"/>
    <path d="M46 118 L212 92 M302 145 L466 119 M43 394 L211 367 M300 409 L468 382" stroke="#34464e" stroke-width="12" opacity=".5"/>
    <g fill="#26353a" stroke="#9aaba5" stroke-width="4"><circle cx="32" cy="32" r="13"/><circle cx="224" cy="32" r="13"/><circle cx="288" cy="32" r="13"/><circle cx="480" cy="32" r="13"/><circle cx="32" cy="224" r="13"/><circle cx="224" cy="224" r="13"/><circle cx="288" cy="224" r="13"/><circle cx="480" cy="224" r="13"/><circle cx="32" cy="288" r="13"/><circle cx="224" cy="288" r="13"/><circle cx="288" cy="288" r="13"/><circle cx="480" cy="288" r="13"/><circle cx="32" cy="480" r="13"/><circle cx="224" cy="480" r="13"/><circle cx="288" cy="480" r="13"/><circle cx="480" cy="480" r="13"/></g>
  `),
  bark: svg(`
    <rect width="512" height="512" fill="#5d3d2e"/>
    <path d="M-18 0 C17 94 -9 184 24 278 S-4 421 22 512 H108 C75 416 113 326 81 233 S111 88 85 0Z" fill="#8b5a39"/>
    <path d="M112 0 C83 85 128 183 103 276 S132 419 108 512 H213 C241 427 197 337 227 238 S202 86 230 0Z" fill="#70462f"/>
    <path d="M235 0 C270 92 235 174 266 269 S237 414 274 512 H370 C339 406 383 330 348 236 S380 80 349 0Z" fill="#96613c"/>
    <path d="M375 0 C343 90 392 176 365 274 S398 421 373 512 H535 C500 421 539 326 500 232 S531 87 503 0Z" fill="#70472f"/>
    <path d="M77 0 C49 104 89 169 61 264 S91 408 58 512 M184 0 C155 100 201 174 173 265 S202 424 171 512 M326 0 C357 97 316 178 347 269 S318 414 350 512 M468 0 C438 89 486 181 457 273 S489 419 458 512" fill="none" stroke="#392b28" stroke-width="18" opacity=".85"/>
    <path d="M34 0 C65 93 29 184 57 270 S30 423 59 512 M142 0 C112 97 153 179 128 264 S154 415 127 512 M281 0 C253 98 290 184 260 274 S288 412 261 512 M409 0 C382 95 420 181 394 274 S422 417 394 512" fill="none" stroke="#c1844d" stroke-width="11" opacity=".38"/>
  `),
  water: svg(`
    <rect width="512" height="512" fill="#34778b"/>
    <path d="M-42 83 C59 28 132 132 234 79 S407 34 553 105 L553 170 C423 111 338 149 233 145 S55 153 -42 210Z" fill="#4e9eb0" opacity=".78"/>
    <path d="M-35 255 C69 202 146 298 253 244 S416 212 549 278 L549 343 C421 286 333 318 238 314 S55 326 -35 381Z" fill="#2b657a" opacity=".7"/>
    <path d="M-37 411 C70 365 151 454 254 407 S414 377 548 432" fill="none" stroke="#68b8c3" stroke-width="34" opacity=".55"/>
    <path d="M-22 119 C81 75 143 158 238 113 S408 77 534 133 M-17 289 C70 245 151 326 253 280 S422 255 532 304 M-12 452 C81 409 153 482 258 443 S410 420 529 461" fill="none" stroke="#d1ece4" stroke-width="10" opacity=".78"/>
    <path d="M-18 134 C79 95 149 174 242 129 S408 94 530 147 M-15 304 C78 263 151 341 254 296 S419 270 530 319" fill="none" stroke="#f0f4df" stroke-width="4" opacity=".72"/>
    <g fill="#a9dadd" opacity=".5"><ellipse cx="132" cy="195" rx="37" ry="8"/><ellipse cx="385" cy="193" rx="31" ry="7"/><ellipse cx="104" cy="390" rx="30" ry="7"/><ellipse cx="406" cy="390" rx="39" ry="8"/></g>
  `),
};

function convert(args) {
  execFileSync('convert', args, { stdio: 'inherit' });
}

/**
 * The sandbox ImageMagick install deliberately has no SVG delegate.  Chromium is
 * already a project dependency for visual tests, and its SVG rasterizer gives us
 * crisp, deterministic PNGs without adding a second graphics dependency.
 */
async function launchRasterizer() {
  const libraries = join(work, 'chromium-libs');
  mkdirSync(libraries, { recursive: true });
  const archive = readFileSync(join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
  const extracted = spawnSync('tar', ['-xf', '-', '-C', libraries], { input: brotliDecompressSync(archive) });
  if (extracted.status !== 0) throw new Error('Could not unpack Chromium libraries for texture rasterization.');
  chromiumBundle.setGraphicsMode = false;
  return chromium.launch({
    args: [...chromiumBundle.args.filter((arg) => !['--single-process', '--in-process-gpu'].includes(arg)), '--disable-gpu'],
    executablePath: await chromiumBundle.executablePath(),
    headless: true,
    env: {
      ...process.env,
      LD_LIBRARY_PATH: `${libraries}/lib:${libraries}/al2023/lib:${process.env.LD_LIBRARY_PATH ?? ''}`,
      FONTCONFIG_PATH: join(tmpdir(), 'fonts'),
    },
  });
}

async function build() {
  mkdirSync(runtimeOut, { recursive: true });
  mkdirSync(artOut, { recursive: true });
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const browser = await launchRasterizer();
  const context = await browser.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  try {
    for (const [name, image] of Object.entries(tiles)) {
      const runtime = join(runtimeOut, `${name}.png`);
      const webp = join(runtimeOut, `${name}.webp`);
      const legacy = join(artOut, `tex-${name}.png`);
      await page.setContent(`<style>html,body{margin:0;padding:0;overflow:hidden}</style>${image}`);
      const encoded = await page.locator('svg').evaluate(async (element) => {
        const source = new XMLSerializer().serializeToString(element);
        const blob = new Blob([source], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        try {
          const image = new Image();
          await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 512;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Could not create a 2D canvas context.');
          context.drawImage(image, 0, 0, 512, 512);

          // Feather the six outer texels with their opposing edge. The paintings
          // already use strokes that run beyond the canvas; this final pass makes
          // the sampled pixels mathematically continuous under linear filtering.
          const pixels = context.getImageData(0, 0, 512, 512);
          const d = pixels.data;
          const mix = (a, b) => Math.round((d[a] + d[b]) * 0.5);
          for (let y = 0; y < 512; y++) for (let x = 0; x < 6; x++) {
            const left = (y * 512 + x) * 4;
            const right = (y * 512 + (511 - x)) * 4;
            for (let channel = 0; channel < 4; channel++) d[left + channel] = d[right + channel] = mix(left + channel, right + channel);
          }
          for (let y = 0; y < 6; y++) for (let x = 0; x < 512; x++) {
            const top = (y * 512 + x) * 4;
            const bottom = ((511 - y) * 512 + x) * 4;
            for (let channel = 0; channel < 4; channel++) d[top + channel] = d[bottom + channel] = mix(top + channel, bottom + channel);
          }
          context.putImageData(pixels, 0, 0);
          return { png: canvas.toDataURL('image/png'), webp: canvas.toDataURL('image/webp', 0.84) };
        } finally { URL.revokeObjectURL(url); }
      });
      writeFileSync(runtime, Buffer.from(encoded.png.replace(/^data:image\/png;base64,/, ''), 'base64'));
      writeFileSync(webp, Buffer.from(encoded.webp.replace(/^data:image\/webp;base64,/, ''), 'base64'));
      convert([runtime, '-resize', '1024x1024!', '-strip', legacy]);
      console.log(`painted ${name}`);
    }
  } finally {
    await browser.close();
    rmSync(work, { recursive: true, force: true });
  }
}

build().catch((error) => { console.error(error); process.exitCode = 1; });
