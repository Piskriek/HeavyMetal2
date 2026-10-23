import React, { useState } from 'react';
import {
  buildSingleModelT29RegenerateJob,
  type SingleModelT29RegenerateJob,
} from '../../../../packages/studiomesh/src/byoa-studio-protocol';

export interface AssetBenchT29RegenerateButtonProps {
  readonly assetId: string;
  readonly defaultTargetTriangles?: number;
  readonly positions?: Float32Array;
  readonly indices?: Uint32Array | Uint16Array;
  readonly onJobDispatched?: (job: SingleModelT29RegenerateJob) => void;
}

/**
 * TICKET-30 — Studio Asset Bench Single-Model "Regenerate (T29 Part-Split)" Button.
 * Runs the TICKET-29 part-split un-webbing pipeline on a single model at a time
 * and exposes the exact CLI / local dev-server command for write-back.
 */
export const AssetBenchT29RegenerateButton: React.FC<AssetBenchT29RegenerateButtonProps> = ({
  assetId,
  defaultTargetTriangles = 900,
  positions,
  indices,
  onJobDispatched,
}) => {
  const [lastJob, setLastJob] = useState<SingleModelT29RegenerateJob | null>(null);

  const handleRegenerateSingleModel = () => {
    const job = buildSingleModelT29RegenerateJob(assetId, {
      targetTriangles: defaultTargetTriangles,
      ...(positions !== undefined && indices !== undefined ? { positions, indices } : {}),
    });
    setLastJob(job);
    onJobDispatched?.(job);
  };

  return (
    <div
      className="asset-bench-t29-regenerate"
      data-testid="asset-bench-t29-regenerate"
      style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}
    >
      <button
        type="button"
        onClick={handleRegenerateSingleModel}
        data-testid="btn-asset-bench-t29-regenerate"
        style={{
          padding: '6px 10px',
          background: '#13261b',
          color: '#7cff4d',
          border: '1px solid #7cff4d',
          fontFamily: 'monospace',
          fontSize: '11px',
          cursor: 'pointer',
        }}
      >
        Regenerate Low-Poly (T29 Part-Split)
      </button>
      {lastJob !== null && (
        <small
          data-testid="asset-bench-t29-status"
          style={{ fontFamily: 'monospace', fontSize: '10px', color: '#3dc8ff' }}
        >
          Queued {lastJob.assetId} &rarr; {lastJob.targetLowGlbPath} ({lastJob.targetTriangles} tris)
        </small>
      )}
    </div>
  );
};
