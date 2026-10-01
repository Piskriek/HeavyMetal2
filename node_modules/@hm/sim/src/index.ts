import type { SimExports } from '@hm/contracts';
import { createRecorder, createSimulation, runReplay } from './simulation';
import { createRng } from './rng';
import { createWorld } from './world';

export { createRng, createWorld, createSimulation, runReplay, createRecorder };
export { createEntityVariableProvider } from './entity-vars';

/** Compile-time proof that the exports match the contract. */
export const _contractCheck: SimExports = { createRng, createWorld, createSimulation, runReplay, createRecorder };
