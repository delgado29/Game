# Hojarasca 🍂

A leaf-blowing yard cleaner for the iPad in the spirit of *Leaf it Alone*, rebuilt in 2D three-quarter view. One property, about 5,600 leaves, and a finite job: clean every zone to 100%.

- **Hands** first: walk over leaves to pick them up, dump the bag in the trash bin for coins.
- **Rake** (drags a swath of leaves along with you) and **leaf blower** (a cone of force; blow heaps into bins or vents) from the shop at the bin.
- **Vents** you buy per zone suck in nearby leaves and sell them for you. Extra bins shorten trips.
- **Zones**: front yard → driveway and side passage → backyard → pool deck (leaves on water only respond to the blower) → greenhouse (narrow aisles) → the cellar, whose hatch only opens once everything else is at least 95% clean. Each finished zone grants a permanent bonus. The cellar holds 200 golden leaves and the ending.
- Controls: left thumb anywhere on the left half to walk, right thumb on the right half to aim and use the tool, a short tap to interact (bins, gates, hatch). WASD/arrows + space/E on a keyboard.
- Wind gusts, dusk lighting with porch and greenhouse lamps, crows, a distant dog, an acoustic loop. EN/ES, autosave with every leaf position, PWA.

Everything is procedural: no image or audio files, no libraries, one HTML file when bundled.

```
src/00_util.js    math, RNG, strings EN/ES, events
src/10_art.js     tiles, house, greenhouse, trees, props, leaf sprites, player + tools, icons
src/20_audio.js   music loop, wind/crows, blower & rake loops, effects
src/30_world.js   map, zones, gates, vents, bins, collision
src/40_leaves.js  leaf simulation in typed arrays (blower cone, rake plough, vents, bins, wind, water)
src/50_game.js    economy, upgrades, zones & bonuses, save/load
src/60_ui.js      twin-stick input, HUD, shop, modals
src/70_main.js    loop, player, camera, rendering, lighting
```
