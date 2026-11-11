# Harpoon Lagoon

A bright, full-arcade, two-player co-op harpoon game for kids (PC, three.js).

## Run it

```bash
npm install
npm run dev      # open the printed localhost URL
npm test         # generator unit tests
npm run build    # static build in dist/
```

## Current state: step 1, fish generator test

A lagoon full of procedurally generated cartoon fish, for reviewing the look before any gameplay.

Developer keys: `R` new lagoon · `1`-`5` add minnows / clownfish / tang / angelfish / pufferfish ·
`B` boss shark · `G` golden fish · `N` rainbow fish · `H` hide the panel.
URL options: `?seed=123` for a repeatable set of fish, `?boss` to start with the shark.

## How the fish are made

- `src/fish/species.js`: one recipe per species (body proportions, fins, tail type, palettes, patterns, behaviour).
  Ranges are rolled per fish, so every spawn looks a bit different.
- `src/fish/spec.js`: recipe + seed → a plain-data fish spec (deterministic, tested).
- `src/fish/geometry.js`: builds the body (lofted cross-sections), fins, eyes and mouth from a spec.
- `src/fish/texture.js`: paints the body pattern (countershading, bands, stripes, saddle, spots).
- `src/fish/material.js`: cel-shaded materials with a GPU swim wave, outline, and golden/rainbow effects.
- `src/fish/Fish.js`: wander/school steering, darting, puffing, blob shadow.

The swim approach is inspired by the CC0 fish kit at https://cda-social.github.io/fish/ (credit: @nachat_dayo).
No assets from it are included.
