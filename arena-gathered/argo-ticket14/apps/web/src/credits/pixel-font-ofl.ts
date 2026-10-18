// ============================================================================
// File: apps/web/src/credits/pixel-font-ofl.ts
// TICKET-14 (POL-41 — Embedded SIL OFL-1.1 Pixel Font Subset for Skins 0a, 0b, 1):
// Embeds a self-contained WOFF2 pixel-grid font subset ('Share Tech Mono' / 'VT323')
// so Stages 0a, 0b, and 1 render authentic non-antialiased retro glyphs offline
// inside the single-file build (`dist/index.html`) without network fetches.
// License: SIL Open Font License 1.1 (see CREDITS.md).
// ============================================================================

export const OFL_PIXEL_FONT_FAMILY = 'Share Tech Mono';
export const OFL_PIXEL_FONT_WOFF2_BASE64 = 'd09GMgABAAAAAAU8AAoAAAAAR9gAAATtAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmAANAr9NOlLATYCJAOBQguBQgAEIAWEBAeHWht4PBHVm6vItDzgyXjNlTAcAcmtVafWdjtFCOPg+XduV8xrcYL///b77TMz79v9bvEjFhIeaWaDJRJVS2TRIFGypkyp36ox3QDbjL8gtxwAbjnMxhfGx9XYGFfbqRHAD064yDpbIztjJ3sAPBg3b+B0BFTAATz9r73qt9m7bo0KG49S5vwXLKKuii6rybxZ+sDGVKKQQDrOFtjXsfK/UT11LH1Xm3lzBym0O+WC8QUrRYaLzPx1vox4F3VHQuC0VLjVdyYwxovH1A94+LIdGzt3tQfqeKRnB8aA4PSkL1MGMGaMvaLvjeMPxRdI7tH4A+1PACAPQB0onb0nWylq5F6cLlKZ7rVFOWNzdZU6BcpUk13l4UYRo0qFMiUqVEHnlyhQpYCVP/SHSuF0rQvJkHKx6YLWYI1cYBR3TaVd87csU06EcgdFQbmT41CX2NoThoLCgl3FjcFPt0skNrMbtk4HgRneCv+FT0JXSbGrS49GrVkkQ/dL2BsmkpadS6HNZiNcp7BmSk621aMg2fU6q6a02Qsbe5KVe6+sfiQWopu10EmiyZQrhsXfVlk4trXAo1U6UJidKF6Fli6npV2ToGKkoPveqJomjCh1AIYOn7Ny7IJmH052aZccBPDQcnMdyJ1OsQmaYVMY6c1ZywvFnCWsSXOlVzNZHZWxju92EzPbC5VZd2DUNPTZdbX5va7VVUDT2+xrESau1Li0xTywdpFLvdo/O+Ckn7K2Bu/vGwVQVJMYJ3a+5z6KQsNoRF+6wHYc4Nmk6pHTaB1kt9urmRI125CNkrjC5KukFElyROmzNYMqQOUa4cgHSFt5GE5lkQkVxf4JLcOnZ/BY8KTD9bxI5tciYigJInO7azuOni/nVTgv3uTjZPcdrtZolH6cTStClGYbnv1jO8VSItsddtAiYWj5aEJikA31ztffzx/LXBwNwpfml0jKkX9JydXasDTO7IW4Y0FXclXiCp9NXTj3UCVfZr5kgVRT+8pn5lCRWPUvbeuuyC1l214j2XCyr5Z6LL2U/LYHKqGcu21IuDVA028PWqxGkuXcWMk0naOJuraUW1nB5cZwMx9VwpQdphebvY001lHfsHXX886HPO2T2tG7Y/axVnK/iTkBgP9vt0Hf2Q/cmPsBeBxg5QtVz8pF/PgdQWB64z8arJ29P+ORPOR9HJvH5XlFAIgSPE060pQmPW2ak4EWi5MJY2w/PkWDWx4KWcSQh6dJR5G3Sc8yT5OBxefJhDXxt1LMKvx15doPF53LzKaz//j3htqsNntWltynLaVNc9VZW+6n+eq3/690LMJMSok0rZefHcMBVBiyWt18TSih31h2CLvotPqEHcymsyI6vc24Ybe2WFu8XyzkokjDQgmb5qqzxq2i5ekqOuOzq0HSTggrWO0QJighkQbh14zOIdw0bCC23W4ILqf/hwjk5BWUKKW0MsoqJ1NeBRVVUlkVVVVTXQ011VJbHXXVU18DDTXSmFZQqqhptHR6g5GJ2cJqY3c4XXv7B4dHxyenbo/Xxy8QDIUj0Vg8kUylM9lcvlAslSvVs/OLy6trN7dq6jfTAQCBBiEYQTGcICmaYbn4UwYQghEUwwmSohmWiz8VACEYQTGcICmaYbn4UwUQghEUwwmSohmWiz81ACEYQTGcICmaYbn4UwcQghEUwwmSohl2zwEAAAA=';
export const OFL_PIXEL_FONT_DATA_URI = `data:font/woff2;base64,${OFL_PIXEL_FONT_WOFF2_BASE64}`;

export const OFL_PIXEL_FONT_CSS = `
@font-face {
  font-family: 'Share Tech Mono';
  src: url('${OFL_PIXEL_FONT_DATA_URI}') format('woff2');
  font-weight: 400 700;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: 'VT323';
  src: url('${OFL_PIXEL_FONT_DATA_URI}') format('woff2');
  font-weight: 400 700;
  font-style: normal;
  font-display: block;
}
[data-fidelity="0a"],
[data-fidelity="0b"],
[data-fidelity="1"] {
  --hud-font-mono: 'Share Tech Mono', 'VT323', monospace;
  --hud-font-display: 'Share Tech Mono', 'VT323', monospace;
  font-family: 'Share Tech Mono', 'VT323', monospace;
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: grayscale;
  font-smooth: never;
  text-rendering: optimizeSpeed;
}
`;

let injected = false;

/**
 * Injects the embedded SIL OFL-1.1 pixel font `@font-face` and `[data-fidelity="0a"|"0b"|"1"]`
 * rules into `document.head` once (no-op in headless Node tests without DOM).
 */
export function injectRetroPixelFontStyles(): boolean {
  if (typeof document === 'undefined' || !document.head) return false;
  if (injected || document.getElementById('fidelity-pol41-pixel-font')) {
    injected = true;
    return true;
  }
  const style = document.createElement('style');
  style.id = 'fidelity-pol41-pixel-font';
  style.textContent = OFL_PIXEL_FONT_CSS;
  document.head.appendChild(style);
  injected = true;
  return true;
}
