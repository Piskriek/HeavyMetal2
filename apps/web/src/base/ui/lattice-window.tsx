import React, { useState } from 'react';
import type { BaseActions, LatticeView } from '../view';

interface LatticeWindowProps {
  lattice: LatticeView;
  actions: BaseActions;
  onClose: () => void;
}

export const LatticeWindow: React.FC<LatticeWindowProps> = ({
  lattice,
  actions,
  onClose,
}) => {
  const [selectedNetworkId, setSelectedNetworkId] = useState<number>(
    lattice.here ?? (lattice.networks[0]?.id || 1)
  );

  const activeNetwork =
    lattice.networks.find((n) => n.id === selectedNetworkId) || lattice.networks[0];

  const isInRange = lattice.here === selectedNetworkId;

  return (
    <div className="hm-modal-overlay" onClick={onClose} data-testid="lattice-modal">
      <div className="hm-window-panel" onClick={(e) => e.stopPropagation()} style={{ minWidth: 680 }}>
        {/* Header */}
        <div className="hm-window-header">
          <div className="hm-window-title">
            <span>🌐 QUANTUM LATTICE STORAGE BRIDGE</span>
            <span style={{ fontSize: 12, opacity: 0.6, textTransform: 'none' }}>
              Inter-Dimensional Linked Base Inventory
            </span>
          </div>
          <button className="hm-window-close-btn" onClick={onClose} data-testid="lattice-close-btn">
            ✕ ESC
          </button>
        </div>

        {/* Network Tabs & Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {lattice.networks.map((net) => {
              const isSelected = net.id === selectedNetworkId;
              const isHere = net.id === lattice.here;

              return (
                <button
                  key={net.id}
                  onClick={() => setSelectedNetworkId(net.id)}
                  style={{
                    background: isSelected ? 'var(--base-bg-slot-active)' : 'var(--base-bg-surface)',
                    border: isSelected ? '1px solid var(--base-cyan)' : '1px solid var(--base-border-subtle)',
                    color: isSelected ? 'var(--base-cyan)' : 'var(--base-text-secondary)',
                    padding: '8px 14px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontFamily: 'Oxanium',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                  data-testid={`lattice-network-tab-${net.id}`}
                >
                  NETWORK #{net.id} {isHere && '★ [NEARBY]'}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className={`hm-quantum-status-badge ${isInRange ? 'in-range' : 'out-of-range'}`}
              data-testid="quantum-range-badge"
            >
              <span style={{ fontSize: 10 }}>●</span>
              <span>{isInRange ? 'QUANTUM BRIDGE LINKED' : 'OUT OF RELAY RANGE'}</span>
            </div>
            {isInRange && (
              <button
                className="hm-quick-stack-btn"
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => actions.quickStack()}
                data-testid="lattice-quick-stack-btn"
              >
                QUICK DEPOSIT
              </button>
            )}
          </div>
        </div>

        {/* Network Metrics Bar */}
        {activeNetwork && (
          <div
            style={{
              display: 'flex',
              gap: 24,
              background: 'var(--base-bg-surface)',
              padding: '10px 16px',
              borderRadius: 6,
              border: '1px solid var(--base-border-subtle)',
              fontFamily: 'Oxanium',
              fontSize: 12,
            }}
          >
            <div>
              <span style={{ color: 'var(--base-text-muted)' }}>STORAGE BINS: </span>
              <strong>{activeNetwork.boxes}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--base-text-muted)' }}>QUANTUM RELAYS: </span>
              <strong>{activeNetwork.relays}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--base-text-muted)' }}>UNIQUE COMMODITIES: </span>
              <strong>{activeNetwork.totals.length}</strong>
            </div>
          </div>
        )}

        {/* Totals Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--base-text-muted)', textTransform: 'uppercase' }}>
            CONSOLIDATED NETWORK INVENTORY
          </span>

          <div className="hm-lattice-totals-grid" data-testid="lattice-totals-grid">
            {activeNetwork?.totals.map((t) => (
              <div key={t.item.id} className="hm-lattice-item-tile" title={t.item.name}>
                <div
                  className="hm-slot-icon-box"
                  style={{
                    background: t.item.tint,
                    width: 24,
                    height: 24,
                    boxShadow: `0 0 6px ${t.item.tint}66`,
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}
                  >
                    {t.item.name}
                  </span>
                  <span style={{ fontFamily: 'Oxanium', fontSize: 11, color: 'var(--base-cyan)' }}>
                    x{t.n.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
