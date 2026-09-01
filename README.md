# Game

Small games built for the iPad, each one self-contained: no image or audio files, no dependencies. Every sprite is procedural pixel art drawn at startup and every sound is synthesised live with WebAudio. Each game bundles to a single HTML file.

| Game | What it is | Folder |
| --- | --- | --- |
| **Cafetal** ☕ | A cozy coffee-farm sim. Grow, dry, roast, brew, serve villagers at a roadside café. | [`cafetal/`](cafetal/) |
| **Leña** 🪓 | A lumberjack incremental. Tap the tree, sell the wood, hire a crew, build a mill, prestige into new forests. | [`lena/`](lena/) |

## Play on the iPad

**GitHub Pages (permanent URLs).** Enable Pages once (*Settings → Pages → Source: GitHub Actions*). The workflow builds and deploys on every push to `main`. Open `/cafetal/` or `/lena/` in Safari, then *Share → Add to Home Screen* for fullscreen offline play. The root page is a launcher for both.

**Single file.** `node scripts/build.mjs` writes `<game>/dist/<game>.html`; open that anywhere.

**Local.** Serve the repo folder with any static server (`npx http-server .`) or open a game's `index.html` directly.

## Development

No install step.

```
node scripts/build.mjs            # bundle every game into <game>/dist/
node cafetal/icons.mjs            # regenerate a game's PNG icons (hand-rolled encoder)
node lena/icons.mjs
node cafetal/smoke.mjs            # headless Playwright play-through with screenshots
node lena/smoke.mjs
```
