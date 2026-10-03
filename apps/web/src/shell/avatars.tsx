import { useState, type ReactElement } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { AVATAR_KINDS, kindOf, type AvatarKind, type AvatarLook } from '@hm/avatarlook';
import { NewAvatar } from '../avatar/avatar-dock';
import { PresetPreview } from '../build/cards';
import { removeLook, usePlayer, wearLook } from '../build/player';
import { fx } from '../maker/feedback';

const kindName = (l: AvatarLook): string => AVATAR_KINDS.find((k) => k.id === kindOf(l))?.name ?? 'Goblin';

/**
 * Avatars (SetMix, harness level): everyone you can be. The one in use walks your island; Goblin Racing races as your goblin. Make a new one
 * of any kind, change one, or remove one (your last stays).
 */
export function AvatarsWindow(props: { readonly onClose: () => void; readonly onNew: (kind: AvatarKind) => void; readonly onEdit: (look: AvatarLook) => void }): ReactElement {
  const p = usePlayer();
  // New avatar: Quick setup and the wizard happen right here; Manual opens the full maker
  const [making, setMaking] = useState(false);
  const goblinId = p.looks.find((l) => kindOf(l) === 'goblin')?.id ?? null;
  return (
    <div className="shell-window" role="dialog" aria-label="Avatars">
      <header><h3>Avatars</h3><button onClick={props.onClose}>Close</button></header>
      {making ? (
        <div className="avatar-new"><NewAvatar big kind="goblin" onCancel={() => setMaking(false)} onMade={() => setMaking(false)} onManual={(k) => { setMaking(false); props.onNew(k); }} /></div>
      ) : (<>
      <p className="hint">The avatar in use walks your island. Goblin Racing races as your goblin.</p>
      <div className="shell-cards avatar-cards">
        {p.looks.map((l) => {
          const using = l.id === p.lookId;
          const where = [using ? 'Walks your island' : null, l.id === goblinId ? 'Races in Goblin Racing' : null].filter(Boolean).join('. ');
          return (
            <article key={l.id} className={`shell-activity avatar-card${using ? ' current' : ''}`}>
              <PresetPreview p={{ kind: 'look', look: l }} size={112} />
              <h4>{l.name}</h4>
              <p>{kindName(l)}{where ? `. ${where}.` : ''}</p>
              <div className="btns">
                {using ? <button disabled>In use</button> : <button className="go" onClick={() => { wearLook(l.id); fx('ui-success'); }}>Use</button>}
                <button title="Change it" aria-label={`Change ${l.name}`} onClick={() => props.onEdit(l)}><Pencil size={13} strokeWidth={1.6} /></button>
                <button title={p.looks.length > 1 ? 'Remove' : 'Your only avatar stays'} aria-label={`Remove ${l.name}`} disabled={p.looks.length <= 1} onClick={() => { if (removeLook(l.id)) fx('ui-toggle'); }}><Trash2 size={13} strokeWidth={1.6} /></button>
              </div>
            </article>
          );
        })}
        <button className="shell-activity new" onClick={() => setMaking(true)}><Plus size={18} strokeWidth={1.4} />New avatar</button>
      </div>
      </>)}
    </div>
  );
}
