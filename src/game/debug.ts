import type { GameEngine } from './engine';

export interface DebugSection {
  id: string;
  name: string;
  key: string;
  x: number;
}

export const DEBUG_SECTIONS: DebugSection[] = [
  { id: 'alpine', name: '1: Alpine Downhill', key: '1', x: 2000 },
  { id: 'lip', name: '2: Canyon Lip (90° Swing)', key: '2', x: 24000 },
  { id: 'waterfall', name: '3: Waterfall Drop', key: '3', x: 28000 },
  { id: 'cavern', name: '4: Cavern Maw', key: '4', x: 48000 },
  { id: 'mine', name: '5: Mine Coaster & Lava', key: '5', x: 54000 },
  { id: 'breakthrough', name: '6: Breakthrough', key: '6', x: 68400 },
  { id: 'stadium', name: '7: Stadium Finish', key: '7', x: 70500 },
];

export class GameDebugController {
  private panel: HTMLDivElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(private engine: GameEngine) {
    this.attachWindowApi();
    this.attachKeyboard();
    this.createDebugPanel();
  }

  teleport(targetX: number) {
    this.engine.teleport(targetX);
  }

  teleportSection(id: string) {
    const sec = DEBUG_SECTIONS.find((s) => s.id === id);
    if (sec) this.teleport(sec.x);
  }

  captureCanvas(): string {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    return canvas ? canvas.toDataURL('image/png') : '';
  }

  private attachWindowApi() {
    (window as any).__gameDebug = {
      teleport: (x: number) => this.teleport(x),
      teleportSection: (id: string) => this.teleportSection(id),
      captureCanvas: () => this.captureCanvas(),
      sections: DEBUG_SECTIONS,
    };
    (window as any).__gameEngine = this.engine;
  }

  private attachKeyboard() {
    this.keyHandler = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const sec = DEBUG_SECTIONS.find((s) => s.key === e.key);
      if (sec) {
        e.preventDefault();
        this.teleport(sec.x);
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        this.engine.togglePause();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private createDebugPanel() {
    // Check if panel already exists
    if (document.getElementById('hm2-debug-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'hm2-debug-panel';
    panel.style.cssText = `
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 999999;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      background: rgba(14, 10, 8, 0.88);
      border: 1px solid rgba(255, 170, 51, 0.4);
      border-radius: 8px;
      padding: 6px 10px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      font-family: monospace;
      font-size: 11px;
      color: #ffaa33;
    `;

    const label = document.createElement('span');
    label.innerText = 'STAGE JUMP:';
    label.style.cssText = 'align-self: center; font-weight: bold; margin-right: 4px; color: #ffd700;';
    panel.appendChild(label);

    for (const sec of DEBUG_SECTIONS) {
      const btn = document.createElement('button');
      btn.innerText = `[${sec.key}] ${sec.name.split(':')[1].trim()}`;
      btn.style.cssText = `
        background: #2a1f14;
        color: #ffc266;
        border: 1px solid #7c5a30;
        border-radius: 4px;
        padding: 3px 7px;
        cursor: pointer;
        font-family: inherit;
        font-size: 11px;
        transition: background 0.15s;
      `;
      btn.onmouseenter = () => { btn.style.background = '#4a3520'; };
      btn.onmouseleave = () => { btn.style.background = '#2a1f14'; };
      btn.onclick = () => this.teleport(sec.x);
      panel.appendChild(btn);
    }

    document.body.appendChild(panel);
    this.panel = panel;
  }

  destroy() {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    if (this.panel) this.panel.remove();
    delete (window as any).__gameDebug;
  }
}
