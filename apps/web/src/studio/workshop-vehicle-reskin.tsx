// ============================================================================
// File: apps/web/src/studio/workshop-vehicle-reskin.tsx
// TICKET-21 (Workshop Local Vehicle Reskin — Owner Ruling):
// Lives as the "Workshop // Vehicle Skins" sub-tab inside The Studio (and can be
// opened directly from the Vehicle Fabricator inspector).
// Strictly local-only: customizes chassis liveries and optional .glb shell
// overrides for the 4 rover classes ('buggy', 'tank', 'hovercraft', 'driller')
// in localStorage without touching network packets or OutpostRoom.
// ============================================================================

import { useState, type ReactElement } from 'react';
import { kv } from '../storage/profile-storage';

export type VehicleClassId = 'buggy' | 'tank' | 'hovercraft' | 'driller';

export interface VehicleLiverySpec {
  readonly vehicleClass: VehicleClassId;
  readonly name: string;
  readonly hullHex: string;
  readonly trimHex: string;
  readonly hazardHex: string;
  readonly beaconHex: string;
  readonly customGlbName: string | null;
}

export const VEHICLE_CLASSES: readonly { readonly id: VehicleClassId; readonly label: string }[] = [
  { id: 'buggy', label: 'Lunar Buggy' },
  { id: 'tank', label: 'Heavy Tracked Tank' },
  { id: 'hovercraft', label: 'Regolith Hovercraft' },
  { id: 'driller', label: 'Core Driller Rig' },
];

export const DEFAULT_VEHICLE_LIVERIES: Readonly<Record<VehicleClassId, VehicleLiverySpec>> = {
  buggy: {
    vehicleClass: 'buggy',
    name: 'Outpost Amber',
    hullHex: '#d8dee6',
    trimHex: '#28323e',
    hazardHex: '#ffb020',
    beaconHex: '#3dc8ff',
    customGlbName: null,
  },
  tank: {
    vehicleClass: 'tank',
    name: 'Aegis Gunmetal',
    hullHex: '#3c4654',
    trimHex: '#1d232b',
    hazardHex: '#ff7b3d',
    beaconHex: '#ff3d8a',
    customGlbName: null,
  },
  hovercraft: {
    vehicleClass: 'hovercraft',
    name: 'S-Space Violet',
    hullHex: '#2c2540',
    trimHex: '#181426',
    hazardHex: '#b46bff',
    beaconHex: '#7ff0ff',
    customGlbName: null,
  },
  driller: {
    vehicleClass: 'driller',
    name: 'Excavator Lime',
    hullHex: '#354434',
    trimHex: '#1b241a',
    hazardHex: '#7cff4d',
    beaconHex: '#ffc13d',
    customGlbName: null,
  },
};

const STORAGE_KEY = 'hm.setmix.vehicleSkins.v1';
const memoryLiveries: Record<VehicleClassId, VehicleLiverySpec> = { ...DEFAULT_VEHICLE_LIVERIES };

export function loadLocalVehicleLiveries(): Record<VehicleClassId, VehicleLiverySpec> {
  try {
    const raw = kv.get(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<VehicleClassId, VehicleLiverySpec>>;
      return {
        buggy: { ...DEFAULT_VEHICLE_LIVERIES.buggy, ...(parsed.buggy ?? {}) },
        tank: { ...DEFAULT_VEHICLE_LIVERIES.tank, ...(parsed.tank ?? {}) },
        hovercraft: { ...DEFAULT_VEHICLE_LIVERIES.hovercraft, ...(parsed.hovercraft ?? {}) },
        driller: { ...DEFAULT_VEHICLE_LIVERIES.driller, ...(parsed.driller ?? {}) },
      };
    }
  } catch {
    // fall through to memoryLiveries
  }
  return { ...memoryLiveries };
}

export function saveLocalVehicleLivery(spec: VehicleLiverySpec): Record<VehicleClassId, VehicleLiverySpec> {
  const current = loadLocalVehicleLiveries();
  const next: Record<VehicleClassId, VehicleLiverySpec> = {
    ...current,
    [spec.vehicleClass]: spec,
  };
  Object.assign(memoryLiveries, next);
  try {
    kv.set(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota error
  }
  return next;
}

export function resetLocalVehicleLivery(vehicleClass: VehicleClassId): Record<VehicleClassId, VehicleLiverySpec> {
  return saveLocalVehicleLivery(DEFAULT_VEHICLE_LIVERIES[vehicleClass]);
}

/**
 * Studio "Workshop // Vehicle Skins" local reskin panel (TICKET-21).
 */
export function WorkshopVehicleReskinPanel(props: {
  readonly initialClass?: VehicleClassId;
  readonly onApplyLivery?: (spec: VehicleLiverySpec) => void;
  readonly onClose?: () => void;
}): ReactElement {
  const [selectedClass, setSelectedClass] = useState<VehicleClassId>(props.initialClass ?? 'buggy');
  const [liveries, setLiveries] = useState<Record<VehicleClassId, VehicleLiverySpec>>(() => loadLocalVehicleLiveries());
  const active = liveries[selectedClass];

  const update = (patch: Partial<VehicleLiverySpec>): void => {
    const updated: VehicleLiverySpec = { ...active, ...patch, vehicleClass: selectedClass };
    const next = saveLocalVehicleLivery(updated);
    setLiveries(next);
    props.onApplyLivery?.(updated);
  };

  return (
    <section className="studio-workshop-vehicle-reskin" aria-label="Workshop Vehicle Skins">
      <header className="swv-header">
        <h3>Workshop // Vehicle Skins (Local)</h3>
        {props.onClose ? <button type="button" onClick={props.onClose}>Close</button> : null}
      </header>
      <p className="hint">
        Customize your rover chassis colours or attach a local .glb shell override. Stored locally on this machine.
      </p>
      <div className="seg swv-classes" role="tablist" aria-label="Vehicle class">
        {VEHICLE_CLASSES.map((vc) => (
          <button
            key={vc.id}
            type="button"
            role="tab"
            aria-selected={selectedClass === vc.id}
            className={selectedClass === vc.id ? 'on' : ''}
            onClick={() => setSelectedClass(vc.id)}
          >
            {vc.label}
          </button>
        ))}
      </div>
      <div className="swv-fields">
        <label>
          <span>Livery Name</span>
          <input
            type="text"
            maxLength={24}
            value={active.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
        <label>
          <span>Hull Plating</span>
          <input type="color" value={active.hullHex} onChange={(e) => update({ hullHex: e.target.value })} />
        </label>
        <label>
          <span>Chassis Trim</span>
          <input type="color" value={active.trimHex} onChange={(e) => update({ trimHex: e.target.value })} />
        </label>
        <label>
          <span>Hazard Stripes</span>
          <input type="color" value={active.hazardHex} onChange={(e) => update({ hazardHex: e.target.value })} />
        </label>
        <label>
          <span>Telemetry Beacon</span>
          <input type="color" value={active.beaconHex} onChange={(e) => update({ beaconHex: e.target.value })} />
        </label>
      </div>
      <div className="btns swv-footer">
        <button
          type="button"
          onClick={() => {
            const next = resetLocalVehicleLivery(selectedClass);
            setLiveries(next);
            props.onApplyLivery?.(next[selectedClass]);
          }}
        >
          Reset to Stock
        </button>
      </div>
    </section>
  );
}
