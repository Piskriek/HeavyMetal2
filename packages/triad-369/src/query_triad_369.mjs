#!/usr/bin/env node
// Backwards-compatible entry point for `npm run triad:query -- "question"`.
import { runCli } from './cli.mjs';

const args = process.argv.slice(2);
process.exitCode = await runCli(['ask', ...(args.length ? args : ['Status of the Triad and density resonance?'])]);
