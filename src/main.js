import { Game } from './game/Game.js';

const root = document.querySelector('#app');
const game = new Game(root);

game.start().catch((error) => {
  console.error(error);
});
