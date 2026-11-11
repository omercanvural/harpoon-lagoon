import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-700.css';
import './style.css';
import { Game } from './game/Game.js';

const params = new URLSearchParams(location.search);
try {
  const game = new Game(document.getElementById('app'), { dev: params.has('dev') });
  // Handy for debugging in the console.
  window.harpoonLagoon = game;
} catch (err) {
  // Most likely no WebGL (very old graphics driver, or graphics acceleration turned off).
  console.error(err);
  document.getElementById('ui').innerHTML =
    '<div class="screen"><h1 class="logo"><span class="l1">Harpoon</span><span class="l2">Lagoon</span></h1>' +
    '<p class="grownups">This computer could not start 3D graphics (WebGL). Updating the graphics driver, or turning on ' +
    'hardware acceleration in the browser settings, usually fixes it.</p></div>';
}
