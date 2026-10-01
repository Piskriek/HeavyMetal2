import { newQuickJSWASMModule, type QuickJSWASMModule } from 'quickjs-emscripten';
import variant from '@jitl/quickjs-singlefile-browser-release-sync';

/** Browser: the WASM is embedded in the JS (no extra file to fetch), so the deployed game stays one static bundle. */
export const loadQuickJS = (): Promise<QuickJSWASMModule> => newQuickJSWASMModule(variant);
