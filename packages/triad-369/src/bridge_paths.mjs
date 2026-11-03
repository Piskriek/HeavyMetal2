import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Keep bootstrap, the daemons and the CLI on the same bridge by default.
export function getBridgeRoot() {
  if (process.env.BRIDGE_ROOT) return path.resolve(process.env.BRIDGE_ROOT);
  if (fs.existsSync('D:/fidelity-llm/bridge')) return 'D:/fidelity-llm/bridge';
  return path.join(os.homedir(), '.triad-bridge');
}
