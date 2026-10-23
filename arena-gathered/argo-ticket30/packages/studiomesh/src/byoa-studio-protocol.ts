/**
 * TICKET-30 — Studio Section 9: Bring Your Own Agent (BYOA) Protocol &
 * Asset Bench Single-Model T29 Regenerate Bridge.
 *
 * Pure deterministic TypeScript module (strict types, noUncheckedIndexedAccess,
 * zero DOM, Date, or Math.random).
 *
 * Research-First Sources (CLAUDE.md §3.4):
 * - Model Context Protocol (MCP) 2026-07-28 Specification (JSON-RPC 2.0 tools/list & tools/call):
 *   https://modelcontextprotocol.io/specification/2026-07-28
 * - Blender Lab Official MCP Server (Scene inspection + transactional command execution):
 *   https://www.blender.org/lab/mcp-server/
 * - mcp-for-blender (ahujasid/mcp-for-blender — 3D scene manipulation & vision feedback loop):
 *   https://github.com/ahujasid/mcp-for-blender
 */

import {
  auditSingleMeshMultiPartAsset,
  retopologizeFusedMultiPartMesh,
  type FusedMeshWebbingAudit,
  type PartSplitRetopoResult,
} from './part-split-retopo.ts';

export type StudioAgentTransportKind = 'mcp-stdio-ws' | 'http-jsonrpc' | 'postmessage-iframe';

export type StudioToolName =
  | 'studio.scene.inspect'
  | 'studio.mesh.audit_webbing'
  | 'studio.mesh.retopo_single_asset'
  | 'studio.node.transform_and_snap'
  | 'studio.material.set_palette'
  | 'studio.viewport.capture_turntable';

export interface McpToolDefinition {
  readonly name: StudioToolName;
  readonly description: string;
  readonly mutatesScene: boolean;
  readonly inputSchema: {
    readonly type: 'object';
    readonly required: readonly string[];
    readonly properties: Readonly<Record<string, { readonly type: string; readonly description: string }>>;
  };
}

export interface StudioSceneNodeSnapshot {
  readonly nodeId: string;
  readonly label: string;
  readonly assetId: string;
  readonly position: readonly [number, number, number];
  readonly rotationEulerRad: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly aabbMinY: number;
  readonly socketId: string | null;
  readonly colorHex: string;
  readonly triangleCount: number;
}

export interface StudioSceneState {
  readonly revision: number;
  readonly nodes: readonly StudioSceneNodeSnapshot[];
  readonly availableSockets: readonly string[];
}

export interface StudioUndoEntry {
  readonly transactionId: string;
  readonly agentId: string;
  readonly toolName: StudioToolName;
  readonly previousState: StudioSceneState;
  readonly nextState: StudioSceneState;
}

export interface SingleModelT29RegenerateJob {
  readonly assetId: string;
  readonly sourceHdGlbPath: string;
  readonly targetLowGlbPath: string;
  readonly targetTriangles: number;
  readonly creaseDeg: number;
  readonly planarDeg: number;
  readonly cliCommand: string;
  readonly inMemoryPreview: PartSplitRetopoResult | null;
  readonly preAudit: FusedMeshWebbingAudit | null;
}

export interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly method: 'tools/list' | 'tools/call' | 'studio/undo';
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface JsonRpcResponse {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly result?: unknown;
  readonly error?: {
    readonly code: number;
    readonly message: string;
  };
}

const FORBIDDEN_CONSTITUTIONAL_TERMS = [
  'goblin',
  'cloth',
  'cape',
  'banner-flag',
  'chimney',
  'lettering',
  'floating-island',
] as const;

export const STUDIO_BYOA_MCP_TOOLS: readonly McpToolDefinition[] = [
  {
    name: 'studio.scene.inspect',
    description:
      'Returns the current Studio scene nodes, socket registry, triangle budgets, and grounding state.',
    mutatesScene: false,
    inputSchema: {
      type: 'object',
      required: [],
      properties: {},
    },
  },
  {
    name: 'studio.mesh.audit_webbing',
    description:
      'Audits a single-mesh GLB asset using TICKET-29 part-split detection to measure cross-part webbing slivers and concave seams.',
    mutatesScene: false,
    inputSchema: {
      type: 'object',
      required: ['assetId'],
      properties: {
        assetId: { type: 'string', description: 'Target asset identifier in Studio.' },
      },
    },
  },
  {
    name: 'studio.mesh.retopo_single_asset',
    description:
      'Runs TICKET-29 part-split low-poly retopology on a single model (un-welding fused parts, stripping webbing slivers, and collapsing coplanar walls). Used by both the Asset Bench Regenerate button and external agents.',
    mutatesScene: true,
    inputSchema: {
      type: 'object',
      required: ['assetId', 'targetTriangles'],
      properties: {
        assetId: { type: 'string', description: 'Asset ID to regenerate via T29 part-split pipeline.' },
        targetTriangles: { type: 'number', description: 'Target low-poly triangle budget (40..4000).' },
      },
    },
  },
  {
    name: 'studio.node.transform_and_snap',
    description:
      'Transforms or snaps a scene node to a named socket while enforcing SetMix grounding rules (aabbMinY <= 0.05 m unless socketed).',
    mutatesScene: true,
    inputSchema: {
      type: 'object',
      required: ['nodeId', 'position'],
      properties: {
        nodeId: { type: 'string', description: 'Target scene node ID.' },
        position: { type: 'array', description: '[x, y, z] position in meters.' },
        socketId: { type: 'string', description: 'Optional socket ID for modular snapping.' },
      },
    },
  },
  {
    name: 'studio.material.set_palette',
    description:
      'Updates a node material or metric plume color (#ff3d8a Pxd, #7cff4d Vtx, #ffc13d Lx, #3dc8ff Aq, #b46bff Synthesis) while enforcing SetMix industrial hard-surface rules.',
    mutatesScene: true,
    inputSchema: {
      type: 'object',
      required: ['nodeId', 'colorHex'],
      properties: {
        nodeId: { type: 'string', description: 'Target scene node ID.' },
        colorHex: { type: 'string', description: '6-digit hex color string (#rrggbb).' },
        label: { type: 'string', description: 'Optional updated node label.' },
      },
    },
  },
  {
    name: 'studio.viewport.capture_turntable',
    description:
      'Requests a 4-angle offscreen turntable snapshot (front, side, iso, top) from the shared Studio renderer (POL-92) so vision agents can inspect their edits.',
    mutatesScene: false,
    inputSchema: {
      type: 'object',
      required: ['assetId'],
      properties: {
        assetId: { type: 'string', description: 'Asset or scene ID to render.' },
      },
    },
  },
];

/**
 * Validates that an external agent's proposed label or asset tag obeys
 * SetMix constitutional rules (Resolution Crafter sole mode, no goblins/cloth/chimneys/floating parts).
 */
export function validateConstitutionalAgentAction(
  labelOrTag: string,
  aabbMinY: number,
  socketId: string | null,
): { readonly valid: boolean; readonly violation: string | null } {
  const lower = labelOrTag.toLowerCase();
  for (const term of FORBIDDEN_CONSTITUTIONAL_TERMS) {
    if (lower.includes(term)) {
      return {
        valid: false,
        violation: `Constitutional violation: forbidden term '${term}' is not permitted in SetMix Resolution Crafter assets.`,
      };
    }
  }
  if (socketId === null && aabbMinY > 0.05) {
    return {
      valid: false,
      violation: `Grounding violation: unsocketed asset floats at y=${aabbMinY.toFixed(3)}m (> 0.05m floor tolerance).`,
    };
  }
  return { valid: true, violation: null };
}

/**
 * Builds a single-model TICKET-29 regenerate job for the Studio Asset Bench "Regenerate" button
 * (or for the `studio.mesh.retopo_single_asset` MCP tool).
 */
export function buildSingleModelT29RegenerateJob(
  assetId: string,
  options: {
    readonly targetTriangles?: number;
    readonly creaseDeg?: number;
    readonly planarDeg?: number;
    readonly positions?: Float32Array;
    readonly indices?: Uint32Array | Uint16Array;
  } = {},
): SingleModelT29RegenerateJob {
  const cleanId = assetId.replace(/\.glb$/i, '').replace(/[^a-zA-Z0-9_-]/g, '');
  const targetTriangles = Math.max(40, Math.min(4000, Math.round(options.targetTriangles ?? 900)));
  const creaseDeg = options.creaseDeg ?? 50.0;
  const planarDeg = options.planarDeg ?? 8.0;

  const sourceHdGlbPath = `apps/web/public/hd/${cleanId}.glb`;
  const targetLowGlbPath = `apps/web/public/models/${cleanId}-low.glb`;
  const cliCommand = [
    'blender -b --python scripts/blender-part-split-retopo.py --',
    `--in ${sourceHdGlbPath}`,
    `--out ${targetLowGlbPath}`,
    `--target-tris ${targetTriangles}`,
    `--crease-deg ${creaseDeg.toFixed(1)}`,
    `--planar-deg ${planarDeg.toFixed(1)}`,
  ].join(' ');

  let preAudit: FusedMeshWebbingAudit | null = null;
  let inMemoryPreview: PartSplitRetopoResult | null = null;

  if (options.positions !== undefined && options.indices !== undefined) {
    preAudit = auditSingleMeshMultiPartAsset(cleanId, options.positions, options.indices);
    inMemoryPreview = retopologizeFusedMultiPartMesh(
      options.positions,
      options.indices,
      targetTriangles,
    );
  }

  return {
    assetId: cleanId,
    sourceHdGlbPath,
    targetLowGlbPath,
    targetTriangles,
    creaseDeg,
    planarDeg,
    cliCommand,
    inMemoryPreview,
    preAudit,
  };
}

/**
 * Stateful, deterministic MCP JSON-RPC 2.0 session controller with automatic
 * POL-90 undo/redo transaction recording for Bring Your Own Agent (BYOA).
 */
export class StudioByoaController {
  private state: StudioSceneState;
  private readonly undoStack: StudioUndoEntry[] = [];
  private readonly meshBuffers = new Map<
    string,
    { positions: Float32Array; indices: Uint32Array }
  >();

  constructor(initialState: StudioSceneState) {
    this.state = initialState;
  }

  public getSceneState(): StudioSceneState {
    return this.state;
  }

  public getUndoStack(): readonly StudioUndoEntry[] {
    return this.undoStack;
  }

  public registerAssetMeshBuffer(
    assetId: string,
    positions: Float32Array,
    indices: Uint32Array,
  ): void {
    this.meshBuffers.set(assetId.replace(/\.glb$/i, ''), { positions, indices });
  }

  public handleJsonRpc(request: JsonRpcRequest, agentId = 'external-agent'): JsonRpcResponse {
    if (request.method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: { tools: STUDIO_BYOA_MCP_TOOLS },
      };
    }

    if (request.method === 'studio/undo') {
      const popped = this.undoStack.pop();
      if (popped === undefined) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32001, message: 'Undo stack is empty' },
        };
      }
      this.state = popped.previousState;
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: { undoneTransactionId: popped.transactionId, revision: this.state.revision },
      };
    }

    if (request.method === 'tools/call') {
      const toolName = request.params?.['name'] as StudioToolName | undefined;
      const args = (request.params?.['arguments'] ?? {}) as Readonly<Record<string, unknown>>;
      if (toolName === undefined) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32602, message: 'Missing tool name in tools/call' },
        };
      }
      return this.executeToolCall(request.id, toolName, args, agentId);
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32601, message: `Unsupported method: ${String(request.method)}` },
    };
  }

  private executeToolCall(
    reqId: string | number,
    toolName: StudioToolName,
    args: Readonly<Record<string, unknown>>,
    agentId: string,
  ): JsonRpcResponse {
    if (toolName === 'studio.scene.inspect') {
      return {
        jsonrpc: '2.0',
        id: reqId,
        result: { scene: this.state },
      };
    }

    if (toolName === 'studio.mesh.audit_webbing') {
      const assetId = String(args['assetId'] ?? '').replace(/\.glb$/i, '');
      const buf = this.meshBuffers.get(assetId);
      if (buf === undefined) {
        return {
          jsonrpc: '2.0',
          id: reqId,
          error: { code: -32004, message: `Asset mesh buffer not loaded: ${assetId}` },
        };
      }
      const audit = auditSingleMeshMultiPartAsset(assetId, buf.positions, buf.indices);
      return { jsonrpc: '2.0', id: reqId, result: { audit } };
    }

    if (toolName === 'studio.mesh.retopo_single_asset') {
      const assetId = String(args['assetId'] ?? '').replace(/\.glb$/i, '');
      const targetTriangles = Number(args['targetTriangles'] ?? 900);
      const buf = this.meshBuffers.get(assetId);
      const job = buildSingleModelT29RegenerateJob(assetId, {
        targetTriangles,
        ...(buf !== undefined ? { positions: buf.positions, indices: buf.indices } : {}),
      });

      if (job.inMemoryPreview !== null) {
        const prevState = this.state;
        const newTris = job.inMemoryPreview.outputTriangleCount;
        const updatedNodes = this.state.nodes.map((n) =>
          n.assetId === assetId ? { ...n, triangleCount: newTris } : n,
        );
        const nextState: StudioSceneState = {
          revision: prevState.revision + 1,
          nodes: updatedNodes,
          availableSockets: prevState.availableSockets,
        };
        this.recordUndo(agentId, toolName, prevState, nextState);
        this.state = nextState;
      }

      return {
        jsonrpc: '2.0',
        id: reqId,
        result: {
          assetId: job.assetId,
          cliCommand: job.cliCommand,
          outputTriangleCount: job.inMemoryPreview?.outputTriangleCount ?? targetTriangles,
          partCount: job.inMemoryPreview?.parts.length ?? 1,
          removedWebbingTriangles: job.inMemoryPreview?.removedWebbingTriangles ?? 0,
        },
      };
    }

    if (toolName === 'studio.node.transform_and_snap') {
      const nodeId = String(args['nodeId'] ?? '');
      const posRaw = args['position'];
      const socketId = typeof args['socketId'] === 'string' ? args['socketId'] : null;
      if (!Array.isArray(posRaw) || posRaw.length < 3) {
        return {
          jsonrpc: '2.0',
          id: reqId,
          error: { code: -32602, message: 'Invalid [x, y, z] position array' },
        };
      }
      const pos: readonly [number, number, number] = [
        Number(posRaw[0] ?? 0),
        Number(posRaw[1] ?? 0),
        Number(posRaw[2] ?? 0),
      ];
      const targetNode = this.state.nodes.find((n) => n.nodeId === nodeId);
      if (targetNode === undefined) {
        return {
          jsonrpc: '2.0',
          id: reqId,
          error: { code: -32004, message: `Node not found: ${nodeId}` },
        };
      }

      const check = validateConstitutionalAgentAction(targetNode.label, pos[1], socketId);
      if (!check.valid) {
        return {
          jsonrpc: '2.0',
          id: reqId,
          error: { code: -32010, message: check.violation ?? 'Constitutional validation failed' },
        };
      }

      const prevState = this.state;
      const nextState: StudioSceneState = {
        revision: prevState.revision + 1,
        nodes: prevState.nodes.map((n) =>
          n.nodeId === nodeId
            ? { ...n, position: pos, aabbMinY: pos[1], socketId }
            : n,
        ),
        availableSockets: prevState.availableSockets,
      };
      this.recordUndo(agentId, toolName, prevState, nextState);
      this.state = nextState;
      return { jsonrpc: '2.0', id: reqId, result: { revision: nextState.revision, nodeId } };
    }

    if (toolName === 'studio.material.set_palette') {
      const nodeId = String(args['nodeId'] ?? '');
      const colorHex = String(args['colorHex'] ?? '#7cff4d');
      const newLabel = typeof args['label'] === 'string' ? args['label'] : undefined;
      const targetNode = this.state.nodes.find((n) => n.nodeId === nodeId);
      if (targetNode === undefined) {
        return {
          jsonrpc: '2.0',
          id: reqId,
          error: { code: -32004, message: `Node not found: ${nodeId}` },
        };
      }

      const labelToCheck = newLabel ?? targetNode.label;
      const check = validateConstitutionalAgentAction(
        labelToCheck,
        targetNode.aabbMinY,
        targetNode.socketId,
      );
      if (!check.valid) {
        return {
          jsonrpc: '2.0',
          id: reqId,
          error: { code: -32010, message: check.violation ?? 'Constitutional validation failed' },
        };
      }

      const prevState = this.state;
      const nextState: StudioSceneState = {
        revision: prevState.revision + 1,
        nodes: prevState.nodes.map((n) =>
          n.nodeId === nodeId
            ? { ...n, colorHex, label: labelToCheck }
            : n,
        ),
        availableSockets: prevState.availableSockets,
      };
      this.recordUndo(agentId, toolName, prevState, nextState);
      this.state = nextState;
      return { jsonrpc: '2.0', id: reqId, result: { revision: nextState.revision, colorHex } };
    }

    if (toolName === 'studio.viewport.capture_turntable') {
      const assetId = String(args['assetId'] ?? 'scene');
      return {
        jsonrpc: '2.0',
        id: reqId,
        result: {
          assetId,
          renderer: 'shared-offscreen-pol92',
          angles: ['front', 'side', 'iso', 'top'],
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id: reqId,
      error: { code: -32601, message: `Unknown Studio tool: ${ String(toolName) }` },
    };
  }

  private recordUndo(
    agentId: string,
    toolName: StudioToolName,
    previousState: StudioSceneState,
    nextState: StudioSceneState,
  ): void {
    this.undoStack.push({
      transactionId: `tx-${nextState.revision}`,
      agentId,
      toolName,
      previousState,
      nextState,
    });
  }
}
