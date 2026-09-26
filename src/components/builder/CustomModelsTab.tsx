import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Box, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AssetDB } from '../../game/assets/asset-db';
import { parseOBJ, analyzeMesh, type AssetRecord } from '../../game/assets/model-import';

interface CustomModelsTabProps {
  onSelectModel: (assetId: string, name: string) => void;
  activeAssetId: string | null;
  usedAssetIds: ReadonlySet<string>;
}

export default function CustomModelsTab({
  onSelectModel,
  activeAssetId,
  usedAssetIds,
}: CustomModelsTabProps) {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const dbRef = useRef<AssetDB | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = async () => {
    setIsLoading(true);
    try {
      if (!dbRef.current) {
        dbRef.current = await AssetDB.open();
      }
      const list = await dbRef.current.list<AssetRecord>();
      setAssets(list);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    if (!file) return;

    try {
      const db = dbRef.current ?? (await AssetDB.open());
      dbRef.current = db;

      const text = await file.text();
      const parseRes = parseOBJ(text, file.name.replace(/\.[^/.]+$/, ''));
      if (!parseRes.ok) {
        setUploadError(`Import failed: ${parseRes.error}`);
        return;
      }

      const analysis = analyzeMesh(parseRes.mesh);
      const bytes = new TextEncoder().encode(text);
      const blobRes = await db.putBlob(bytes);

      if (!blobRes.ok) {
        setUploadError('Storage quota exceeded');
        return;
      }

      const assetId = `a_${blobRes.sha256.slice(0, 16)}`;
      const record: AssetRecord = {
        assetId,
        sha256: blobRes.sha256,
        name: file.name.replace(/\.[^/.]+$/, ''),
        kind: 'obj',
        bytes: bytes.length,
        companions: [],
        analysis,
        importedAt: new Date().toISOString(),
        defaultRole: 'decoration',
        defaultScale: analysis.suggestedScale,
      };

      await db.putAsset(record);
      await loadAssets();
    } catch (e) {
      setUploadError((e as Error).message || 'Failed to import model');
    }
  };

  const handleDelete = async (asset: AssetRecord) => {
    if (usedAssetIds.has(asset.assetId)) {
      alert(`Cannot delete "${asset.name}" because it is currently placed on the track.`);
      return;
    }

    if (confirm(`Delete model "${asset.name}" from your library?`)) {
      const db = dbRef.current ?? (await AssetDB.open());
      dbRef.current = db;
      const res = await db.remove(asset.assetId, usedAssetIds);
      if (res.ok) {
        await loadAssets();
      } else {
        alert(`Deletion refused: ${res.refusal}`);
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-3 space-y-3">
      {/* Upload Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFileUpload(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-950/20 hover:bg-amber-900/30 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all text-center gap-1.5"
      >
        <img
          src="/art/ui/icons/custom-model.png"
          alt="Custom 3D model"
          className="builder-shelf-icon object-contain drop-shadow"
          draggable={false}
        />
        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-200"><Upload size={14} />DROP .OBJ / .GLTF HERE</span>
        <span className="text-[10px] text-zinc-400">or click to browse files</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".obj,.gltf,.glb"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
      </div>

      {uploadError && (
        <div className="p-2 bg-red-950/80 border border-red-500/60 rounded text-red-200 text-xs flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Asset Grid */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {isLoading && (
          <div className="text-center py-8 text-xs text-amber-300 animate-pulse">
            Loading 3D Models...
          </div>
        )}

        {!isLoading && assets.length === 0 && (
          <div className="text-center py-8 text-zinc-400 text-xs">
            No custom 3D models imported yet. Drop an OBJ file above to get started!
          </div>
        )}

        {assets.map((asset) => {
          const isSelected = activeAssetId === asset.assetId;
          const isUsed = usedAssetIds.has(asset.assetId);

          return (
            <div
              key={asset.assetId}
              onClick={() => onSelectModel(asset.assetId, asset.name)}
              className={`p-2.5 rounded border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                isSelected
                  ? 'bg-amber-950/70 border-amber-400 shadow-md ring-1 ring-amber-400/50'
                  : 'bg-zinc-900/80 border-amber-900/40 hover:border-amber-500/50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded bg-black/60 border border-amber-700/40 flex items-center justify-center text-amber-300 flex-shrink-0">
                  <Box size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-amber-200 truncate">{asset.name}</div>
                  <div className="text-[10px] text-zinc-400 flex items-center gap-2">
                    <span>{asset.analysis.tris} tris</span>
                    <span>•</span>
                    <span>{(asset.bytes / 1024).toFixed(0)} KB</span>
                    {isUsed && (
                      <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> Placed
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(asset);
                }}
                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-black/40 rounded transition-colors"
                title="Delete from Library"
                aria-label={`Delete ${asset.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
