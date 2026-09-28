/**
 * PLATFORM: makes the game's root-relative file URLs (`/art/…`, `/textures/…`) load when the game is
 * served from a subdirectory, as RUN.world does.
 *
 * Those URLs are everywhere: in code, in generated part manifests, in the prop catalog and inside saved
 * tracks. Rewriting them at every call site would miss the data. Instead a relative-base build (the RUN
 * build, Vite `base: './'`) rewrites them where the browser loads them: image, media and source `src`,
 * `setAttribute('src' | 'href' | 'poster')`, `fetch`, `XMLHttpRequest.open`, `new Audio(url)`, and
 * `url(…)` in inline styles. Only paths under the game's own public folders are touched; everything else
 * passes through. A default-base build (dev server, plain deploy) installs nothing.
 */
import { asset } from './asset';

/** The top-level folders of `public/`: only these root paths are the game's own files. */
export const PUBLIC_ROOTS = ['art', 'avatar-parts', 'textures', 'ui', 'models', 'courses', 'presets', 'audio', 'sounds', 'fonts'] as const;
const ROOT_RE = new RegExp(`^/(?:${PUBLIC_ROOTS.join('|')})/`);
const FAVICON_RE = /^\/favicon[^/]*\.(?:png|ico|svg)$/;

const isRootAsset = (path: string) => ROOT_RE.test(path) || FAVICON_RE.test(path);

/**
 * The URL to load for `url`: a public root path (`/art/…`, or the same path as an absolute URL on this
 * page's own origin) through `asset()`; anything else unchanged.
 */
export function rebase(url: string | null | undefined, toAsset: (p: string) => string = asset, origin: string | null = pageOrigin()): string {
  if (typeof url !== 'string') return url ?? '';
  if (isRootAsset(url)) return toAsset(url);
  if (origin && url.startsWith(origin + '/')) {
    const rest = url.slice(origin.length);
    if (isRootAsset(rest.split(/[?#]/)[0]!)) {
      const r = toAsset(rest);
      return r.startsWith('/') || /^[a-z]+:/i.test(r) ? (r.startsWith('/') ? origin + r : r) : new URL(r, pageHref()!).href;
    }
  }
  return url;
}

function pageOrigin(): string | null {
  try { return typeof location !== 'undefined' ? location.origin : null; } catch { return null; }
}
function pageHref(): string | null {
  try { return typeof document !== 'undefined' ? document.baseURI : null; } catch { return null; }
}

/** `url(/art/x.png)` (quoted or not) inside a CSS value, rebased. */
export function rebaseCssUrls(value: string, toAsset: (p: string) => string = asset): string {
  if (typeof value !== 'string' || !value.includes('url(')) return value;
  return value.replace(/url\(\s*(['"]?)(\/[^'")]+)\1\s*\)/g, (m, q: string, p: string) => {
    const r = rebase(p, toAsset);
    return r === p ? m : `url(${q}${r}${q})`;
  });
}

let installed = false;

function patchSetter(proto: object | undefined, prop: string, map: (v: string) => string) {
  if (!proto) return;
  const desc = Object.getOwnPropertyDescriptor(proto, prop);
  if (!desc?.set || !desc.configurable) return;
  Object.defineProperty(proto, prop, { ...desc, set(this: unknown, v: unknown) { desc.set!.call(this, typeof v === 'string' ? map(v) : v); } });
}

/** Installs the rewrites (browser only, once). Returns true when anything was installed. */
export function installAssetBaseRewrite(): boolean {
  if (installed || typeof window === 'undefined' || asset('/art/x') === '/art/x') return false;
  installed = true;
  const w = window as Window & typeof globalThis;

  for (const [ctor, props] of [
    [w.HTMLImageElement, ['src']], [w.HTMLMediaElement, ['src']], [w.HTMLSourceElement, ['src']],
    [w.HTMLVideoElement, ['poster']], [w.HTMLLinkElement, ['href']], [w.SVGImageElement, []],
  ] as const) {
    for (const prop of props) patchSetter(ctor?.prototype, prop, rebase);
  }

  const setAttribute = w.Element.prototype.setAttribute;
  w.Element.prototype.setAttribute = function (name: string, value: string) {
    const n = name.toLowerCase();
    const v = n === 'src' || n === 'href' || n === 'poster' || n === 'xlink:href' ? rebase(String(value))
      : n === 'style' ? rebaseCssUrls(String(value)) : value;
    return setAttribute.call(this, name, v);
  };

  const fetch0 = w.fetch.bind(w);
  w.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') return fetch0(rebase(input), init);
    if (input instanceof URL) return fetch0(rebase(input.href), init);
    // three.js's FileLoader fetches a Request (already an absolute URL).
    if (input instanceof Request) {
      const r = rebase(input.url);
      return fetch0(r === input.url ? input : new Request(r, input), init);
    }
    return fetch0(input, init);
  }) as typeof fetch;

  const open0 = w.XMLHttpRequest.prototype.open;
  w.XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    return (open0 as (...a: unknown[]) => void).call(this, method, typeof url === 'string' ? rebase(url) : url, ...rest);
  } as typeof open0;

  const Audio0 = w.Audio;
  if (Audio0) {
    const Rebased = function (this: unknown, src?: string) { return new Audio0(src === undefined ? undefined : rebase(src)); } as unknown as typeof Audio;
    Rebased.prototype = Audio0.prototype;
    w.Audio = Rebased;
  }

  // Inline styles: React writes style.backgroundImage = 'url(/art/…)' and friends.
  // (Newer engines keep the per-property accessors on CSSStyleProperties.prototype.)
  const css = w.CSSStyleDeclaration?.prototype;
  const cssProps = (w as unknown as { CSSStyleProperties?: { prototype: object } }).CSSStyleProperties?.prototype;
  for (const prop of ['background', 'backgroundImage', 'borderImage', 'borderImageSource', 'maskImage', 'webkitMaskImage', 'listStyleImage', 'cursor', 'content']) {
    patchSetter(css, prop, rebaseCssUrls);
    patchSetter(cssProps, prop, rebaseCssUrls);
  }
  if (css) {
    const setProperty = css.setProperty;
    css.setProperty = function (this: CSSStyleDeclaration, name: string, value: string | null, priority?: string) {
      return setProperty.call(this, name, value == null ? value : rebaseCssUrls(String(value)), priority);
    };
    patchSetter(css, 'cssText', rebaseCssUrls);
  }
  return true;
}
