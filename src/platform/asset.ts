/**
 * PLATFORM: the URL of a file under `public/`. The game used to write them from the site root
 * (`/art/…`), which only works when the game is the whole site. RUN.world serves each game from a
 * subdirectory (the RUN build uses Vite's `base: './'`), so every public file goes through here: with
 * the default base it returns the path unchanged; with a relative base it becomes relative to the page.
 *
 * Safe outside Vite (node tests): no `import.meta.env`, no rewrite.
 */
const BASE: string = (() => {
  try {
    return (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  } catch {
    return '/';
  }
})();

export function asset(path: string): string {
  if (BASE === '/' || !path.startsWith('/') || path.startsWith('//')) return path;
  return BASE + path.slice(1);
}
