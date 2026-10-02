export type HudKind =
  | 'speed'
  | 'lap'
  | 'position'
  | 'time'
  | 'item'
  | 'minimap'
  | 'message'
  | 'boost';

export type Anchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface HudElement {
  id: string;
  kind: HudKind;
  anchor: Anchor;
  offsetX: number;
  offsetY: number;
  scale: number; /* 0.5..2 */
  visible: boolean;
  opacity: number; /* 0..1 */
}

export interface HudLayout {
  id: string;
  name: string;
  elements: HudElement[];
}
