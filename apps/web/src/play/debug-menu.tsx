/**
 * The debug menu (the testers' panel): open it from the pause menu (Esc, then "Debug menu"). It ships in the production
 * build. Every action goes through the same hooks the dev switch exposes (window.__dev, see play.tsx), so a tester's
 * click and a test's call take one path. The panel holds no game state of its own: the chain comes in as a prop.
 */
import { useEffect, useState } from 'react';
import { CHAIN, CHAIN_STEPS, chainView, type Chain } from '../base/campaign-chain';
import { ITEMS, VEHICLE, VEHICLES, type VehicleKind } from '../base/catalog';
import type { Archetype } from '../monsters/roster';
import { kv } from '../storage/profile-storage';
import './debug-menu.css';

/** The hooks the panel calls (play.tsx builds them from the same refs as window.__dev). */
export interface DebugApi {
  /** Marks the current step done and moves the chain exactly one step on. Returns the step id, or null when none is current. */
  completeStep(): string | null;
  /** Marks the current act done (the chain moves to the next act). Returns the act id, or null when no act is running. */
  completeAct(): string | null;
  /** Sets the plot's fidelity stage (0 to 6). */
  setStage(stage: number): void;
  /** Refills the sync and the health. */
  refill(): void;
  /** Teleports the player: the lab, the gate pad, or the Moon plot. */
  teleport(where: 'lab' | 'gate' | 'plot'): void;
  /** Puts n of an item in the player's pack. False when it does not fit. */
  grant(item: string, n: number): boolean;
  /** Puts n of an item in the bridge store (the linked storage the benches draw from). */
  grantStock(item: string, n: number): void;
  /** The pack's counts, by item. */
  pack(): Record<string, number>;
  /** The bridge store's counts, by item. */
  bridgeStock(): Record<string, number>;
  /** Places a monster of `kind` `distance` m ahead of the view. Returns its id (-1 when there is no planet yet). */
  placeMob(kind: Archetype, distance?: number): number;
  /** Queues a vehicle print at the fabricator (the bill goes to the bridge store). Returns what happened, in words. */
  printVehicle(kind: VehicleKind): string;
}

export interface DebugMenuProps {
  readonly api: DebugApi;
  readonly chain: Chain;
  /** The plot's fidelity stage now. */
  readonly stage: number;
  /** Where the player stands ('lab' or 'planet'). */
  readonly where: string;
  /** Instant builds: machine work (fabricator prints, refinery and bench crafts) finishes at once. */
  readonly instantBuilds: boolean;
  readonly onInstantBuilds: (on: boolean) => void;
  readonly onClose: () => void;
}

/** The debug key of the Instant builds switch, in the profile's storage (kv guards every read and write). Off unless the tester turned it on. */
export const INSTANT_BUILDS_KEY = 'debug.instantBuilds';

/** Reads the Instant builds switch. Storage can be blocked or missing: then it is off. */
export function readInstantBuilds(): boolean {
  return kv.get(INSTANT_BUILDS_KEY) === '1';
}

/** Keeps the Instant builds switch. A blocked store only loses the saved choice; the switch still works for the session. */
export function writeInstantBuilds(on: boolean): void {
  kv.set(INSTANT_BUILDS_KEY, on ? '1' : '0');
}

interface CheckpointEntry { readonly name: string; readonly title: string; readonly act: string }
type CheckpointState = { readonly kind: 'loading' } | { readonly kind: 'ready'; readonly list: readonly CheckpointEntry[] } | { readonly kind: 'failed'; readonly why: string };

const KIND_LABEL: Readonly<Record<string, string>> = {
  bulk: 'Bulk materials',
  'raw-pxd': 'Raw pixels',
  'raw-vtx': 'Raw vertices',
  primitive: 'Primitives',
  map: 'Texture maps',
  blueprint: 'Blueprints',
  part: 'Weapon parts',
  tool: 'Tools',
  weapon: 'Weapons',
  equip: 'Equipment',
};
const KIND_ORDER = ['bulk', 'raw-pxd', 'raw-vtx', 'primitive', 'map', 'blueprint', 'part', 'weapon', 'tool', 'equip'] as const;

/** The monster archetypes, with the names the game's roster gives them. Typed as a full record, so a new archetype must be listed. */
const MOBS: Readonly<Record<Archetype, string>> = {
  charger: 'Charger',
  spitter: 'Spitter',
  swarmer: 'Swarmer',
  flyer: 'Flyer',
  brute: 'Brute',
  sapper: 'Sapper',
};
const MOB_KINDS = Object.keys(MOBS) as Archetype[];

const STAGES = [0, 1, 2, 3, 4, 5, 6] as const;

/** The items grouped by kind, in the order the player meets them. */
function itemGroups(): readonly { readonly kind: string; readonly label: string; readonly items: readonly { readonly id: string; readonly name: string }[] }[] {
  const out = KIND_ORDER.map((kind) => ({
    kind,
    label: KIND_LABEL[kind] ?? kind,
    items: Object.entries(ITEMS).filter(([, spec]) => spec.kind === kind).map(([id, spec]) => ({ id, name: spec.name })),
  }));
  return out.filter((g) => g.items.length > 0);
}
const GROUPS = itemGroups();

export function DebugMenu({ api, chain, stage, where, instantBuilds, onInstantBuilds, onClose }: DebugMenuProps) {
  const view = chainView(chain);
  const actQuest = chain.progress.quest;
  const actTitle = CHAIN.quests.find((q) => q.id === actQuest)?.title ?? null;
  const actDone = actQuest !== null && chain.progress.finished.includes(actQuest);
  const actSteps = actQuest !== null ? CHAIN.quests.find((q) => q.id === actQuest)?.steps.length ?? 0 : 0;
  const stepInAct = actQuest !== null && !actDone ? chain.progress.step + 1 : null;
  const allDone = view.current === null && view.index >= view.total;
  const currentTitle = view.current?.title ?? null;

  const [checkpoints, setCheckpoints] = useState<CheckpointState>({ kind: 'loading' });
  const [itemId, setItemId] = useState<string>('ore');
  const [amount, setAmount] = useState<string>('100');
  const [dest, setDest] = useState<'pack' | 'bridge'>('pack');
  const [, setTick] = useState(0);
  const bump = (): void => setTick((t) => t + 1);
  // the confirmation: a small strip inside the panel (the game's own toast is a title card, and it would cover the panel)
  const [toast, setToast] = useState<{ readonly text: string; readonly sub: string; readonly id: number } | null>(null);
  const notify = (text: string, sub = ''): void => setToast({ text, sub, id: Date.now() });
  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast((x) => (x?.id === toast.id ? null : x)), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // the checkpoint list: the file the game ships beside the page (apps/web/public/checkpoints/index.json)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(new URL('checkpoints/index.json', document.baseURI));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: unknown = await res.json();
        const list = Array.isArray(data)
          ? data.filter((e): e is CheckpointEntry => typeof e === 'object' && e !== null && typeof (e as CheckpointEntry).name === 'string' && typeof (e as CheckpointEntry).title === 'string' && typeof (e as CheckpointEntry).act === 'string')
          : [];
        if (alive) setCheckpoints({ kind: 'ready', list });
      } catch (err) {
        if (alive) setCheckpoints({ kind: 'failed', why: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => { alive = false; };
  }, []);

  const jumpTo = (name: string): void => {
    // the existing mechanism: ?checkpoint=<name> loads the file into the Checkpoint profile on the next boot
    const url = new URL(window.location.href);
    url.searchParams.set('checkpoint', name);
    window.location.assign(url.toString());
  };

  const amountN = Math.max(1, Math.min(999, Math.floor(Number(amount)) || 0));
  const itemName = ITEMS[itemId]?.name ?? itemId;
  const packHave = api.pack()[itemId] ?? 0;
  const bridgeHave = api.bridgeStock()[itemId] ?? 0;

  const doGrant = (): void => {
    if (dest === 'pack') {
      const ok = api.grant(itemId, amountN);
      notify(ok ? `${amountN} ${itemName} in your pack` : `No room in your pack for ${amountN} ${itemName}`, ok ? `Pack now holds ${api.pack()[itemId] ?? 0}.` : 'Free a slot, or grant to the bridge store.');
    } else {
      const before = api.bridgeStock()[itemId] ?? 0;
      api.grantStock(itemId, amountN);
      const got = (api.bridgeStock()[itemId] ?? 0) - before;
      notify(got > 0 ? `${got} ${itemName} on the bridge store` : `The bridge store has no room for ${itemName}`, got > 0 ? 'Linked storage: the benches draw from it.' : '');
    }
    bump();
  };

  const doStep = (): void => {
    const id = api.completeStep();
    if (id === null) { notify('No step to complete', 'The chain has not started, or every step is done.'); return; }
    const info = CHAIN_STEPS.find((s) => s.id === id);
    notify(`Step ${id} complete`, info ? info.title : '');
    bump();
  };

  const doAct = (): void => {
    const id = api.completeAct();
    if (id === null) { notify('No act to complete', 'The chain has not started.'); return; }
    const title = CHAIN.quests.find((q) => q.id === id)?.title ?? id;
    notify(`${title}: complete`, 'The chain moved on to the next act.');
    bump();
  };

  const doStage = (n: number): void => {
    api.setStage(n);
    notify(`Plot at stage ${n}`, 'The base and the Moon follow.');
    bump();
  };

  const toggleInstant = (): void => {
    const next = !instantBuilds;
    onInstantBuilds(next);
    notify(next ? 'Instant builds on' : 'Instant builds off', next ? 'Prints and crafts finish at once. The tag shows in the corner.' : 'Build times are back to normal.');
    bump();
  };

  const doTeleport = (where: 'lab' | 'gate' | 'plot', label: string): void => {
    api.teleport(where);
    notify(`Teleported to ${label}`);
    bump();
  };

  const doMob = (kind: Archetype): void => {
    const id = api.placeMob(kind, 6);
    if (id < 0) notify('No Moon to spawn on yet', 'Go to the Moon first (the gate).');
    else notify(`${MOBS[kind]} spawned`, 'Six metres ahead of your view.');
    bump();
  };

  const doVehicle = (kind: VehicleKind): void => {
    const msg = api.printVehicle(kind);
    notify(`${VEHICLE[kind].name}: print requested`, msg);
    bump();
  };

  const onPlanet = where === 'planet';

  return (
    <div className="play-pause debug-pause" role="presentation">
      <div className="dbg" role="dialog" aria-label="Debug menu" data-testid="debug-menu">
        <header className="dbg-head">
          <div>
            <h2>Debug menu</h2>
            <p>For testers. Actions change this profile and say what they did.</p>
          </div>
          <button type="button" className="dbg-close" onClick={onClose} aria-label="Close the debug menu">Close</button>
        </header>

        <div className="dbg-body">
          <section className="dbg-section" aria-labelledby="dbg-quest">
            <h3 id="dbg-quest">Quest</h3>
            <dl className="dbg-facts">
              <div>
                <dt>Current step</dt>
                <dd data-testid="dbg-step">
                  {view.current ? <><b>{view.current.id}</b> {currentTitle}</> : allDone ? 'Every step is done' : 'Not started: the chain begins when the drill runs'}
                </dd>
              </div>
              <div>
                <dt>Act</dt>
                <dd data-testid="dbg-act">
                  {actTitle ? (actDone ? `${actTitle} (done)` : `${actTitle}${stepInAct ? `, step ${stepInAct} of ${actSteps}` : ''}`) : 'None running'}
                </dd>
              </div>
            </dl>
            <div className="dbg-row">
              <button type="button" className="dbg-primary" onClick={doStep} disabled={!view.current} data-testid="dbg-complete-step">Complete this step</button>
              <button type="button" onClick={doAct} disabled={actQuest === null || actDone} data-testid="dbg-complete-act">Complete this act</button>
            </div>
            <p className="dbg-note">A step advances the chain by one step. An act marks every step in it done.</p>
          </section>

          <section className="dbg-section" aria-labelledby="dbg-jump">
            <h3 id="dbg-jump">Jump to act</h3>
            {checkpoints.kind === 'loading' ? <p className="dbg-note">Reading the checkpoint list...</p> : null}
            {checkpoints.kind === 'failed' ? <p className="dbg-note dbg-warn">The checkpoint list did not load ({checkpoints.why}).</p> : null}
            {checkpoints.kind === 'ready' ? (
              <div className="dbg-grid dbg-grid-wide">
                {checkpoints.list.map((cp) => (
                  <button type="button" key={cp.name} onClick={() => jumpTo(cp.name)} data-checkpoint={cp.name}>
                    <span>{cp.title}</span>
                    <small>{cp.name}</small>
                  </button>
                ))}
              </div>
            ) : null}
            <p className="dbg-note">Reloads the game from the checkpoint. A checkpoint already loaded in this tab keeps the progress made in it; open a new tab to start it again.</p>
          </section>

          <section className="dbg-section" aria-labelledby="dbg-world">
            <h3 id="dbg-world">World</h3>
            <div className="dbg-field">
              <span className="dbg-label">Plot stage: <b data-testid="dbg-stage">{stage}</b></span>
              <div className="dbg-stages" role="group" aria-label="Plot fidelity stage">
                {STAGES.map((n) => (
                  <button type="button" key={n} onClick={() => doStage(n)} aria-pressed={n === stage} className={n === stage ? 'on' : undefined} data-stage={n}>{n}</button>
                ))}
              </div>
            </div>
            <div className="dbg-row">
              <button type="button" onClick={() => { api.refill(); notify('Sync and health refilled'); bump(); }} data-testid="dbg-refill">Refill sync and health</button>
            </div>
            <div className="dbg-field">
              <span className="dbg-label">Teleport</span>
              <div className="dbg-row">
                <button type="button" onClick={() => doTeleport('lab', 'the lab')} data-teleport="lab">The lab</button>
                <button type="button" onClick={() => doTeleport('gate', 'the gate')} data-teleport="gate">The gate</button>
                <button type="button" onClick={() => doTeleport('plot', 'the Moon plot')} data-teleport="plot">The Moon plot</button>
              </div>
            </div>
          </section>

          <section className="dbg-section" aria-labelledby="dbg-builds">
            <h3 id="dbg-builds">Builds</h3>
            <div className="dbg-row">
              <button type="button" className={instantBuilds ? 'on' : undefined} aria-pressed={instantBuilds} onClick={toggleInstant} data-testid="dbg-instant">
                Instant builds: <b data-testid="dbg-instant-state">{instantBuilds ? 'On' : 'Off'}</b>
              </button>
            </div>
            <p className="dbg-note">While it is on, machine work finishes at once: fabricator prints (the scout, hauler and crawler), refinery and bench crafts. A tag shows in the top-right corner so screenshots say so. Off by default; the choice is kept on this PC.</p>
          </section>

          <section className="dbg-section" aria-labelledby="dbg-spawn">
            <h3 id="dbg-spawn">Spawn</h3>
            <div className="dbg-field">
              <span className="dbg-label">Items</span>
              <div className="dbg-row dbg-items">
                <select aria-label="Item" value={itemId} onChange={(e) => { setItemId(e.target.value); bump(); }} data-testid="dbg-item">
                  {GROUPS.map((g) => (
                    <optgroup key={g.kind} label={g.label}>
                      {g.items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <input aria-label="Amount" type="number" min={1} max={999} value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="dbg-amount" />
                <select aria-label="Destination" value={dest} onChange={(e) => setDest(e.target.value === 'bridge' ? 'bridge' : 'pack')} data-testid="dbg-dest">
                  <option value="pack">Pack</option>
                  <option value="bridge">Bridge store</option>
                </select>
                <button type="button" className="dbg-primary" onClick={doGrant} data-testid="dbg-grant">Grant {amountN}</button>
              </div>
              <p className="dbg-note" data-testid="dbg-counts">
                In pack: <b data-testid="pack-count">{packHave}</b> &middot; On the bridge store: <b>{bridgeHave}</b>
              </p>
            </div>
            <div className="dbg-field">
              <span className="dbg-label">Monsters {onPlanet ? '' : '(on the Moon only)'}</span>
              <div className="dbg-grid">
                {MOB_KINDS.map((kind) => (
                  <button type="button" key={kind} onClick={() => doMob(kind)} disabled={!onPlanet} data-mob={kind}>{MOBS[kind]}</button>
                ))}
              </div>
            </div>
            <div className="dbg-field">
              <span className="dbg-label">Vehicles</span>
              <div className="dbg-grid">
                {VEHICLES.map((kind) => (
                  <button type="button" key={kind} onClick={() => doVehicle(kind)} data-vehicle={kind}>
                    <span>Print {VEHICLE[kind].name}</span>
                    <small>Stage {VEHICLE[kind].stage} &middot; {VEHICLE[kind].seconds} s</small>
                  </button>
                ))}
              </div>
              <p className="dbg-note">Printing queues the vehicle at your fabricator and puts its bill on the bridge store. It rolls out when the fabricator finishes, which takes its full time.</p>
            </div>
          </section>
        </div>

        <footer className="dbg-foot">
          <p key={toast?.id ?? 'none'} className={`dbg-toast${toast ? ' on' : ''}`} role="status" data-testid="dbg-toast">
            {toast ? <><b>{toast.text}</b>{toast.sub ? <span>{toast.sub}</span> : null}</> : <span className="dbg-idle">Actions confirm here.</span>}
          </p>
        </footer>
      </div>
    </div>
  );
}
