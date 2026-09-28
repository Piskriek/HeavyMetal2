import type { GameEngine } from './engine';

/**
 * Minimal debug controller: only [P] pause remains.
 * The old teleport system, build-mode panel, and [B] button have been removed.
 */
export class GameDebugController {
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(private engine: GameEngine) {
    this.attachWindowApi();
    this.attachKeyboard();
  }

  captureCanvas(): string {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    return canvas ? canvas.toDataURL('image/png') : '';
  }

  private attachWindowApi() {
    (window as any).__gameDebug = {
      captureCanvas: () => this.captureCanvas(),
    };
    (window as any).__gameEngine = this.engine;
  }

  private attachKeyboard() {
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        this.engine.togglePause();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  destroy() {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }
    delete (window as any).__gameDebug;
    delete (window as any).__gameEngine;
    // Clean up any stale debug panel from previous sessions
    const stalePanel = document.getElementById('hm2-debug-panel');
    if (stalePanel) stalePanel.remove();
  }
}
