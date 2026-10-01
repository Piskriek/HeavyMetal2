import type { RenderService } from '@hm/contracts';
import { orbit, orbitPosition, pan, stateFromPositionTarget, zoom, type OrbitState } from './camera-math';

type Point = { readonly x: number; readonly y: number };
type Gesture = { readonly cx: number; readonly cy: number; readonly distance: number };

const readState = (renderer: RenderService): OrbitState =>
  stateFromPositionTarget(renderer.camera.position, renderer.camera.target, 50);

const writeState = (renderer: RenderService, state: OrbitState): void => {
  renderer.camera.set(orbitPosition(state), state.target);
};

const panScale = (state: OrbitState, height: number): number =>
  2 * state.distance * Math.tan(state.fov * Math.PI / 360) / Math.max(1, height);

const touchGesture = (pointers: Map<number, Point>): Gesture | null => {
  const points = [...pointers.values()];
  const a = points[0];
  const b = points[1];
  if (!a || !b) return null;
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
};

export function attachOrbitControls(el: HTMLElement, renderer: RenderService, opts: { touchOrbit?: boolean } = {}): () => void {
  const pointers = new Map<number, Point>();
  const modes = new Map<number, 'orbit' | 'pan'>();
  let lastTouch: Gesture | null = null;
  const originalTouchAction = el.style.touchAction;
  el.style.touchAction = 'none';

  const onPointerDown = (event: PointerEvent): void => {
    const isTouch = event.pointerType === 'touch';
    const acceptedMouse = event.button === 1 || event.button === 2;
    if (!isTouch && !acceptedMouse) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!isTouch) modes.set(event.pointerId, event.shiftKey ? 'pan' : 'orbit');
    lastTouch = touchGesture(pointers);
    el.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (event.pointerType === 'touch') {
      const gesture = touchGesture(pointers);
      if (gesture && lastTouch) {
        let state = readState(renderer);
        if (gesture.distance > 1 && lastTouch.distance > 1) state = zoom(state, lastTouch.distance / gesture.distance);
        const scale = panScale(state, el.clientHeight);
        state = pan(state, -(gesture.cx - lastTouch.cx) * scale, (gesture.cy - lastTouch.cy) * scale);
        writeState(renderer, state);
      } else if (!gesture && opts.touchOrbit) {
        writeState(renderer, orbit(readState(renderer), -(event.clientX - previous.x) * 0.005, -(event.clientY - previous.y) * 0.005));
      }
      lastTouch = gesture;
      return;
    }
    const state = readState(renderer);
    if (modes.get(event.pointerId) === 'pan') {
      const scale = panScale(state, el.clientHeight);
      writeState(renderer, pan(state, -(event.clientX - previous.x) * scale, (event.clientY - previous.y) * scale));
    } else {
      writeState(renderer, orbit(state, -(event.clientX - previous.x) * 0.005, -(event.clientY - previous.y) * 0.005));
    }
  };

  const onPointerEnd = (event: PointerEvent): void => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    modes.delete(event.pointerId);
    lastTouch = touchGesture(pointers);
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    writeState(renderer, zoom(readState(renderer), 1.1 ** (event.deltaY / 100)));
  };

  const onContextMenu = (event: MouseEvent): void => event.preventDefault();
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerEnd);
  el.addEventListener('pointercancel', onPointerEnd);
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('contextmenu', onContextMenu);

  return (): void => {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerEnd);
    el.removeEventListener('pointercancel', onPointerEnd);
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('contextmenu', onContextMenu);
    el.style.touchAction = originalTouchAction;
    pointers.clear();
    modes.clear();
  };
}