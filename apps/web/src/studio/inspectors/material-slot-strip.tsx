import React, { useState } from 'react';
import type { StudioState, StudioStore } from '../state/studio-store';

export interface MaterialSlotStripProps {
  state: StudioState;
  store: StudioStore;
}

export const MaterialSlotStrip: React.FC<MaterialSlotStripProps> = ({ state, store }) => {
  const [groupByRole, setGroupByRole] = useState<boolean>(true);
  const allSlots = store.getMaterialSlotsForActiveKit();

  // Group slots by semantic role suffix (e.g. 'body', 'trim', 'bolts', 'band', 'default')
  // so 100+ part slots collapse cleanly into 5-10 role chips without blowing out CSS Grid width!
  const displayedSlots = React.useMemo(() => {
    if (!groupByRole) return allSlots;
    const byRole = new Map<
      string,
      {
        roleName: string;
        primarySlotName: string;
        materialId: string;
        partPaths: string[];
      }
    >();
    for (const s of allSlots) {
      const roleName = s.slotName.includes(':') ? s.slotName.split(':')[1]! : s.slotName;
      const existing = byRole.get(roleName);
      if (existing) {
        existing.partPaths.push(...s.partPaths);
      } else {
        byRole.set(roleName, {
          roleName,
          primarySlotName: s.slotName,
          materialId: s.materialId,
          partPaths: [...s.partPaths],
        });
      }
    }
    return [...byRole.values()].map((g) => ({
      slotName: g.primarySlotName,
      displayLabel: g.roleName,
      materialId: g.materialId,
      partCount: g.partPaths.length,
      partPaths: g.partPaths,
      isLamp: g.materialId.startsWith('lx:'),
    }));
  }, [allSlots, groupByRole]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: 'rgba(13, 17, 24, 0.94)',
        borderBottom: '1px solid #222a38',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowX: 'auto',
        flexWrap: 'wrap',
        maxHeight: 82,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#7f8ea3',
            whiteSpace: 'nowrap',
          }}
        >
          Material Slots ({displayedSlots.length}/{allSlots.length})
        </span>
        <button
          onClick={() => setGroupByRole((g) => !g)}
          title="Toggle between grouped semantic roles (body, trim, bolts) and individual part slots"
          style={{
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 9,
            border: '1px solid #334155',
            background: '#0f172a',
            color: '#38bdf8',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {groupByRole ? 'Grouped Roles' : 'All Part Slots'}
        </button>
      </div>

      {displayedSlots.map((slot) => {
        const label = 'displayLabel' in slot ? (slot as { displayLabel: string }).displayLabel : slot.slotName;
        const activeRole = state.activeSlotKey?.includes(':')
          ? state.activeSlotKey.split(':')[1]
          : state.activeSlotKey;
        const active = groupByRole
          ? activeRole === label || state.activeSlotKey === slot.slotName
          : state.activeSlotKey === slot.slotName;
        const spec = store.getEffectiveMaterialSpec(slot.materialId);
        const paintHex = slot.isLamp ? '#ffc13d' : spec.paint?.[0] ?? '#8c949c';
        return (
          <button
            key={slot.slotName}
            onClick={() =>
              store.selectPartAndSlot(
                slot.partPaths[0] ?? null,
                slot.slotName.split(':')[0] ?? null,
                slot.slotName,
              )
            }
            title={`Slot: ${slot.slotName} (${slot.materialId}) — ${slot.partPaths.length} placement(s)`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 9px',
              borderRadius: 999,
              border: active ? '1.5px solid #4fc3f7' : '1px solid #2a3446',
              background: active ? 'rgba(79, 195, 247, 0.16)' : '#141923',
              color: active ? '#e6f4ff' : '#b0bec5',
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: paintHex,
                border: '1px solid rgba(255,255,255,0.35)',
                display: 'inline-block',
              }}
            />
            <span>{label}</span>
            <span style={{ fontSize: 9, color: active ? '#81d4fa' : '#64748b' }}>
              ×{slot.partPaths.length}
            </span>
          </button>
        );
      })}
    </div>
  );
};
