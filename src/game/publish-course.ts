/**
 * SHIPPED COURSES: builder → File → "Publish island to the game". Gathers the owner's island from this
 * browser (every island track's props and ground paint, the lane edits, the sky/sea/clouds) into the
 * file the game ships (`public/courses/island.json`, read at boot by shipped-courses.ts). The dev
 * server writes it (vite.config.ts, `/api/publish-course`); commit the file to ship it.
 */
import { readIslandProps, readIslandTracks } from './island-route/island-props-storage';
import { readGroundDoc } from './island-route/island-ground';
import { readLaneStorage } from './lane-storage';
import { getSkySettings } from './sky/sky-settings';
import { SHIPPED_COURSES_VERSION, type ShippedCourses } from './shipped-courses';

export const PUBLISH_ENDPOINT = '/api/publish-course';

export function gatherIsland(now = new Date()): ShippedCourses {
  const index = readIslandTracks();
  const lanes = readLaneStorage()?.networks.basalt;
  return {
    version: SHIPPED_COURSES_VERSION,
    publishedAt: now.toISOString(),
    active: index.active,
    tracks: index.tracks.map((t) => {
      const ground = readGroundDoc(t.id);
      return { id: t.id, name: t.name, props: readIslandProps(undefined, t.id), ...(ground ? { ground } : {}) };
    }),
    ...(lanes ? { lanes } : {}),
    sky: getSkySettings(),
  };
}

/** Sends the island to the dev server, which writes public/courses/island.json. */
export async function publishIsland(): Promise<{ ok: true; bytes: number; tracks: number } | { ok: false; error: string }> {
  const doc = gatherIsland();
  const body = JSON.stringify(doc);
  try {
    const res = await fetch(PUBLISH_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!res.ok) return { ok: false, error: `The dev server refused it (${res.status}). Publish from \`npm run dev\` on your own machine.` };
    return { ok: true, bytes: body.length, tracks: doc.tracks.length };
  } catch {
    return { ok: false, error: 'No dev server: publish from `npm run dev` on your own machine.' };
  }
}
