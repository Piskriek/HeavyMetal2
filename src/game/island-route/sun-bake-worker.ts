/** The sun bake off the main thread (see sun-bake.ts): the editor keeps running and shows progress. */
import { bakeSunShadows, type SunBakeInput } from './sun-bake';

const post = (message: unknown, transfer?: Transferable[]) => (self as unknown as { postMessage(m: unknown, t?: Transferable[]): void }).postMessage(message, transfer ?? []);

self.onmessage = (event: MessageEvent<SunBakeInput>) => {
  try {
    let last = 0;
    const map = bakeSunShadows(event.data, (done, total) => {
      const progress = done / total;
      if (progress - last >= 0.01) { last = progress; post({ progress }); }
    });
    post({ map }, [map.buffer]);
  } catch (error) {
    post({ error: (error as Error).message });
  }
};
