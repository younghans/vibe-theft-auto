import { Game } from './game/Game.js';

const DEBUG_LOGS_ENABLED = false;

if (!DEBUG_LOGS_ENABLED) {
  console.info = () => {};
  console.log = () => {};
}

window.addEventListener('error', (event) => {
  console.error('[Boot] Unhandled window error.', event.error ?? event.message ?? event);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Boot] Unhandled promise rejection.', event.reason ?? event);
});

window.addEventListener('contextmenu', (event) => {
  event.preventDefault();
}, { capture: true });

function reportWavedashLoadProgress(progress) {
  try {
    globalThis.Wavedash?.updateLoadProgressZeroToOne?.(progress);
  } catch (error) {
    console.warn('[Wavedash] Load progress report failed.', error);
  }
}

function initializeWavedash() {
  try {
    globalThis.Wavedash?.init?.();
  } catch (error) {
    console.warn('[Wavedash] SDK initialization failed.', error);
  }
}

const root = document.querySelector('#app');
console.info('[Boot] Vibe Theft Auto booting.', {
  href: window.location.href,
  rootFound: Boolean(root)
});

const game = new Game(root);

reportWavedashLoadProgress(0);

game.start()
  .then(() => {
    reportWavedashLoadProgress(1);
    initializeWavedash();
  })
  .catch((error) => {
    console.error('[Boot] Game startup failed.', error);
  });
