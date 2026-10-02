import type { QuickJSWASMModule } from 'quickjs-emscripten';
import { loadQuickJS } from './quickjs-loader.js';

/**
 * Node and tests: the WASM module is loaded once when this module is imported (top-level await), so everything after it can be synchronous.
 * The browser build aliases this file to qjs-browser.ts, which must NOT use top-level await (see there).
 */
const loaded: QuickJSWASMModule = await loadQuickJS();
export const quickjs = (): QuickJSWASMModule => loaded;
export async function initQuickJS(): Promise<void> { /* already loaded */ }
