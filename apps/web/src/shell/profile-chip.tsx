import { useState, useRef, useEffect, type ReactElement } from 'react';
import { User, ChevronDown, Plus, Settings } from 'lucide-react';
import {
  listProfiles,
  activeProfile,
  createProfile,
  switchProfile,
} from '../storage/profile-storage';

export function ProfileChip(props: {
  readonly onManageProfiles: () => void;
  readonly onSwitching?: (name: string) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const active = activeProfile();
  const profiles = listProfiles();

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const handleSwitch = (id: string, name: string): void => {
    if (id === active.id) {
      setOpen(false);
      return;
    }
    props.onSwitching?.(name);
    setOpen(false);
    switchProfile(id);
  };

  const handleCreate = (): void => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const created = createProfile(trimmed);
    setCreating(false);
    setNewName('');
    props.onSwitching?.(created.name);
    setOpen(false);
    switchProfile(created.id);
  };

  return (
    <div className="sm-profile-container" ref={menuRef}>
      <button
        type="button"
        className="sm-profile-chip"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Profile: ${active.name}`}
        aria-expanded={open}
      >
        <User size={13} strokeWidth={2} />
        <span className="sm-profile-label">{active.name}</span>
        <ChevronDown size={12} strokeWidth={2} className={`sm-profile-chevron ${open ? 'open' : ''}`} />
      </button>

      {open ? (
        <div className="sm-profile-menu" role="menu">
          <div className="sm-profile-section-title">Profiles</div>
          {profiles.map((p) => {
            const isCur = p.id === active.id;
            return (
              <button
                type="button"
                key={p.id}
                role="menuitem"
                className={`sm-profile-item ${isCur ? 'active' : ''}`}
                onClick={() => handleSwitch(p.id, p.name)}
              >
                <span className="sm-profile-item-name">{p.name}</span>
                {isCur ? <span className="sm-profile-cur-dot" /> : null}
              </button>
            );
          })}

          <div className="sm-profile-divider" />

          {creating ? (
            <div className="sm-profile-create-box">
              <input
                type="text"
                className="sm-profile-new-input"
                placeholder="Profile name"
                value={newName}
                maxLength={20}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                }}
              />
              <div className="sm-profile-create-btns">
                <button type="button" className="sm-profile-btn primary" onClick={handleCreate}>Create</button>
                <button type="button" className="sm-profile-btn" onClick={() => { setCreating(false); setNewName(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="sm-profile-item action"
              onClick={() => setCreating(true)}
            >
              <Plus size={14} />
              <span>New profile...</span>
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            className="sm-profile-item action"
            onClick={() => {
              setOpen(false);
              props.onManageProfiles();
            }}
          >
            <Settings size={13} />
            <span>Manage profiles</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
