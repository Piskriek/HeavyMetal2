import { newQuickJSWASMModule, type QuickJSSyncVariant, type QuickJSWASMModule } from 'quickjs-emscripten';
import baseVariant from '@jitl/quickjs-singlefile-browser-release-sync';
import { QuickJSFFI } from '@jitl/quickjs-singlefile-browser-release-sync/ffi';
import loadEmscriptenModule from '@jitl/quickjs-singlefile-browser-release-sync/emscripten-module';

/**
 * Browser: the WASM is embedded in the JS (no extra file to fetch), so the deployed game stays one static bundle.
 * The variant normally imports its ffi and module loader with dynamic import(). In the single-file build those become references to constants
 * defined LATER in the same script, and this package awaits the module at top level, so the build crashed on start with
 * "Cannot access 'ffi' before initialization". Importing them statically puts them first in the bundle; the variant is then rebuilt to use them.
 */
const variant: QuickJSSyncVariant = {
  ...baseVariant,
  importFFI: () => Promise.resolve(QuickJSFFI),
  importModuleLoader: () => Promise.resolve(loadEmscriptenModule),
} as QuickJSSyncVariant;

export const loadQuickJS = (): Promise<QuickJSWASMModule> => newQuickJSWASMModule(variant);
