# Harpoon Lagoon

A bright, full-arcade, two-player co-op harpoon game for kids (made for ages 4 and 7). PC, three.js.

Look down into a sunny lagoon, aim your toy harpoon launcher, and catch as many fish as you can
before the sun sets. Both players fill one team score. No reading needed, no losing, no blood:
caught fish get wrapped in a bubble and pop into points.

## Play

- **In a browser:** `npm install`, then `npm run dev` and open the printed localhost URL.
- **As a Windows app:** `npm run dist:win` builds `release/HarpoonLagoon-<version>-portable.exe`
  (double-click to play, nothing to install). GitHub Actions also builds it on every push (see the
  "Build Windows app" workflow run, under Artifacts).
  `npm run app` runs the desktop version straight from the source.

### Controls

| | Player 1 (blue, left) | Player 2 (orange, right) |
|---|---|---|
| Aim | Mouse | ← → or A / D |
| Fire | Click (hold to shoot further) | Space / Enter / ↑ (hold to shoot further) |
| Gamepads | Gamepad 1 when two are plugged in | The only gamepad, or gamepad 2 |

With a gamepad, push either stick toward where you want to shoot and press any face button or the right trigger.
Esc or the gamepad Start button pauses. F11 toggles full screen in the desktop app.

### Menu

- Player 2 joins by pressing fire.
- Each player picks a fish size: **small fish = lots of help** (the harpoon curves toward fish, bigger hit area,
  faster wind-back, stronger reel-in), **medium = a little help**, **big fish = no help**.
- The choice is remembered on this computer.

## A round

- 90 seconds, shown as the sun crossing the sky. The lagoon turns golden toward sunset.
- Fish swim in from the sides and leave again. Minnows swim in schools; pufferfish puff up and need two hits.
- 1 in 20 fish is **golden** (5× points) and 1 in 50 **rainbow** (10×). Both sparkle and swim faster.
- Catching fish in a row without missing builds a combo (up to 2× points).
- **Frenzy waves** at 0:22 and 1:06: a huge school races through.
- **Boss shark** at 0:40: hit it 6 times (8 with two players), then everyone taps fire as fast as
  they can to reel it in together.
- The end screen shows every fish each player caught, 1 to 5 stars, and the local high scores.

## Code map

- `src/game/Game.js`: game states (menu, playing, paused, results), round director, scoring, boss reel-in.
- `src/game/Launcher.js`: aiming, charging, the harpoon on its rope, hit tests.
- `src/game/assist.js`: aim-assist, scoring and star maths (unit tested).
- `src/game/input.js`: mouse, keyboard and gamepads mapped to two players.
- `src/game/ui.js`, `icons.js`, `src/style.css`: picture-first HUD and menus.
- `src/game/audio.js`: all sound and music synthesised with WebAudio (no audio files).
- `src/game/effects.js`: splashes, sparkles, catch bubbles, floating points.
- `src/fish/`: the procedural fish generator (see below).
- `src/world/lagoon.js`: sand, light ripples, coral, seaweed, bubbles, sunset.
- `electron/main.cjs`: the desktop wrapper.

### How the fish are made

- `src/fish/species.js`: one recipe per species (body proportions, fins, tail type, palettes, patterns, behaviour).
  Ranges are rolled per fish, so every spawn looks a bit different.
- `src/fish/spec.js`: recipe + seed → a plain-data fish spec (deterministic, tested).
- `src/fish/geometry.js`: builds the body (lofted cross-sections), fins, eyes and mouth from a spec.
- `src/fish/texture.js`: paints the body pattern (countershading, bands, stripes, saddle, spots).
- `src/fish/material.js`: cel-shaded materials with a GPU swim wave, outline, and golden/rainbow effects.
- `src/fish/Fish.js`: wander/school steering, darting, puffing, leaving, getting hit.

To add a species, add a recipe to `species.js` and a weight to `ROUND_MIX` in `Game.js`.

## Developer options

Add `?dev` to the URL, then during a round: `B` brings the boss now, `K` leaves the boss on its last hit,
`T` skips to 5 seconds before sunset.

## Tests

`npm test` covers the fish generator (deterministic specs, valid meshes for every species) and the
aim-assist and scoring maths.

## Credits

- The swim-wave approach is inspired by the CC0 fish kit at https://cda-social.github.io/fish/ (by @nachat_dayo).
  No assets from it are included.
- Font: Fredoka (SIL Open Font License), bundled via `@fontsource/fredoka`.
