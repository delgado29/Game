# Cafetal ☕

A cozy coffee-farm game for iPad (and any modern browser). Inherit a small mountain farm, grow coffee, dry and roast it, brew drinks for the villagers who wander past your roadside café, and slowly build the place up. No fail state, no punishing timers. Rain, fireflies, lo-fi music.

Everything you see and hear is generated in code at startup: every tile, character, crop, building and icon is procedural pixel art, and the soundtrack, ambience and sound effects are synthesised live with WebAudio. There are no image or audio files and no dependencies — the whole game bundles into one HTML file.

## Play it on the iPad

**Option A — GitHub Pages (permanent URL).** Enable Pages once in the repo settings (*Settings → Pages → Source: GitHub Actions*). The workflow in `.github/workflows/pages.yml` builds and deploys on every push to `main`. Open the URL in Safari, tap *Share → Add to Home Screen*, and launch it from the icon for fullscreen, offline play.

**Option B — single file.** Run `node scripts/build.mjs` and open `dist/cafetal.html` anywhere: AirDrop it, host it, or upload it to any static host.

**Option C — local dev.** Serve the folder (`npx http-server .` or any static server) and open `index.html`. Loading the file directly with `file://` also works.

## How to play

- **Tap the ground** to walk. Tap a thing to walk over and use it.
- **Hotbar** (bottom): Hand · Hoe · Water · four seed bags · Bag.
  - Hoe tilled soil inside the fenced field, plant a seed, water it each morning (rain waters for you). Harvest with the hand when ripe.
  - Coffee trees take 6 days to fruit and then re-fruit every 3 days. Tomatoes regrow, corn and sunflowers are single harvests. Annual crops wither at the first winter frost; coffee trees rest.
- **Coffee processing**: cherries → **pulper** (by the shed) → **drying patio** (2 sunny days; rain pauses drying unless you buy a roof) → **roaster** (in the shed: hold to roast, release inside the target window for a perfect batch).
- **Café**: customers queue at the counter on the road between 8am and 6pm. Tap one (or the counter) to see orders. Each drink needs specific beans and pantry items; buy milk, panela, cinnamon and cocoa from Rosa's cart. Serving grows reputation, which unlocks recipes and more visitors.
- **Rosa's cart** sells seeds, pantry goods and upgrades (sprinkler, patio roof, bigger patio, drum roaster, hens, fishing rod, a cat, fairy lights, a bench) and buys your produce.
- **Sleep** by tapping the farmhouse door. Days last about six real minutes; at midnight you nod off on the porch.
- **Forage** wild mint and flowers along the forest edge; hens leave eggs in the yard; fish the pond once you own a rod.
- Letters from Abuela arrive in the mailbox as your reputation grows.
- Settings (gear icon): English / Español, music, sound, new game. Progress autosaves in the browser.

## Project layout

```
index.html                 entry (loads src/*.js in order)
src/00_util.js             math, seeded RNG, colours, event bus
src/01_i18n.js             English / Spanish strings, NPC dialogue
src/10_sprites.js          procedural pixel-art generator (tiles, characters, crops, buildings, icons)
src/20_audio.js            WebAudio engine: lo-fi loop, ambience, sound effects
src/30_world.js            map, ground, crops, objects, collision, time, weather, seasons
src/40_entities.js         player, customers, hens, cat, A* pathfinding
src/50_stations.js         pulper, patio, roaster mini-game, recipes, fishing
src/60_economy.js          items, shop, customers schedule, reputation, letters, tutorial
src/70_ui.js               touch input, HUD, hotbar, modals
src/80_save.js             state + localStorage save/load
src/90_main.js             game loop, camera, rendering, lighting, tap-to-act
scripts/build.mjs          bundles everything into dist/cafetal.html
scripts/icons.mjs          generates PNG icons (hand-rolled PNG encoder, no deps)
sw.js, manifest.webmanifest  PWA bits for Add-to-Home-Screen + offline
```

## Development

No install step. `node scripts/icons.mjs` regenerates icons; `node scripts/build.mjs` writes the single-file builds to `dist/`. The smoke test in `scripts/smoke.mjs` drives a full in-game day headlessly with Playwright's bundled Chromium.
