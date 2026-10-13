/**
 * The Redo model panel (TASK-18): one asset, redone in the order the work goes. Connect the 3D AI once; then describe,
 * make a new image, use it, make the 3D model, process and pack, and compare the old with the new. Every step is a dev
 * route (api.ts, bench.ts) that runs one fixed script; the panel shows its progress and its log. Nothing here sends a
 * token anywhere but the connect form, and no reply carries one back.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  approve, cancelJob, connect, disconnect, fileUrl, getAsset, revert, saveDescription, startStep, testConnection,
  type Answer, type Archive, type AssetInfo, type Job, type StepName,
} from './studio-api';
import { checkSubject } from '../../studio-server/bench-rules';

const DEFAULT_URL = 'http://192.168.0.9:8082';
const RULES = [
  'Square sections, not round tubing.',
  'Nothing round unless it must be: wheels, tyres, barrels.',
  'No holes, no thin tubes or cables.',
  'Wall-mounted things are separate objects.',
  'Nothing floats: every part touches what holds it.',
];

const secs = (ms: number): string => (ms < 60000 ? `${Math.round(ms / 1000)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** The latest archive that holds a file (the newest first, as the server lists them). */
const latestWith = (archives: readonly Archive[], file: string): Archive | undefined => archives.find((a) => a.files.includes(file));

/**
 * Waits for the job this panel started, matched by its id: an earlier job's "ok" never answers for a later one. Returns
 * that job once it has ended, or null when the server no longer has it (or the panel is gone, or an hour has passed).
 */
async function waitForJob(id: string, jobId: number, alive: () => boolean): Promise<Job | null> {
  for (let i = 0; i < 3600 && alive(); i++) {
    await sleep(1000);
    const r = await getAsset(id);
    if (!r.ok) return null;
    const job = r.value.job;
    if (job?.id === jobId && job.state !== 'running') return job;
    if (!r.value.jobRunning && job?.id !== jobId) return null;
  }
  return null;
}

/** The outcome of a job, as the panel says it. */
function outcomeOf(job: Job): Note {
  if (job.state === 'ok') return { tone: 'ok', text: `${stepTitle(job.step)} done in ${secs((job.endedAt ?? Date.now()) - job.startedAt)}.` };
  if (job.state === 'cancelled') return { tone: 'warn', text: `${stepTitle(job.step)} cancelled.` };
  return { tone: 'err', text: `${stepTitle(job.step)} failed: ${job.error ?? 'see the log'}` };
}

type Note = { readonly tone: 'ok' | 'warn' | 'err'; readonly text: string };

export interface RedoProps {
  /** The selected asset, or null when none is selected. */
  readonly id: string | null;
  /** The archive shown against the new model in the viewport, or null. */
  readonly comparing: string | null;
  /** Shows (archive name) or hides (null) the old-against-new comparison in the viewport. */
  readonly onCompare: (archive: string | null) => void;
  /** A job ended: the page reloads what it shows of this asset. */
  readonly onChanged: (id: string) => void;
}

export function RedoPanel({ id, comparing, onCompare, onChanged }: RedoProps): ReactElement {
  const [info, setInfo] = useState<AssetInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const refresh = useCallback(async (): Promise<AssetInfo | null> => {
    if (!id) return null;
    const r = await getAsset(id);
    if (!alive.current) return null;
    if (r.ok) { setInfo(r.value); setErr(null); return r.value; }
    setErr(r.why);
    return null;
  }, [id]);

  useEffect(() => {
    setInfo(null);
    setErr(null);
    setNote(null);
    if (id) void refresh();
  }, [id, refresh]);

  const running = busy || info?.jobRunning === true;
  useEffect(() => {
    if (!running) return undefined;
    const t = window.setInterval(() => { void refresh(); }, 1000);
    return () => window.clearInterval(t);
  }, [running, refresh]);

  // a job ended (this panel's or another one's): the files it wrote are new, so the page and the thumbnails are told
  const wasRunning = useRef(false);
  useEffect(() => {
    if (running) { wasRunning.current = true; return; }
    if (wasRunning.current && id) {
      wasRunning.current = false;
      setVersion((v) => v + 1);
      onChanged(id);
    }
  }, [running, id, onChanged]);

  /** Runs a job the server has started and waits for that job (by its id). Resolves to the job, or to why it did not run. */
  const trackJob = useCallback(async (assetId: string, started: Promise<Answer<{ readonly job: Job | null }>>): Promise<{ readonly job: Job } | { readonly why: string }> => {
    const a = await started;
    if (!a.ok) return { why: a.why };
    if (!a.value.job) return { why: 'the job did not start' };
    const job = await waitForJob(assetId, a.value.job.id, () => alive.current);
    if (!job) return { why: 'the panel lost track of the job (is the dev server still running?)' };
    return { job };
  }, []);

  /** Shows the outcome of a tracked job (or the reason it did not run), and ends the busy state. */
  const settle = useCallback((r: { readonly job: Job } | { readonly why: string }, okText?: string): void => {
    if (!alive.current) return;
    if ('why' in r) setNote({ tone: 'err', text: r.why });
    else if (r.job.state === 'ok' && okText) setNote({ tone: 'ok', text: okText });
    else setNote(outcomeOf(r.job));
    setBusy(false);
    void refresh();
  }, [refresh]);

  const act = useCallback(async (what: () => Promise<{ ok: true } | { ok: false; why: string }>, okText?: string): Promise<void> => {
    setBusy(true);
    setNote(null);
    const r = await what();
    if (!alive.current) return;
    if (!r.ok) setNote({ tone: 'err', text: r.why });
    else if (okText) setNote({ tone: 'ok', text: okText });
    await refresh();
    if (alive.current) setBusy(false);
  }, [refresh]);

  const step = (name: StepName): void => {
    if (!id) return;
    setBusy(true);
    setNote(null);
    void trackJob(id, startStep(name, id)).then((r) => settle(r));
  };

  /** Process and pack are two jobs one after the other: the post step, then the pack, and only when the post step passed. */
  const processAndPack = (): void => {
    if (!id) return;
    setBusy(true);
    setNote(null);
    const started = Date.now();
    void (async () => {
      const post = await trackJob(id, startStep('post', id));
      if ('why' in post || post.job.state !== 'ok') { settle(post); return; }
      const pack = await trackJob(id, startStep('pack', id));
      settle(pack, `Processed and packed in ${secs(Date.now() - started)}.`);
    })();
  };

  if (!id) {
    return (
      <div className="sx-redo">
        <p className="sx-dim sx-empty">Place an asset in the scene first (double-click it in Content). Then redo it here.</p>
        <Connection onChanged={() => void refresh()} />
      </div>
    );
  }
  if (!info) {
    return (
      <div className="sx-redo">
        {err ? (
          <div className="sx-redo-unavailable" role="status">
            <h3>Redo runs in the dev Studio</h3>
            <p className="sx-dim">{err}. Open STUDIO.bat and this panel will work.</p>
          </div>
        ) : <p className="sx-dim">Reading {id}</p>}
      </div>
    );
  }

  const connected = info.connection.connected;
  const approved = info.files.approved;
  const hasImage = info.files.source;
  const lastOld = latestWith(info.archives, 'source.png');
  const levelArchive = info.archives.find((a) => a.files.includes('low.glb') && a.files.includes('high.glb'));
  const hasLevels = info.levels.low && info.levels.mid && info.levels.high;
  const job = info.job;
  const busyStep = running ? job?.step ?? null : null;

  return (
    <div className="sx-redo" aria-busy={running}>
      <header className="sx-redo-head">
        <h3>Redo {id}</h3>
        <p className="sx-dim">{info.entry.class}{info.entry.size !== null ? `, ${info.entry.size} m along its length` : ''}</p>
      </header>

      {note ? <p className={`sx-redo-note ${note.tone}`} role="status">{note.text}</p> : null}

      <Connection onChanged={() => void refresh()} connection={info.connection} />

      <ol className="sx-steps" aria-label="Redo steps">
        <li className="sx-step">
          <StepHead n={1} title="Describe" state={info.entry.subject ? 'done' : 'todo'} />
          <Describe id={id} subject={info.entry.subject} onSaved={() => { setVersion((v) => v + 1); void refresh(); }} />
        </li>

        <li className="sx-step">
          <StepHead n={2} title="New image" state={approved ? 'done' : hasImage ? 'review' : 'todo'}
            detail={approved ? 'Used for the model' : hasImage ? 'Review it, then use it or try again' : 'Make the first image'} />
          <div className="sx-pair">
            <figure>
              <figcaption className="sx-dim">{lastOld ? 'Before' : 'Before (none archived)'}</figcaption>
              {lastOld ? <img src={fileUrl(id, 'source.png', lastOld.name)} alt={`${id} before the redo`} /> : <span className="sx-pair-empty" />}
            </figure>
            <figure>
              <figcaption className="sx-dim">{hasImage ? 'Now' : 'Not made yet'}</figcaption>
              {hasImage ? <img src={fileUrl(id, 'source.png', undefined, version)} alt={`${id} new image`} /> : <span className="sx-pair-empty" />}
            </figure>
          </div>
          <div className="sx-actions">
            <button type="button" onClick={() => step('images')} disabled={running}>{hasImage ? 'Try again' : 'Make the image'}</button>
            <button type="button" className="sx-go" disabled={!hasImage || approved || running}
              onClick={() => void act(async () => { const r = await approve(id); return r.ok ? { ok: true } : { ok: false, why: r.why }; }, 'Image approved. The model will use it.')}>
              {approved ? 'Using this' : 'Use this'}
            </button>
          </div>
        </li>

        <li className="sx-step">
          <StepHead n={3} title="3D model" state={info.files.model && approved ? 'done' : 'todo'}
            detail={connected ? (info.files.model ? 'A model exists; making one replaces it (the old one is archived)' : 'Local Hunyuan3D, about 10 minutes') : 'Connect the 3D AI first'} />
          <div className="sx-actions">
            <button type="button" className="sx-go" disabled={!approved || !connected || running} onClick={() => step('model')}>
              {info.files.model ? 'Make the model again' : 'Make the model'}
            </button>
          </div>
        </li>

        <li className="sx-step">
          <StepHead n={4} title="Process and pack" state={hasLevels && info.packed.lowBytes !== null ? 'done' : 'todo'}
            detail="Fit the model, make the three levels, pack it into the game" />
          <div className="sx-actions">
            <button type="button" onClick={processAndPack} disabled={!info.files.model || running}>Process and pack</button>
          </div>
        </li>

        <li className="sx-step">
          <StepHead n={5} title="Compare" state={levelArchive ? 'review' : 'todo'}
            detail={levelArchive ? 'The old and the new, at every level' : 'Once a model has been packed before, the old one can be compared'} />
          {levelArchive ? (
            <div className="sx-actions">
              <button type="button" aria-pressed={comparing !== null} onClick={() => onCompare(comparing ? null : levelArchive.name)}>
                {comparing ? 'Hide the comparison' : 'Show old and new'}
              </button>
              <button type="button" className="sx-go" onClick={() => { onCompare(null); setNote({ tone: 'ok', text: 'Kept the new model. It is in the game.' }); }} disabled={running}>Keep</button>
              <button type="button" disabled={running} onClick={() => {
                setBusy(true);
                setNote(null);
                void trackJob(id, revert(id, levelArchive.name)).then((r) => {
                  if (!('why' in r)) onCompare(null);
                  settle(r, 'Put the old model back and packed it again. The new one is kept in an archive.');
                });
              }}>Revert to the old</button>
            </div>
          ) : null}
        </li>
      </ol>

      <JobLog job={job} running={running} busyStep={busyStep} />
      <p className="sx-dim sx-help">Archive: {info.archives.length} saved {info.archives.length === 1 ? 'copy' : 'copies'} of the older files in zips/runworld/assets/{id}/old.</p>
    </div>
  );
}

const stepTitle = (s: string): string => ({ images: 'New image', model: '3D model', post: 'Process', pack: 'Pack', revert: 'Revert' } as Record<string, string>)[s] ?? s;

function StepHead({ n, title, state, detail }: { readonly n: number; readonly title: string; readonly state: 'done' | 'review' | 'todo'; readonly detail?: string }): ReactElement {
  const label = state === 'done' ? 'Done' : state === 'review' ? 'To review' : 'To do';
  return (
    <header className="sx-step-head">
      <span className={`sx-step-dot ${state}`} aria-hidden="true">{n}</span>
      <div className="sx-step-title">
        <h4>{title}</h4>
        <p className="sx-dim">{detail ?? ''}</p>
      </div>
      <span className={`sx-step-state ${state}`}>{label}</span>
    </header>
  );
}

function Describe({ id, subject, onSaved }: { readonly id: string; readonly subject: string; readonly onSaved: () => void }): ReactElement {
  const [text, setText] = useState(subject);
  const [saving, setSaving] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  useEffect(() => { setText(subject); setWhy(null); }, [subject, id]);
  const check = useMemo(() => checkSubject(text), [text]);
  const dirty = text.replace(/\r\n/g, '\n').trim() !== subject.trim();
  const save = async (): Promise<void> => {
    if (!check.ok) { setWhy(check.why); return; }
    setSaving(true);
    const r = await saveDescription(id, check.value);
    setSaving(false);
    if (!r.ok) { setWhy(r.why); return; }
    setWhy(null);
    onSaved();
  };
  return (
    <div className="sx-describe">
      <label className="sx-field-label" htmlFor="sx-subject">What the model shows</label>
      <textarea id="sx-subject" className="sx-subject-input" rows={6} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <div className="sx-rules" aria-label="The owner's rules">
        {RULES.map((r) => <p key={r}><span aria-hidden="true">+</span> {r}</p>)}
      </div>
      <div className="sx-actions">
        <button type="button" className="sx-go" onClick={() => void save()} disabled={!dirty || saving}>Save description</button>
        {why ? <span className="sx-redo-why" role="alert">{why}</span> : null}
      </div>
    </div>
  );
}

function Connection({ connection, onChanged }: { readonly connection?: { readonly connected: boolean; readonly source: string | null; readonly host: string }; readonly onChanged: () => void }): ReactElement {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState<Note | null>(null);
  const [testing, setTesting] = useState(false);
  const connected = connection?.connected === true;
  const save = async (): Promise<void> => {
    const t = token;
    setToken('');
    const r = await connect(url, t);
    if (!r.ok) { setMsg({ tone: 'err', text: r.why }); return; }
    setMsg({ tone: 'ok', text: 'Connected. The token is stored on this PC and is not shown again.' });
    onChanged();
  };
  const test = async (): Promise<void> => {
    setTesting(true);
    const r = await testConnection();
    setTesting(false);
    if (!r.ok) { setMsg({ tone: 'err', text: r.why }); return; }
    if (!r.value.ok) { setMsg({ tone: 'err', text: r.value.why ?? 'the pipeline did not answer' }); return; }
    const d = r.value.detail ?? {};
    const parts = [d.busy !== undefined ? `busy ${d.busy}` : null, d.queued !== undefined ? `queued ${d.queued}` : null, d.vram_free_gb !== undefined ? `${d.vram_free_gb} GB VRAM free` : null].filter(Boolean);
    setMsg({ tone: 'ok', text: `The pipeline answers${parts.length ? `: ${parts.join(', ')}` : ''}.` });
  };
  const forget = async (): Promise<void> => {
    const r = await disconnect();
    if (!r.ok) { setMsg({ tone: 'err', text: r.why }); return; }
    setMsg({ tone: 'ok', text: 'Forgotten. Connect again to make models.' });
    onChanged();
  };
  return (
    <section className="sx-conn" aria-label="3D AI connection">
      <div className="sx-conn-head">
        <h4>3D AI</h4>
        <span className={`sx-conn-state ${connected ? 'on' : ''}`}>{connected ? 'connected' : 'not connected'}</span>
      </div>
      <div className="sx-providers" role="group" aria-label="Provider">
        <button type="button" aria-pressed="true">Local Hunyuan3D</button>
        {['Meshy', 'Tripo', 'RUN.world'].map((p) => <button key={p} type="button" disabled title="Coming soon">{p} <i>soon</i></button>)}
      </div>
      {connected ? (
        <div className="sx-actions">
          <span className="sx-dim">Connected to {connection?.host || 'the pipeline'}{connection?.source === 'legacy' ? ' (from .local3d-token)' : ''}.</span>
          <button type="button" onClick={() => void test()} disabled={testing}>{testing ? 'Testing' : 'Test connection'}</button>
          <button type="button" className="sx-mini" onClick={() => void forget()}>Disconnect</button>
        </div>
      ) : (
        <form className="sx-conn-form" autoComplete="off" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label className="sx-field-label" htmlFor="sx-conn-url">Address</label>
          <input id="sx-conn-url" type="text" value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} autoComplete="off" />
          <label className="sx-field-label" htmlFor="sx-conn-token">Access token</label>
          <input id="sx-conn-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="new-password" spellCheck={false} />
          <div className="sx-actions">
            <button type="submit" className="sx-go" disabled={token.trim().length === 0}>Save connection</button>
          </div>
        </form>
      )}
      {msg ? <p className={`sx-redo-note ${msg.tone}`} role="status">{msg.text}</p> : null}
    </section>
  );
}

function JobLog({ job, running, busyStep }: { readonly job: Job | null; readonly running: boolean; readonly busyStep: string | null }): ReactElement | null {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [job?.lines.length]);
  if (!job) return null;
  const elapsed = (job.endedAt ?? Date.now()) - job.startedAt;
  return (
    <section className="sx-job" aria-label="Job log">
      <div className="sx-job-head">
        <h4>{running ? `${stepTitle(busyStep ?? job.step)} running` : `Last job: ${stepTitle(job.step)}, ${job.state}`}</h4>
        <span className="sx-job-time">{secs(elapsed)}</span>
        {running ? <button type="button" className="sx-mini" onClick={() => void cancelJob()}>Cancel</button> : null}
      </div>
      {job.stages.length > 0 || job.stage ? (
        <ul className="sx-job-stages">
          {job.stages.map((s) => <li key={s.label} className={s.ok ? 'ok' : 'bad'}>{s.label}: {secs(s.ms)}</li>)}
          {job.stage && running ? <li className="now">{job.stage}</li> : null}
        </ul>
      ) : null}
      <pre ref={ref} className="sx-log" aria-label="Log">{job.lines.length ? job.lines.slice(-200).join('\n') : 'Waiting for the first line'}</pre>
    </section>
  );
}
