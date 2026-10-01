import type { SimExports } from '@hm/contracts';

const todo = (what: string): never => { throw new Error(`@hm/sim: ${what} is not implemented yet (task T3)`); };

export const createRng: SimExports['createRng'] = () => todo('createRng');
export const createWorld: SimExports['createWorld'] = () => todo('createWorld');
export const createSimulation: SimExports['createSimulation'] = () => todo('createSimulation');
export const runReplay: SimExports['runReplay'] = () => todo('runReplay');
export const createRecorder: SimExports['createRecorder'] = () => todo('createRecorder');
