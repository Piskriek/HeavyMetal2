import type { KernelExports } from '@hm/contracts';

const todo = (what: string): never => { throw new Error(`@hm/kernel: ${what} is not implemented yet (task T1)`); };

export const createSchemaRegistry: KernelExports['createSchemaRegistry'] = () => todo('createSchemaRegistry');
export const createPresetStore: KernelExports['createPresetStore'] = () => todo('createPresetStore');
export const createEventBus: KernelExports['createEventBus'] = () => todo('createEventBus');
export const createVariableSystem: KernelExports['createVariableSystem'] = () => todo('createVariableSystem');
export const createCommandBus: KernelExports['createCommandBus'] = () => todo('createCommandBus');
export const migrateBundle: KernelExports['migrateBundle'] = () => todo('migrateBundle');
export const hashBundle: KernelExports['hashBundle'] = () => todo('hashBundle');
