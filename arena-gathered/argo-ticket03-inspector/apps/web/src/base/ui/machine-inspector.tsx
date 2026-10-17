// ============================================================================
// File: apps/web/src/base/ui/machine-inspector.tsx
// TICKET-03 (OPUS_NOTE_09 Item B):
// Dark-glassmorphic telemetry modal in Oxanium/Inter vocabulary.
// Displays power bar (draw vs supply), hopper fill bar, cartridge slot,
// status pill, "Open refinery" / "Open fabricator" buttons, and On/Off toggle.
// Esc and Tab close it, with [Esc / Tab] Close hint visible.
// ============================================================================

import React, { useEffect } from 'react';
import {
  Activity,
  Box,
  Cpu,
  Flame,
  Gauge,
  Layers,
  Power,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  machinePlumeColour,
  type InspectAction,
  type InspectStatus,
  type MachineInspect,
} from '../machine-inspect';
import type { MachineKind } from '@hm/plotsim';
import './machine-inspector.css';

export interface MachineInspectorProps {
  view: MachineInspect;
  onAction(a: 'refine' | 'fabricate' | 'toggle'): void;
  onClose(): void;
}

const STATUS_META: Readonly<
  Record<InspectStatus, { label: string; badgeClass: string; summary: string }>
> = {
  running: {
    label: 'RUNNING',
    badgeClass: 'hm-insp-status-running',
    summary: 'Operating within nominal substrate telemetry parameters.',
  },
  idle: {
    label: 'IDLE // STANDBY',
    badgeClass: 'hm-insp-status-idle',
    summary: 'Powered and standing by. Queue a job or await demand.',
  },
  'no-power': {
    label: 'NO POWER',
    badgeClass: 'hm-insp-status-nopower',
    summary: 'Out of relay reach or grid brownout. Connect a Relay Pylon or Power Unit.',
  },
  'no-feed': {
    label: 'NO FEED',
    badgeClass: 'hm-insp-status-nofeed',
    summary: 'Hopper starved of input substrate or ore. Supply feed to resume.',
  },
  off: {
    label: 'OFFLINE',
    badgeClass: 'hm-insp-status-off',
    summary: 'Manually switched off at local breaker.',
  },
};

const METRIC_LABELS: Readonly<Record<string, string>> = {
  pxd: 'PXD // Pixel Density (#ff3d8a)',
  vtx: 'VTX // Vertex Density (#7cff4d)',
  lx: 'LX // Light Flux (#ffc13d)',
  aq: 'AQ // Aquatic (#3dc8ff)',
};

export const MachineInspector: React.FC<MachineInspectorProps> = ({
  view,
  onAction,
  onClose,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const statusMeta = STATUS_META[view.status];
  const accentColor =
    view.kind === 'fabricator'
      ? '#3dc8ff'
      : machinePlumeColour(view.kind as MachineKind);

  const powerRatio =
    view.kwDraw <= 0
      ? view.kwSupplied > 0
        ? 100
        : 0
      : Math.min(100, Math.round((view.kwSupplied / view.kwDraw) * 100));

  const hopperRatio = view.hopper
    ? Math.min(100, Math.round((view.hopper.n / Math.max(1, view.hopper.cap)) * 100))
    : 0;

  const canRefine = view.actions.includes('refine');
  const canFabricate = view.actions.includes('fabricate');
  const canToggle = view.actions.includes('toggle');

  const handleAction = (a: InspectAction) => {
    onAction(a);
  };

  return (
    <div
      className="hm-modal-overlay hm-insp-overlay"
      onClick={onClose}
      data-testid="machine-inspector-modal"
    >
      <div
        className="hm-window-panel hm-insp-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ '--hm-insp-accent': accentColor } as React.CSSProperties}
      >
        {/* Header */}
        <div className="hm-window-header hm-insp-header">
          <div className="hm-window-title">
            <Gauge size={22} style={{ color: accentColor, flexShrink: 0 }} />
            <div className="hm-insp-title-col">
              <div className="hm-insp-title-row">
                <span className="hm-insp-name">{view.name.toUpperCase()}</span>
                <span
                  className={`hm-insp-status-pill ${statusMeta.badgeClass}`}
                  data-testid="machine-inspector-status"
                >
                  {statusMeta.label}
                </span>
                {view.plumeOn && (
                  <span className="hm-insp-plume-pill" style={{ borderColor: accentColor, color: accentColor }}>
                    <Flame size={11} /> PLUME ACTIVE ({view.runPct}%)
                  </span>
                )}
              </div>
              <span className="hm-window-subtitle" data-testid="machine-inspector-summary">
                {statusMeta.summary}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="hm-window-close-btn hm-insp-close-btn"
            onClick={onClose}
            data-testid="machine-inspector-close"
          >
            <X size={14} /> [Esc / Tab] Close
          </button>
        </div>

        {/* Telemetry Grid */}
        <div className="hm-insp-body">
          {/* 1. Power Draw vs Supply */}
          <div className="hm-insp-card">
            <div className="hm-insp-card-header">
              <span className="hm-insp-card-label">
                <Zap size={14} /> POWER TELEMETRY (DRAW VS SUPPLY)
              </span>
              <span className="hm-insp-mono-val" data-testid="machine-inspector-power">
                {view.kwSupplied.toFixed(1)} kW / {view.kwDraw.toFixed(1)} kW ({view.runPct}%)
              </span>
            </div>
            <div className="hm-insp-bar-track">
              <div
                className="hm-insp-bar-fill"
                style={{
                  width: `${powerRatio}%`,
                  background:
                    view.status === 'no-power'
                      ? '#ef4444'
                      : powerRatio < 100
                        ? '#facc15'
                        : accentColor,
                }}
              />
            </div>
          </div>

          {/* 2. Hopper Fill */}
          <div className="hm-insp-card">
            <div className="hm-insp-card-header">
              <span className="hm-insp-card-label">
                <Box size={14} /> SUBSTRATE / ORE HOPPER
              </span>
              <span className="hm-insp-mono-val" data-testid="machine-inspector-hopper">
                {view.hopper ? `${view.hopper.item}: ${view.hopper.n} / ${view.hopper.cap}` : 'No hopper required'}
              </span>
            </div>
            {view.hopper ? (
              <div className="hm-insp-bar-track">
                <div
                  className="hm-insp-bar-fill"
                  style={{
                    width: `${hopperRatio}%`,
                    background: view.hopper.n === 0 ? '#ef4444' : '#3dc8ff',
                  }}
                />
              </div>
            ) : (
              <div className="hm-insp-muted">
                Direct grid link — operates without physical ore feed.
              </div>
            )}
          </div>

          {/* 3. Cartridge Slot & Metric Emission */}
          <div className="hm-insp-row-2col">
            <div className="hm-insp-card">
              <div className="hm-insp-card-header">
                <span className="hm-insp-card-label">
                  <Cpu size={14} /> CARTRIDGE SLOT (.SMX)
                </span>
              </div>
              <div className="hm-insp-slot-box" data-testid="machine-inspector-cartridge">
                {view.cartridge ? (
                  <span className="hm-insp-cart-active">{view.cartridge}</span>
                ) : (
                  <span className="hm-insp-muted">Empty (Default 1.0x substrate yield)</span>
                )}
              </div>
            </div>

            <div className="hm-insp-card">
              <div className="hm-insp-card-header">
                <span className="hm-insp-card-label">
                  <Activity size={14} /> METRIC EMISSION
                </span>
              </div>
              <div className="hm-insp-slot-box" data-testid="machine-inspector-emits">
                {view.emits ? (
                  <span style={{ color: accentColor, fontWeight: 700 }}>
                    {METRIC_LABELS[view.emits] ?? view.emits.toUpperCase()}
                  </span>
                ) : (
                  <span className="hm-insp-muted">Infrastructure / Extraction (Non-metric)</span>
                )}
              </div>
            </div>
          </div>

          {/* 4. Action Bar */}
          <div className="hm-insp-actions">
            {canRefine && (
              <button
                type="button"
                className="hm-primary-btn hm-insp-btn hm-insp-btn-primary"
                onClick={() => handleAction('refine')}
                data-testid="machine-inspector-open-refinery"
              >
                <Layers size={15} /> Open refinery
              </button>
            )}
            {canFabricate && (
              <button
                type="button"
                className="hm-primary-btn hm-insp-btn hm-insp-btn-primary"
                onClick={() => handleAction('fabricate')}
                data-testid="machine-inspector-open-fabricator"
              >
                <Wrench size={15} /> Open fabricator
              </button>
            )}
            {canToggle && (
              <button
                type="button"
                className={`hm-insp-btn ${view.status === 'off' ? 'hm-insp-btn-on' : 'hm-insp-btn-toggle'}`}
                onClick={() => handleAction('toggle')}
                data-testid="machine-inspector-toggle"
              >
                <Power size={15} /> {view.status === 'off' ? 'Turn On' : 'Turn Off'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
