import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  StudioByoaController,
  buildSingleModelT29RegenerateJob,
  validateConstitutionalAgentAction,
  type StudioSceneState,
} from '../src/byoa-studio-protocol.ts';

function createSampleScene(): StudioSceneState {
  return {
    revision: 1,
    availableSockets: ['corner_nw', 'scout_roof_mount'],
    nodes: [
      {
        nodeId: 'node-fab-1',
        label: 'Square Fabricator Station',
        assetId: 'fabricator',
        position: [0, 0, 0],
        rotationEulerRad: [0, 0, 0],
        scale: [1, 1, 1],
        aabbMinY: 0,
        socketId: null,
        colorHex: '#7cff4d',
        triangleCount: 1840,
      },
    ],
  };
}

describe('TICKET-30: Studio BYOA Protocol & Single-Model T29 Asset Bench Bridge', () => {
  it('exposes the 6 MCP tools via tools/list', () => {
    const controller = new StudioByoaController(createSampleScene());
    const res = controller.handleJsonRpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    });
    const tools = (res.result as { tools: unknown[] }).tools;
    assert.equal(tools.length, 6);
  });

  it('rejects constitutional violations (goblin/cloth/floating unsocketed mutations)', () => {
    const goblinCheck = validateConstitutionalAgentAction('Goblin Racer Banner', 0, null);
    assert.equal(goblinCheck.valid, false);
    assert.ok(goblinCheck.violation?.includes('goblin'));

    const floatCheck = validateConstitutionalAgentAction('Capacitor Housing', 0.45, null);
    assert.equal(floatCheck.valid, false);
    assert.ok(floatCheck.violation?.includes('Grounding violation'));

    const socketedCheck = validateConstitutionalAgentAction('Turret Unit', 2.4, 'corner_nw');
    assert.equal(socketedCheck.valid, true);
  });

  it('builds and executes a single-model T29 part-split regenerate job and records an undo transaction', () => {
    const controller = new StudioByoaController(createSampleScene());
    // Register a simple 2-triangle quad buffer for 'fabricator':
    const positions = new Float32Array([
      -1, 0, -1,
       1, 0, -1,
       1, 0,  1,
      -1, 0,  1,
    ]);
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
    controller.registerAssetMeshBuffer('fabricator', positions, indices);

    const job = buildSingleModelT29RegenerateJob('fabricator.glb', {
      targetTriangles: 650,
      positions,
      indices,
    });
    assert.equal(job.assetId, 'fabricator');
    assert.ok(job.cliCommand.includes('scripts/blender-part-split-retopo.py'));
    assert.ok(job.cliCommand.includes('--target-tris 650'));

    const callRes = controller.handleJsonRpc(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'studio.mesh.retopo_single_asset',
          arguments: { assetId: 'fabricator', targetTriangles: 650 },
        },
      },
      'claude-opus-agent',
    );
    assert.equal(callRes.error, undefined);
    assert.equal(controller.getSceneState().revision, 2);
    assert.equal(controller.getUndoStack().length, 1);

    // Undo restores revision 1 and original triangle count:
    const undoRes = controller.handleJsonRpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'studio/undo',
    });
    assert.equal(undoRes.error, undefined);
    assert.equal(controller.getSceneState().revision, 1);
    assert.equal(controller.getSceneState().nodes[0]?.triangleCount, 1840);
  });
});
