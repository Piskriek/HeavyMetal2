/**
 * The light bake off the main thread: one model's geometry in, its vertex colours out, with progress
 * along the way, so the editor keeps drawing (and shows the bake's progress) while it works.
 */
import { bakeVertexLighting, DEFAULT_BAKE_OPTS, type BakeOpts } from './vertex-baker';

export interface BakeJob { id: number; positions: Float32Array; indices: Uint32Array; opts?: Partial<BakeOpts> }
export type BakeReply =
  | { id: number; progress: number }
  | { id: number; colors: Float32Array; ms: number }
  | { id: number; error: string };

const post = (reply: BakeReply, transfer?: Transferable[]) => (self as unknown as { postMessage(m: unknown, t?: Transferable[]): void }).postMessage(reply, transfer ?? []);

self.onmessage = (event: MessageEvent<BakeJob>) => {
  const { id, positions, indices, opts } = event.data;
  try {
    let last = 0;
    const result = bakeVertexLighting({ name: 'model', positions, indices }, { ...DEFAULT_BAKE_OPTS, ...opts }, (done, total) => {
      const progress = done / total;
      if (progress - last >= 0.02) { last = progress; post({ id, progress }); }
    });
    post({ id, colors: result.colors, ms: result.ms }, [result.colors.buffer]);
  } catch (error) {
    post({ id, error: (error as Error).message });
  }
};
