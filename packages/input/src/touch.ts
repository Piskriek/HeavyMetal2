export interface TouchLayout {
  pad: { left: number; top: number; width: number; height: number };
  gas: { cx: number; cy: number; r: number };
  brake: { cx: number; cy: number; r: number };
  item: { cx: number; cy: number; r: number };
}

const finiteDimension = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export function padToSteer(x: number, left: number, width: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(left) || !Number.isFinite(width) || width <= 0) return 0;

  const halfWidth = width / 2;
  const normalizedOffset = (x - (left + halfWidth)) / halfWidth;
  const magnitude = Math.abs(normalizedOffset);
  const deadZone = 0.08;
  if (magnitude <= deadZone) return 0;

  const rescaled = Math.min(1, (magnitude - deadZone) / (1 - deadZone));
  return Math.sign(normalizedOffset) * rescaled;
}

export function layoutTouch(width: number, height: number): TouchLayout {
  const screenWidth = finiteDimension(width);
  const screenHeight = finiteDimension(height);
  const minDimension = Math.min(screenWidth, screenHeight);

  const padLeft = Math.min(16, screenWidth);
  const padBottom = Math.min(16, screenHeight);
  const padWidth = Math.min(screenWidth * 0.35, Math.max(0, screenWidth - padLeft));
  const padHeight = Math.min(screenHeight * 0.45, Math.max(0, screenHeight - padBottom));
  const padTop = Math.max(0, screenHeight - padHeight - padBottom);

  const margin = Math.min(16, screenWidth / 2, screenHeight / 2);
  const gap = Math.min(10, minDimension * 0.025);
  const desiredRadius = Math.max(36, minDimension * 0.11);
  const maxRadiusByWidth = Math.max(0, (screenWidth - 2 * margin - gap) / 4);
  const maxRadiusByHeight = Math.max(0, (screenHeight - 2 * margin - gap) / 4);
  const radius = Math.min(desiredRadius, maxRadiusByWidth, maxRadiusByHeight);

  const gas = {
    cx: screenWidth - margin - radius,
    cy: screenHeight - margin - radius,
    r: radius,
  };
  const brake = {
    cx: gas.cx - 2 * radius - gap,
    cy: gas.cy,
    r: radius,
  };
  const item = {
    cx: gas.cx,
    cy: gas.cy - 2 * radius - gap,
    r: radius,
  };

  return {
    pad: { left: padLeft, top: padTop, width: padWidth, height: padHeight },
    gas,
    brake,
    item,
  };
}