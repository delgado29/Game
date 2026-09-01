# Leña 🪓

A lumberjack incremental for the iPad. Tap the tree to chop it, sell the wood, buy a better axe, hire a crew that chops while you're away, build a sawmill that turns logs into planks, and when the numbers get big, plant a new forest for acorns that boost everything forever.

Like its sibling Cafetal, everything is procedural: every tree species, character, building and icon is pixel art drawn in code at startup, and the campfire-folk loop, wind, birds and chop/crack/thud effects are synthesised live with WebAudio. No assets, no dependencies, one HTML file when bundled.

## Loop

- **Chop**: tap anywhere in the scene. Whetstones add critical hits (×4).
- **Sell**: the green button turns your logs and planks into coins. Market stalls raise the price; the merchant wagon sells automatically.
- **Crew**: lumberjacks chop on their own, day and night, and keep going while the app is closed (up to 8 hours of offline progress).
- **Trees**: pine → birch → oak → maple → redwood → ancient oak → ironwood → world tree. Each is tougher and its logs worth more.
- **Forest**: once you've earned 1M coins in a forest, plant a new one. Acorns give +10% each to damage and income, permanently. Achievements add +2% each.

## Files

```
index.html          entry
src/00_util.js      math, RNG, number formatting (K/M/B/T/Qa…), strings EN/ES
src/10_art.js       procedural sprites: trees per species, crew, mill, wagon, icons, backdrops
src/20_audio.js     WebAudio loop + ambience + effects
src/30_game.js      balance, upgrades, tree lifecycle, prestige, achievements, offline sim, save
src/40_ui.js        HUD, tabbed panel, buy ×1/×10/max, modals
src/50_main.js      scene rendering, day/night, particles, input, loop
icons.mjs           PNG icon generator (shared encoder in ../scripts/png.mjs)
smoke.mjs           headless Playwright play-through
```
