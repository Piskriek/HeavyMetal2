import React from 'react';
import { Shield, Mountain, Flame, Zap, Eye, CheckCircle2 } from 'lucide-react';
import type { CollisionRole, RoleConfig } from '../../game/collision/obstacle-roles';

interface CollisionPanelProps {
  roleConfig: RoleConfig;
  onChange: (updated: Partial<RoleConfig>) => void;
  patchHash?: string | null;
  triangleCount?: number;
}

const ROLES: { id: CollisionRole; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: 'decoration',
    label: 'Decoration',
    desc: 'Visual only, marbles pass through freely without collision',
    icon: <Eye size={15} className="text-zinc-400" />,
  },
  {
    id: 'terrain',
    label: 'Drivable Terrain',
    desc: 'Rasterized heightfield patch: marbles roll, bank and launch on top',
    icon: <Mountain size={15} className="text-emerald-400" />,
  },
  {
    id: 'barrier',
    label: 'Solid Barrier',
    desc: 'Static obstacle with bounce restitution',
    icon: <Shield size={15} className="text-amber-400" />,
  },
  {
    id: 'boost_gate',
    label: 'Boost Gate',
    desc: 'Increases marble speed forward when triggered',
    icon: <Zap size={15} className="text-yellow-400" />,
  },
  {
    id: 'hazard',
    label: 'Hazard Pit',
    desc: 'Triggers crash recovery to track centerline',
    icon: <Flame size={15} className="text-red-400" />,
  },
];

export default function CollisionPanel({
  roleConfig,
  onChange,
  patchHash,
  triangleCount = 0,
}: CollisionPanelProps) {
  const isTerrainDisabled = triangleCount > 20000;

  return (
    <div className="p-3 space-y-4 text-xs select-none">
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
          Mesh Collision Role
        </label>
        <div className="space-y-1.5">
          {ROLES.map((r) => {
            const isSelected = roleConfig.role === r.id;
            const disabled = r.id === 'terrain' && isTerrainDisabled;

            return (
              <div
                key={r.id}
                onClick={() => !disabled && onChange({ role: r.id })}
                className={`p-2.5 rounded border transition-all cursor-pointer flex items-start gap-2.5 ${
                  isSelected
                    ? 'bg-amber-950/70 border-amber-400 shadow ring-1 ring-amber-400/40'
                    : disabled
                    ? 'opacity-40 cursor-not-allowed bg-black/20 border-zinc-800'
                    : 'bg-black/40 border-amber-900/30 hover:border-amber-500/50'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">{r.icon}</div>
                <div className="min-w-0">
                  <div className="font-bold text-amber-200 text-xs flex items-center gap-1.5">
                    {r.label}
                    {isSelected && <CheckCircle2 size={12} className="text-amber-400" />}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{r.desc}</div>
                  {disabled && (
                    <div className="text-[10px] text-red-400 font-semibold mt-1">
                      Disabled: exceeds 20k triangle terrain cap
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Role specific settings */}
      {roleConfig.role === 'barrier' && (
        <div className="space-y-2 bg-black/30 p-2.5 rounded border border-amber-900/40">
          <div className="flex justify-between text-zinc-300">
            <span>Bounce Restitution</span>
            <span className="font-mono text-amber-300">
              {(roleConfig.restitution ?? 0.6).toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={roleConfig.restitution ?? 0.6}
            onChange={(e) => onChange({ restitution: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 cursor-pointer"
            aria-label="Bounce Restitution"
            aria-valuenow={roleConfig.restitution ?? 0.6}
          />
        </div>
      )}

      {roleConfig.role === 'boost_gate' && (
        <div className="space-y-2 bg-black/30 p-2.5 rounded border border-amber-900/40">
          <div className="flex justify-between text-zinc-300">
            <span>Boost Impulse (u/s)</span>
            <span className="font-mono text-amber-300">{roleConfig.boostImpulse ?? 300}</span>
          </div>
          <input
            type="range"
            min="100"
            max="800"
            step="50"
            value={roleConfig.boostImpulse ?? 300}
            onChange={(e) => onChange({ boostImpulse: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 cursor-pointer"
            aria-label="Boost Impulse"
            aria-valuenow={roleConfig.boostImpulse ?? 300}
          />
        </div>
      )}

      {roleConfig.role === 'terrain' && (
        <div className="bg-black/30 p-2.5 rounded border border-emerald-900/40 space-y-1.5 text-zinc-300">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-400">Heightfield Patch</span>
            <span className="font-mono text-[10px] text-zinc-400">
              {patchHash ? `hash: ${patchHash.slice(0, 8)}` : 'Compiled'}
            </span>
          </div>
          <div className="text-[10px] text-zinc-400">
            Grid spacing: 20 × 24 units. Physics integrates 3D bank and ramp slopes deterministically.
          </div>
        </div>
      )}
    </div>
  );
}
