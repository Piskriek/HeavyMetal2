/**
 * The client side of the asset bench's dev routes (apps/web/studio-server/bench.ts). Every call is local to the dev
 * server; on the built game each one fails and the Redo panel says so. The token is only ever sent by connect(),
 * from the owner's own form, and no reply carries it back.
 */
export const BENCH = '/__studio/bench';

export interface Archive { readonly name: string; readonly step: string; readonly at: string; readonly files: readonly string[] }
export interface Connection { readonly connected: boolean; readonly source: 'studio' | 'legacy' | null; readonly host: string; readonly provider?: string }
export interface JobStage { readonly label: string; readonly ms: number; readonly ok: boolean }
export interface Job {
  readonly id: number;
  readonly step: string;
  readonly assetId: string;
  readonly state: 'running' | 'ok' | 'failed' | 'cancelled';
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly stage: string | null;
  readonly stages: readonly JobStage[];
  readonly lines: readonly string[];
  readonly error: string | null;
}
export interface AssetInfo {
  readonly id: string;
  readonly entry: {
    readonly class: string;
    readonly subject: string;
    readonly view: string | null;
    readonly size: number | null;
    readonly axis: string | null;
    readonly panel: string | null;
    readonly budgets: readonly number[] | null;
  };
  readonly files: { readonly source: boolean; readonly sourceJson: boolean; readonly approved: boolean; readonly model: string | null };
  readonly levels: { readonly low: boolean; readonly mid: boolean; readonly high: boolean };
  readonly packed: { readonly lowBytes: number | null; readonly hdBytes: number | null; readonly hdLevels: { readonly mid: boolean; readonly high: boolean } };
  readonly archives: readonly Archive[];
  readonly connection: Connection;
  readonly jobRunning: boolean;
  readonly job: Job | null;
}
export type StepName = 'images' | 'model' | 'post' | 'pack';

/** The bench's answer: ok, or the reason it refused (shown to the owner as it is). */
export type Answer<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly why: string };

async function call<T>(method: string, path: string, body?: unknown): Promise<Answer<T>> {
  try {
    const r = await fetch(`${BENCH}${path}`, {
      method,
      cache: 'no-store',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; why?: string };
    if (!r.ok || j.ok === false) return { ok: false, why: j.why ?? `HTTP ${r.status}` };
    return { ok: true, value: j as unknown as T };
  } catch {
    return { ok: false, why: 'the Studio cannot reach the dev server' };
  }
}

export const getAsset = (id: string): Promise<Answer<AssetInfo>> => call<AssetInfo>('GET', `/asset/${id}`);
export const getConnection = (): Promise<Answer<Connection>> => call<Connection>('GET', '/connection');
export const connect = (url: string, token: string): Promise<Answer<Connection>> => call<Connection>('POST', '/connection', { url, token });
export const disconnect = (): Promise<Answer<Connection>> => call<Connection>('DELETE', '/connection');
export const testConnection = (): Promise<Answer<{ readonly ok: boolean; readonly why?: string; readonly detail?: Record<string, string | number | null> }>> =>
  call('POST', '/test');
export const saveDescription = (id: string, subject: string): Promise<Answer<{ readonly chars: number }>> =>
  call('POST', `/describe/${id}`, { subject });
export const approve = (id: string): Promise<Answer<{ readonly approved: boolean }>> => call('POST', `/approve/${id}`);
export const startStep = (step: StepName, id: string): Promise<Answer<{ readonly archived: string | null; readonly job: Job | null }>> =>
  call('POST', `/step/${step}/${id}`);
export const revert = (id: string, archive: string): Promise<Answer<{ readonly archivedAs: string | null; readonly job: Job | null }>> =>
  call('POST', `/revert/${id}/${archive}`);
export const cancelJob = (): Promise<Answer<{ readonly cancelled: boolean }>> => call('POST', '/cancel');
export const getJob = (): Promise<Answer<{ readonly running: boolean; readonly job: Job | null }>> => call('GET', '/job');

/** The URL of one of an asset's files (or one in an archive). Cache-busted by `v` when the file has changed. */
export function fileUrl(id: string, name: string, archive?: string, v?: number | string): string {
  const p = archive ? `/file/${id}/old/${archive}/${name}` : `/file/${id}/${name}`;
  return `${BENCH}${p}${v === undefined ? '' : `?v=${v}`}`;
}
