import {NoirGameEngine} from './engine/GameEngine';

let engine: NoirGameEngine | null = null;

document.addEventListener('DOMContentLoaded', () => {
  const mount = document.getElementById('game-canvas-mount');
  const uiRoot = document.getElementById('game-ui-root');
  if (!mount || !uiRoot) return;
  engine = new NoirGameEngine(mount, uiRoot);
});

window.addEventListener('beforeunload', () => {
  engine?.dispose();
  engine = null;
});
