import React, { useState } from 'react';
import type { BiomeFormulaId } from '../state/spore-card-codec';
import type { StudioStore } from '../state/studio-store';

export interface NewPlanetModalProps {
  store: StudioStore;
  onClose: () => void;
}

export const NewPlanetModal: React.FC<NewPlanetModalProps> = ({ store, onClose }) => {
  const [name, setName] = useState('New Frontier Alpha');
  const [seed, setSeed] = useState(7741);
  const [biome, setBiome] = useState<BiomeFormulaId>('lunar-basalt');
  const [pxd, setPxd] = useState(45);
  const [vtx, setVtx] = useState(30);
  const [lx, setLx] = useState(65);
  const [aq, setAq] = useState(25);

  const handleCreate = () => {
    store.createNewPlanet({
      name,
      seed,
      biome,
      floats: { pxd, vtx, lx, aq },
      stargateAccess: 'open',
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.82)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: 460,
          background: '#0f172a',
          border: '1px solid #38bdf8',
          borderRadius: 10,
          padding: 20,
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8' }}>
          Loop B: Genesis of a New Planet / World
        </div>

        <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
          Planet Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: 7, borderRadius: 6, background: '#1e293b', color: '#fff', border: '1px solid #334155' }}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
            Deterministic Seed
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value, 10) || 1)}
              style={{ padding: 7, borderRadius: 6, background: '#1e293b', color: '#fff', border: '1px solid #334155' }}
            />
          </label>

          <label style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
            Biome Formula
            <select
              value={biome}
              onChange={(e) => setBiome(e.target.value as BiomeFormulaId)}
              style={{ padding: 7, borderRadius: 6, background: '#1e293b', color: '#fff', border: '1px solid #334155' }}
            >
              <option value="lunar-basalt">Lunar Basalt</option>
              <option value="terran-forest">Terran Forest</option>
              <option value="volcanic-crag">Volcanic Crag</option>
              <option value="toxic-basin">Toxic Basin</option>
            </select>
          </label>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1', marginTop: 4 }}>
          Initial Atmospheric Floats S = (Pxd, Vtx, Lx, Aq) [0..100]
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
          <label>
            Pxd ({pxd})
            <input type="range" min={0} max={100} step={1} value={pxd} onChange={(e) => setPxd(parseInt(e.target.value, 10))} style={{ width: '100%' }} />
          </label>
          <label>
            Vtx ({vtx})
            <input type="range" min={0} max={100} step={1} value={vtx} onChange={(e) => setVtx(parseInt(e.target.value, 10))} style={{ width: '100%' }} />
          </label>
          <label>
            Lx ({lx})
            <input type="range" min={0} max={100} step={1} value={lx} onChange={(e) => setLx(parseInt(e.target.value, 10))} style={{ width: '100%' }} />
          </label>
          <label>
            Aq ({aq})
            <input type="range" min={0} max={100} step={1} value={aq} onChange={(e) => setAq(parseInt(e.target.value, 10))} style={{ width: '100%' }} />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button
            onClick={onClose}
            style={{ padding: '7px 14px', borderRadius: 6, background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            style={{ padding: '7px 16px', borderRadius: 6, background: '#10b981', border: 'none', color: '#052e16', fontWeight: 700, cursor: 'pointer' }}
          >
            Create Planet &amp; Seed Stargate
          </button>
        </div>
      </div>
    </div>
  );
};
