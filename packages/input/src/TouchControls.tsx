import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import type { TouchInput } from './state';
import { layoutTouch, padToSteer } from './touch';

type ControlName = 'pad' | 'gas' | 'brake' | 'item';
type ActivePointer =
  | { control: 'pad'; steer: number }
  | { control: 'gas' | 'brake' | 'item' };

const safeDimension = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export function TouchControls(props: {
  width: number;
  height: number;
  onChange: (t: TouchInput | null) => void;
}): ReactElement {
  const layout = layoutTouch(props.width, props.height);
  const pointers = useRef(new Map<number, ActivePointer>());
  const [pressed, setPressed] = useState<ReadonlySet<ControlName>>(() => new Set());
  const [thumbSteer, setThumbSteer] = useState(0);

  const publish = (): void => {
    const active = pointers.current;
    const pressedControls = new Set<ControlName>();
    let steer = 0;
    let steerMagnitude = -1;
    let throttle = 0;
    let brake = 0;
    let item = false;

    for (const pointer of active.values()) {
      pressedControls.add(pointer.control);
      if (pointer.control === 'pad' && Math.abs(pointer.steer) > steerMagnitude) {
        steer = pointer.steer;
        steerMagnitude = Math.abs(pointer.steer);
      } else if (pointer.control === 'gas') {
        throttle = 1;
      } else if (pointer.control === 'brake') {
        brake = 1;
      } else if (pointer.control === 'item') {
        item = true;
      }
    }

    setPressed(pressedControls);
    setThumbSteer(steer);
    if (active.size === 0) {
      props.onChange(null);
    } else {
      props.onChange({ steer, throttle, brake, item });
    }
  };

  const steerFromEvent = (event: ReactPointerEvent<HTMLDivElement>): number => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return padToSteer(event.clientX, bounds.left, bounds.width);
  };

  const begin = (control: ControlName) => (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const pointer: ActivePointer = control === 'pad'
      ? { control, steer: steerFromEvent(event) }
      : { control };
    pointers.current.set(event.pointerId, pointer);
    publish();
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pointer = pointers.current.get(event.pointerId);
    if (pointer === undefined) return;
    event.preventDefault();
    if (pointer.control === 'pad') {
      pointers.current.set(event.pointerId, { control: 'pad', steer: steerFromEvent(event) });
    }
    publish();
  };

  const end = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!pointers.current.delete(event.pointerId)) return;
    event.preventDefault();
    publish();
  };

  const commonControlStyle = {
    position: 'absolute' as const,
    boxSizing: 'border-box' as const,
    display: 'grid',
    placeItems: 'center',
    pointerEvents: 'auto' as const,
    touchAction: 'none' as const,
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    color: 'rgba(255,255,255,0.92)',
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 800,
    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
  };

  const buttonStyle = (control: Exclude<ControlName, 'pad'>, button: { cx: number; cy: number; r: number }) => {
    const isPressed = pressed.has(control);
    return {
      ...commonControlStyle,
      left: button.cx - button.r,
      top: button.cy - button.r,
      width: button.r * 2,
      height: button.r * 2,
      borderRadius: '50%',
      border: `2px solid ${isPressed ? '#ffd24a' : 'rgba(255,255,255,0.42)'}`,
      background: isPressed ? 'rgba(255,210,74,0.42)' : 'rgba(8,15,24,0.38)',
      boxShadow: isPressed ? '0 0 24px rgba(255,210,74,0.3)' : '0 8px 24px rgba(0,0,0,0.14)',
      fontSize: Math.max(12, Math.min(19, button.r * 0.39)),
      letterSpacing: '0.04em',
      cursor: 'pointer',
    } as const;
  };

  const padIsPressed = pressed.has('pad');
  const thumbTravel = Math.max(0, layout.pad.width * 0.34);
  const rootStyle = {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: safeDimension(props.width),
    height: safeDimension(props.height),
    overflow: 'hidden' as const,
    pointerEvents: 'none' as const,
    touchAction: 'none' as const,
    zIndex: 20,
  };

  return (
    <div style={rootStyle} aria-label="Touch driving controls">
      <div
        data-touch="pad"
        aria-label="Steering"
        style={{
          ...commonControlStyle,
          left: layout.pad.left,
          top: layout.pad.top,
          width: layout.pad.width,
          height: layout.pad.height,
          borderRadius: 22,
          border: `1px solid ${padIsPressed ? 'rgba(255,210,74,0.75)' : 'rgba(255,255,255,0.2)'}`,
          background: padIsPressed ? 'rgba(255,210,74,0.12)' : 'rgba(255,255,255,0.035)',
          boxShadow: 'inset 0 0 48px rgba(255,255,255,0.025)',
          cursor: 'crosshair',
        }}
        onPointerDown={begin('pad')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 46,
            height: 46,
            marginLeft: -23,
            marginTop: -23,
            transform: `translateX(${thumbSteer * thumbTravel}px)`,
            borderRadius: '50%',
            border: `2px solid ${padIsPressed ? '#ffd24a' : 'rgba(255,255,255,0.78)'}`,
            background: padIsPressed ? 'rgba(255,210,74,0.58)' : 'rgba(255,255,255,0.18)',
            boxShadow: '0 2px 14px rgba(0,0,0,0.22)',
            pointerEvents: 'none',
            transition: 'transform 90ms ease-out',
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 12,
            bottom: 10,
            fontSize: 10,
            letterSpacing: '0.14em',
            opacity: 0.58,
            pointerEvents: 'none',
          }}
        >
          STEER
        </span>
      </div>
      <div
        data-touch="gas"
        aria-label="Accelerate"
        style={buttonStyle('gas', layout.gas)}
        onPointerDown={begin('gas')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        GAS
      </div>
      <div
        data-touch="brake"
        aria-label="Brake"
        style={buttonStyle('brake', layout.brake)}
        onPointerDown={begin('brake')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        BRAKE
      </div>
      <div
        data-touch="item"
        aria-label="Use item"
        style={buttonStyle('item', layout.item)}
        onPointerDown={begin('item')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        ITEM
      </div>
    </div>
  );
}