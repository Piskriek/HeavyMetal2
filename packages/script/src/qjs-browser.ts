import type { QuickJSWASMModule } from 'quickjs-emscripten';
import { loadQuickJS } from './quickjs-loader.js';

/**
 * Browser: load the WASM explicitly, once, before the runtime is created (`await initQuickJS()` in the app start).
 * A top-level await here crashed the single-file production build on start ("Cannot access 'x' before initialization"): the bundler puts the
 * libraries' lazily imported modules LATER in the one script, and the await suspends the whole bundle before they are defined.
 */
let loaded: QuickJSWASMModule | null = null;
export const quickjs = (): QuickJSWASMModule => {
  if (!loaded) throw new Error('QuickJS is not loaded: await initQuickJS() before creating the runtime');
  return loaded;
};
export async function initQuickJS(): Promise<void> { if (!loaded) loaded = await loadQuickJS(); }
