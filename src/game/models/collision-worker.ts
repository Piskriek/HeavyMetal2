/**
 * Placed models' collision off the main thread: world-space shapes in, the physics' patch out. Putting
 * every vertex onto the road and rasterising it is the heavy part; doing it here keeps build mode, undo
 * and the start of a test drive smooth.
 */
import { courseTrackSpace } from '../island-route/island-space';
import { patchFromWorldMeshes, type KitCollisionInput } from './kit-collision';
import type { CourseId } from '../types';

interface Job extends KitCollisionInput { id: number; course: CourseId }

const post = (message: unknown, transfer: Transferable[] = []) => (self as unknown as { postMessage(m: unknown, t?: Transferable[]): void }).postMessage(message, transfer);

self.onmessage = (event: MessageEvent<Job>) => {
  const job = event.data;
  try {
    const patch = patchFromWorldMeshes(job.full, job.drive, courseTrackSpace(job.course), job.role, job.restitution);
    const transfer: Transferable[] = [];
    if (patch) {
      transfer.push(patch.heights.buffer, patch.slopeX.buffer, patch.slopeZ.buffer, patch.flags.buffer);
      if (patch.solid) transfer.push(patch.solid.top.buffer, patch.solid.bottom.buffer);
    }
    post({ id: job.id, patch }, transfer);
  } catch (error) {
    post({ id: job.id, error: (error as Error).message });
  }
};
