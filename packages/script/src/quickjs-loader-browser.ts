import { newQuickJSWASMModuleFromVariant, type QuickJSSyncVariant, type QuickJSWASMModule } from 'quickjs-emscripten';
import { QuickJSFFI } from '@jitl/quickjs-singlefile-browser-release-sync/ffi';
import loadEmscriptenModule from '@jitl/quickjs-singlefile-browser-release-sync/emscripten-module';

/**
 * Browser: the WASM is embedded in the JS (no extra file to fetch), so the deployed game stays one static bundle.
 * The variant normally imports its ffi and module loader with dynamic import(). In the single-file build those become references to constants
 * defined LATER in the same script, and this package awaits the module at top level, so the build crashed on start with
 * "Cannot access 'ffi' before initialization". Importing them statically puts them first in the bundle; the variant is built from them.
 * Only these two pieces are imported (2026-10-13, the 16 MB cap): the variant's own entry dynamically imports a second, larger copy of the
 * module (828 KB), and quickjs-emscripten's newQuickJSWASMModule defaults to its wasmfile variant (0.7 MB more); either reference put an
 * unused copy into the single file.
 */
const variant = {
  type: 'sync',
  importFFI: () => Promise.resolve(QuickJSFFI),
  importModuleLoader: () => Promise.resolve(loadEmscriptenModule),
} as QuickJSSyncVariant;

export const loadQuickJS = (): Promise<QuickJSWASMModule> => newQuickJSWASMModuleFromVariant(variant);
