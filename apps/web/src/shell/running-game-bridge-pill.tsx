// ============================================================================
// File: apps/web/src/shell/running-game-bridge-pill.tsx
// TICKET-27 (POL-13 — Running-Game Auto-Detector UI Pill):
// Polls `/__studio/bridge/running-games` (when opted in or in dev/local bridge mode)
// and displays the green `[BRIDGE: CONNECTED]` pill with one-click `.smx` cartridge
// equip for any running game engine (`UnrealEditor`, `Godot`, `Minecraft`, `Unity`, `Blender`).
// ============================================================================

import { useState, type ReactElement } from 'react';
import {
  detectRunningBridgeGames,
  type BridgeGameSignature,
} from '@hm/bridgekit/game-detector';

export function RunningGameBridgePill(props: {
  readonly initialProcesses?: readonly string[];
  readonly onEquipBridgeCartridge?: (cartridgeId: string) => void;
}): ReactElement {
  const [processes, setProcesses] = useState<readonly string[]>(props.initialProcesses ?? []);
  const [scanning, setScanning] = useState(false);
  const status = detectRunningBridgeGames(processes);

  const scanLocalBridge = async (): Promise<void> => {
    setScanning(true);
    try {
      const resp = await fetch('/__studio/bridge/running-games');
      if (resp.ok) {
        const data = (await resp.json()) as { readonly processes?: readonly string[] };
        if (Array.isArray(data.processes)) {
          setProcesses(data.processes);
        }
      }
    } catch {
      // Offline / standalone file:// mode: keep current process list
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className={`hud-bridge-pill${status.connected ? ' is-connected' : ''}`} role="status">
      <span className="hud-bridge-dot" />
      <span className="hud-bridge-label">
        {status.connected
          ? `BRIDGE: CONNECTED (${status.detectedGames.map((g: BridgeGameSignature) => g.displayName).join(', ')})`
          : 'BRIDGE: STANDBY'}
      </span>
      <button type="button" onClick={() => { void scanLocalBridge(); }} disabled={scanning}>
        {scanning ? 'Scanning…' : 'Scan Games'}
      </button>
      {status.detectedGames.map((g: BridgeGameSignature) => (
        <button
          key={g.id}
          type="button"
          className="hud-bridge-cart"
          onClick={() => props.onEquipBridgeCartridge?.(g.unlockedCartridgeId)}
        >
          Equip {g.unlockedCartridgeName}
        </button>
      ))}
    </div>
  );
}
