import React, { useState } from 'react';
import {
  auditSingleMeshMultiPartAsset,
  retopologizeFusedMultiPartMesh,
  type FusedMeshWebbingAudit,
  type PartSplitRetopoResult,
} from '../../../../packages/studiomesh/src/part-split-retopo';

export interface MultiPartRetopoInspectorProps {
  readonly assetId: string;
  readonly positions: Float32Array;
  readonly indices: Uint32Array | Uint16Array;
  readonly defaultTargetTriangles?: number;
  readonly onApplyRetopoMesh?: (result: PartSplitRetopoResult) => void;
}

/**
 * TICKET-29 Studio Inspector Panel — Un-webs and splits single-mesh multi-part
 * low-poly models into crisp, un-welded hard-surface sub-parts in one click.
 */
export const MultiPartRetopoInspector: React.FC<MultiPartRetopoInspectorProps> = ({
  assetId,
  positions,
  indices,
  defaultTargetTriangles = 800,
  onApplyRetopoMesh,
}) => {
  const [targetTris, setTargetTris] = useState<number>(defaultTargetTriangles);
  const [audit, setAudit] = useState<FusedMeshWebbingAudit | null>(null);
  const [lastResult, setLastResult] = useState<PartSplitRetopoResult | null>(null);

  const handleAudit = () => {
    const report = auditSingleMeshMultiPartAsset(assetId, positions, indices);
    setAudit(report);
  };

  const handleRunPartSplitRetopo = () => {
    const res = retopologizeFusedMultiPartMesh(positions, indices, targetTris);
    setLastResult(res);
    onApplyRetopoMesh?.(res);
  };

  return (
    <section
      className="studio-multipart-retopo-card"
      data-testid="studio-multipart-retopo-inspector"
      style={{
        padding: '10px 12px',
        border: '1px solid rgba(124, 255, 77, 0.35)',
        background: 'rgba(10, 14, 20, 0.92)',
        color: '#e6f2ff',
        fontFamily: 'monospace',
        fontSize: '12px',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>PART-SPLIT LOW-POLY RETOPO ({assetId})</strong>
        <button type="button" onClick={handleAudit} data-testid="btn-audit-webbing">
          Audit Fused Webbing
        </button>
      </header>

      {audit !== null && (
        <div style={{ marginTop: '8px', lineHeight: 1.45 }} data-testid="webbing-audit-summary">
          <div>
            Input Tris: <strong>{audit.totalTriangles}</strong> | Detected Parts:{' '}
            <strong>{audit.detectedPartCount}</strong>
          </div>
          <div>
            Webbing Slivers: <strong>{audit.webbingBridgeTriangles}</strong> | Concave Seams:{' '}
            <strong>{audit.concaveSeamEdges}</strong> | Coplanar Waste:{' '}
            <strong>{audit.coplanarRedundantTriangles}</strong>
          </div>
          <div>
            Severity: <strong>{(audit.webbingSeverityScore * 100).toFixed(1)}%</strong> (
            {audit.needsPartSplitRetopo ? 'NEEDS PART-SPLIT RETOPO' : 'CLEAN'})
          </div>
        </div>
      )}

      <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label htmlFor="target-tris-input">Target Tris:</label>
        <input
          id="target-tris-input"
          type="number"
          min={40}
          max={4000}
          step={50}
          value={targetTris}
          onChange={(e) => setTargetTris(Math.max(40, Number(e.target.value) || 400))}
          style={{ width: '76px', background: '#111923', color: '#7cff4d', border: '1px solid #3dc8ff' }}
        />
        <button
          type="button"
          onClick={handleRunPartSplitRetopo}
          data-testid="btn-run-part-split-retopo"
        >
          Un-Web &amp; Retopo Parts
        </button>
      </div>

      {lastResult !== null && (
        <div style={{ marginTop: '8px', color: '#7cff4d' }} data-testid="retopo-result-summary">
          Split into {lastResult.parts.length} un-welded parts | Stripped{' '}
          {lastResult.removedWebbingTriangles} webbing tris | {lastResult.inputTriangleCount} &rarr;{' '}
          {lastResult.outputTriangleCount} crisp tris (1 draw call)
        </div>
      )}
    </section>
  );
};
