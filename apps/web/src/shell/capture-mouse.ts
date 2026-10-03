/**
 * Capture the mouse for mouse look. Asks for raw movement first: with the OS-adjusted kind, Chrome on Windows now and then reports one
 * huge jump and the view snaps round. Browsers without raw movement get the plain capture. `onFail` runs when the browser refuses
 * (too soon after Esc, no user gesture, not supported at all).
 */
export function captureMouse(el: HTMLElement, onFail: () => void = () => undefined): void {
  const plain = (): void => {
    try { const r = el.requestPointerLock() as unknown as Promise<void> | undefined; r?.catch?.(() => onFail()); } catch { onFail(); }
  };
  try {
    const r = (el.requestPointerLock as (this: HTMLElement, o?: { unadjustedMovement?: boolean }) => Promise<void> | undefined).call(el, { unadjustedMovement: true });
    r?.catch?.((e: unknown) => { if ((e as { name?: string } | null)?.name === 'NotSupportedError') plain(); else onFail(); });
  } catch { plain(); }
}

/** A hand speeds up over a few events; one jump far bigger than the moves just before it is the browser's glitch, not the player. */
export function lookFilter(): (dx: number, dy: number) => boolean {
  let last = 0;
  return (dx, dy) => {
    const step = Math.hypot(dx, dy);
    if (step > 300 && step > 8 * (last + 5)) return false;
    last = step;
    return true;
  };
}
