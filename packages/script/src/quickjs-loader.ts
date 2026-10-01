import { getQuickJS, type QuickJSWASMModule } from 'quickjs-emscripten';

/** Node and tests: the default WASM build, loaded from disk. The browser build aliases this file to quickjs-loader-browser.ts. */
export const loadQuickJS = (): Promise<QuickJSWASMModule> => getQuickJS();
