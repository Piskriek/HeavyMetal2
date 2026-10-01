import type { Platform } from '@hm/contracts';
import { createStubPlatform, createStubHub, type StubHub, type StubPlatformOptions } from './stub.js';
import { createRunPlatform } from './run.js';

export { createStubPlatform, createRunPlatform, createStubHub, type StubHub, type StubPlatformOptions };

export interface PlatformOptions {
  readonly user?: string;
  readonly sdk?: unknown;
  readonly hub?: StubHub;
  readonly now?: () => number;
}

// Main factory function creating either in-memory stub or real RUN platform
export function createPlatform(kind: 'stub' | 'run', opts?: PlatformOptions): Platform {
  if (kind === 'stub') {
    return createStubPlatform(opts);
  }
  if (kind === 'run') {
    return createRunPlatform(opts);
  }
  throw new Error(`Unknown platform kind: ${kind}`);
}

export default createPlatform;
