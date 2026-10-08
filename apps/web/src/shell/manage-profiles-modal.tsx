import { useState, type ReactElement } from 'react';
import { Trash2, Edit2, Check, X, User } from 'lucide-react';
import {
  listProfiles,
  activeProfile,
  renameProfile,
  deleteProfile,
  switchProfile,
  MAIN_PROFILE_ID,
  type ProfileEntry,
} from '../storage/profile-storage';

export function ManageProfilesModal(props: {
  readonly onClose: () => void;
  readonly onSwitching?: (name: string) => void;
}): ReactElement {
  const [profiles, setProfiles] = useState<ProfileEntry[]>(() => listProfiles());
  const active = activeProfile();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<ProfileEntry | null>(null);

  const refresh = (): void => {
    setProfiles(listProfiles());
  };

  const startRename = (p: ProfileEntry): void => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const saveRename = (id: string): void => {
    if (editName.trim()) {
      renameProfile(id, editName);
      refresh();
    }
    setEditingId(null);
  };

  const cancelRename = (): void => {
    setEditingId(null);
  };

  const handleDelete = (p: ProfileEntry): void => {
    deleteProfile(p.id);
    setConfirmDelete(null);
    refresh();
  };

  return (
    <div className="shell-layer shell-ui" style={{ zIndex: 60 }} role="dialog" aria-label="Manage profiles">
      <div className="shell-window narrow profile-manager-window">
        <header>
          <h3>Manage profiles</h3>
          <button onClick={props.onClose} aria-label="Close">Close</button>
        </header>

        {confirmDelete ? (
          <div className="profile-delete-confirm">
            <p className="confirm-text">
              Delete profile &apos;{confirmDelete.name}&apos;? Its Play save, islands, avatars and settings are removed. This cannot be undone.
            </p>
            <div className="btns">
              <button
                className="danger delete-confirm-btn"
                onClick={() => handleDelete(confirmDelete)}
              >
                Delete
              </button>
              <button className="quiet" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-list">
            <p className="hint">Profiles have their own saves, islands and characters.</p>
            {profiles.map((p) => {
              const isActive = p.id === active.id;
              const isMain = p.id === MAIN_PROFILE_ID;
              const isEditing = editingId === p.id;

              return (
                <div key={p.id} className={`profile-row ${isActive ? 'active' : ''}`}>
                  <div className="profile-row-info">
                    <User size={15} className="profile-icon" />
                    {isEditing ? (
                      <input
                        type="text"
                        className="profile-edit-input"
                        value={editName}
                        maxLength={24}
                        autoFocus
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(p.id);
                          if (e.key === 'Escape') cancelRename();
                        }}
                      />
                    ) : (
                      <span className="profile-name">
                        <b>{p.name}</b>
                        {isMain ? <span className="profile-badge">Main</span> : null}
                        {isActive ? <span className="profile-badge active">Active</span> : null}
                      </span>
                    )}
                  </div>

                  <div className="profile-row-actions">
                    {isEditing ? (
                      <>
                        <button title="Save name" onClick={() => saveRename(p.id)} aria-label="Save">
                          <Check size={14} />
                        </button>
                        <button title="Cancel" onClick={cancelRename} aria-label="Cancel">
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          title="Rename profile"
                          className="quiet"
                          onClick={() => startRename(p)}
                          aria-label={`Rename ${p.name}`}
                        >
                          <Edit2 size={13} />
                        </button>
                        {!isActive ? (
                          <button
                            className="quiet"
                            onClick={() => {
                              props.onSwitching?.(p.name);
                              switchProfile(p.id);
                            }}
                          >
                            Switch
                          </button>
                        ) : null}
                        {!isMain ? (
                          <button
                            title="Delete profile"
                            className="quiet danger delete-profile-btn"
                            onClick={() => setConfirmDelete(p)}
                            aria-label={`Delete ${p.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
