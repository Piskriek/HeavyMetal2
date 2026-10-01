import type { KernelExports } from '@hm/contracts';

/** Not built yet (tasks K-expr, K-variables, K-commands). */
const todo = (what: string): never => { throw new Error(`@hm/kernel: ${what} is not implemented yet`); };

export { createSchemaRegistry, asKernelRegistry } from './schema-registry';
export type { KernelSchemaRegistry, MigrateFn } from './schema-registry';
export { createEventBus } from './event-bus';
export { createPresetStore } from './store';
export type { PresetStoreOptions } from './store';
export { migrateBundle, hashBundle } from './bundle';
export { cyrb53, hashText, hashValue, hashPresetContent, stableStringify } from './hash';
export type { PresetContent } from './hash';

export const createVariableSystem: KernelExports['createVariableSystem'] = () => todo('createVariableSystem');
export const createCommandBus: KernelExports['createCommandBus'] = () => todo('createCommandBus');
