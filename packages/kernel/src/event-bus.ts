/**
 * The event bus: tiny, synchronous, typed. Every event also goes to onAny listeners,
 * which is what the Pro tier's event log and the replay recorder use.
 */
import type { EventBus, Unsubscribe } from '@hm/contracts';

type Listener = (payload: never) => void;
type AnyListener = (name: string, payload: unknown) => void;

const toError = (thrown: unknown): Error =>
  thrown instanceof Error ? thrown : new Error(`A listener threw a non-Error value: ${String(thrown)}`);

/** Creates an event bus. Listener errors are reported as an 'error' event to onAny listeners, never swallowed silently. */
export const createEventBus = <M extends Record<string, unknown> = Record<string, unknown>>(): EventBus<M> => {
  const byName = new Map<string, Listener[]>();
  const anyListeners: AnyListener[] = [];
  // WHY a depth guard: an 'error' report must never recurse into itself if an onAny listener throws.
  let reportingError = false;

  const notifyAny = (name: string, payload: unknown): void => {
    for (const listener of [...anyListeners]) {
      try {
        listener(name, payload);
      } catch (thrown) {
        if (!reportingError) report(toError(thrown));
      }
    }
  };

  const report = (error: Error): void => {
    reportingError = true;
    try {
      notifyAny('error', error);
    } finally {
      reportingError = false;
    }
  };

  const remove = (name: string, listener: Listener): void => {
    const list = byName.get(name);
    if (list === undefined) return;
    const index = list.indexOf(listener);
    if (index >= 0) list.splice(index, 1);
    if (list.length === 0) byName.delete(name);
  };

  const add = (name: string, listener: Listener): Unsubscribe => {
    const list = byName.get(name);
    if (list === undefined) byName.set(name, [listener]);
    else list.push(listener);
    return () => remove(name, listener);
  };

  return {
    on<K extends keyof M & string>(name: K, listener: (payload: M[K]) => void): Unsubscribe {
      return add(name, listener as Listener);
    },
    once<K extends keyof M & string>(name: K, listener: (payload: M[K]) => void): Unsubscribe {
      const wrapped = ((payload: M[K]): void => {
        remove(name, wrapped);
        listener(payload);
      }) as Listener;
      return add(name, wrapped);
    },
    emit<K extends keyof M & string>(name: K, payload: M[K]): void {
      // Copy first: listeners may subscribe or unsubscribe while this event is being delivered.
      const list = byName.get(name);
      if (list !== undefined) {
        for (const listener of [...list]) {
          try {
            (listener as (value: M[K]) => void)(payload);
          } catch (thrown) {
            report(toError(thrown));
          }
        }
      }
      notifyAny(name, payload);
    },
    onAny(listener: AnyListener): Unsubscribe {
      anyListeners.push(listener);
      return () => {
        const index = anyListeners.indexOf(listener);
        if (index >= 0) anyListeners.splice(index, 1);
      };
    },
  };
};
