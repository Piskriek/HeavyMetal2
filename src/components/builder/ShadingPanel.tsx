import { Sun, Sparkles, Palette } from 'lucide-react';
import type { MaterialDescriptor } from '../../game/materials/material-descriptor';

interface ShadingPanelProps {
  descriptor: MaterialDescriptor;
  onChange: (updated: Partial<MaterialDescriptor>) => void;
}

export default function ShadingPanel({ descriptor, onChange }: ShadingPanelProps) {
  return (
    <div className="p-3 space-y-4 text-xs select-none">
      {/* Shading Mode Tabs */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sun size={13} /> Shading Model
        </label>
        <div className="grid grid-cols-2 gap-1 bg-black/40 p-1 rounded border border-amber-900/40">
          <button
            type="button"
            onClick={() => onChange({ shadingMode: 'lit' })}
            className={`py-1.5 rounded font-bold transition-all text-xs cursor-pointer ${
              descriptor.shadingMode === 'lit'
                ? 'bg-amber-600 text-black shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            LIT (PBR)
          </button>
          <button
            type="button"
            onClick={() => onChange({ shadingMode: 'unlit' })}
            className={`py-1.5 rounded font-bold transition-all text-xs cursor-pointer ${
              descriptor.shadingMode === 'unlit'
                ? 'bg-amber-600 text-black shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            UNLIT (Flat)
          </button>
        </div>
      </div>

      {/* Base Color Picker */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
          <Palette size={13} /> Base Albedo Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={descriptor.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="w-8 h-8 rounded border border-amber-700/60 bg-transparent cursor-pointer"
            aria-label="Albedo Color Picker"
          />
          <input
            type="text"
            value={descriptor.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="flex-1 px-2.5 py-1.5 bg-black/60 border border-amber-900/40 rounded text-amber-200 font-mono text-xs focus:outline-none focus:border-amber-400"
            aria-label="Albedo Color Hex Code"
          />
        </div>
      </div>

      {/* Lit Mode Properties */}
      {descriptor.shadingMode === 'lit' && (
        <div className="space-y-3 bg-black/20 p-2.5 rounded border border-amber-900/30">
          <div className="space-y-1">
            <div className="flex justify-between text-zinc-300">
              <span>Roughness</span>
              <span className="font-mono text-amber-300">{descriptor.roughness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={descriptor.roughness}
              onChange={(e) => onChange({ roughness: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
              aria-label="Roughness"
              aria-valuenow={descriptor.roughness}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-zinc-300">
              <span>Metalness</span>
              <span className="font-mono text-amber-300">{descriptor.metalness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={descriptor.metalness}
              onChange={(e) => onChange({ metalness: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
              aria-label="Metalness"
              aria-valuenow={descriptor.metalness}
            />
          </div>
        </div>
      )}

      {/* Unlit Glow Property */}
      {descriptor.shadingMode === 'unlit' && (
        <div className="space-y-1 bg-black/20 p-2.5 rounded border border-amber-900/30">
          <div className="flex justify-between text-zinc-300">
            <span className="flex items-center gap-1">
              <Sparkles size={12} className="text-amber-400" /> Glow / Bloom
            </span>
            <span className="font-mono text-amber-300">{descriptor.unlitGlow.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={descriptor.unlitGlow}
            onChange={(e) => onChange({ unlitGlow: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 cursor-pointer"
            aria-label="Glow / Bloom Multiplier"
            aria-valuenow={descriptor.unlitGlow}
          />
          <div className="text-[10px] text-zinc-400">Values &gt; 1.0 bloom on High Post-FX</div>
        </div>
      )}

      {/* Biome Tint */}
      <div className="space-y-2 bg-black/20 p-2.5 rounded border border-amber-900/30">
        <label className="flex items-center gap-2 cursor-pointer text-zinc-200">
          <input
            type="checkbox"
            checked={descriptor.biomeTint}
            onChange={(e) => onChange({ biomeTint: e.target.checked })}
            className="rounded accent-amber-500 cursor-pointer"
          />
          <span className="font-medium">Biome Color Tint</span>
        </label>

        {descriptor.biomeTint && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-zinc-300">
              <span className="text-[11px]">Tint Strength</span>
              <span className="font-mono text-amber-300">
                {(descriptor.biomeTintStrength * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={descriptor.biomeTintStrength}
              onChange={(e) => onChange({ biomeTintStrength: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
              aria-label="Biome Tint Strength"
              aria-valuenow={descriptor.biomeTintStrength}
            />
          </div>
        )}
      </div>

      {/* Mesh Rendering Flags */}
      <div className="space-y-2 pt-1 border-t border-amber-900/30 text-zinc-300">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={descriptor.doubleSided}
            onChange={(e) => onChange({ doubleSided: e.target.checked })}
            className="rounded accent-amber-500 cursor-pointer"
          />
          <span>Double-Sided Geometry</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={descriptor.castShadow}
            onChange={(e) => onChange({ castShadow: e.target.checked })}
            className="rounded accent-amber-500 cursor-pointer"
          />
          <span>Cast Shadows</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={descriptor.receiveShadow}
            onChange={(e) => onChange({ receiveShadow: e.target.checked })}
            className="rounded accent-amber-500 cursor-pointer"
          />
          <span>Receive Shadows</span>
        </label>
      </div>
    </div>
  );
}
