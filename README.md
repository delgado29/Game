# SIGNAL 📡

A first-person tower-climbing game. You are a freelance communications technician in a world where the network has partially collapsed. Drive out to an abandoned tower, choose what to carry, climb it hand over hand, clip your lanyard as you go, repair the transmitter at the top, watch the valley light up below you, and then get back down before the storm arrives.

The fantasy is simple: being a tiny human hundreds of metres above the ground, trusting a handful of steel and rope.

Built with Three.js and TypeScript. No models, textures or audio files: every tower, tree, van and glove is generated in code, and every sound (wind, rain, creaking steel, carabiner clicks, thunder, the radio) is synthesised live with WebAudio. Runs in a browser on desktop and iPad.

## Play

**GitHub Pages.** Enable Pages once (*Settings → Pages → Source: GitHub Actions*). Every push to `main` builds and deploys. On the iPad, open the page in Safari and *Share → Add to Home Screen* for fullscreen play.

**Locally.**

```
npm install
npm run dev        # http://localhost:8000, rebuilds on save
npm run build      # static site in dist/
```

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Look | mouse | drag anywhere |
| Walk (ground, platforms) | WASD | left stick |
| Left hand grip | hold left mouse button or Q | hold **L** |
| Right hand grip | hold right mouse button or E | hold **R** |
| Clip lanyard to nearest anchor | Space | **CLIP** |
| Grab ladder · step onto platform · repair (hold) · enter van | F | **ACT** |
| Rest and look around (on a platform) | V | **REST** |
| Take a photo (needs the camera) | C | **PHOTO** |
| Pause | Esc | ≡ |

## How the climb works

- **Hand over hand.** Each hand grips the rung nearest to where you are looking. Release one hand, look up, grab higher, then bring the other hand up. Let go with both hands and you fall.
- **Stay clipped.** Anchors sit along the ladder every three metres. Clip to one, climb the length of your lanyard, clip to the next. A fall while clipped jerks you to a stop on the rope and costs stamina. A fall while unclipped sends you back to the last platform.
- **Stamina.** Hanging on drains it, faster with a heavy pack, in wind, with one hand, or on wet steel without gloves. Platforms and the ground restore it. At zero your hands start slipping.
- **Weather.** Gusts push you sideways: hold on with both hands or get blown off. Rain makes grips tire faster. Storms bring lightning, and a close strike knocks out the radio.
- **Hazards.** Sabotaged towers have cut safety cables (long unclipped stretches), sawn rungs that snap when grabbed, and live junction boxes that arc on a cycle. A scout drone marks them in advance.
- **Repair.** At the top, hold F through the steps: open the panel, replace the fuse (or install the battery pack), reconnect the feed, tune the carrier. Then the town below lights up, one window at a time, and the weather turns.
- **Descent.** Getting down is half the job. Reach the van to finish and get paid.

## Gear and weight

The pack starts at 8 kg and can be upgraded to 10. Everything has a weight and an effect: gloves, a longer lanyard, a weather radio that warns of gusts earlier, a signal analyzer, a camera, a scout drone, water and gels, the heavy battery pack some towers need, a headlamp for night work, and a cable grab that rides the safety cable so you never re-clip while the cable is intact. Several items upgrade through three levels. Higher ranks unlock more of the shop.

## Reasons to keep climbing

- **Career.** Every job pays XP: new height on a tower, the restoration itself, clean climbs, contracts, finds, medals. Five ranks, from Apprentice to Network chief, unlock gear and contract types.
- **Medals.** Each tower has four: Restored, No falls, Under par, All found.
- **Contracts.** A restored tower offers routine maintenance at any time, plus three daily contracts across the network: structural inspections, express call-outs against the clock, heavy hauls, storm work and night shifts.
- **Secrets.** Logbook pages left by the crew that climbed before you, and stray signal fragments that only the analyzer can capture. Together they explain what is shutting the network down.
- **Photo assignments.** Eight shots that pay when you take them: golden hour, the town lit up, a lightning strike, the flock from above, and more.
- **The van** keeps it all: the network map and contract board, your career record and milestones, the logbook and the gallery.

Progress saves on every platform, so a closed tab or a dead battery costs nothing: the van offers to resume the climb.

## Settings

Graphics quality (Auto, Low, Medium, High; Auto also scales resolution to hold the frame rate), grip control (hold to grip, or tap to move a hand), look sensitivity, field of view, reduce motion, left-handed touch layout, language (English, Spanish).

## Towers

| Tower | Height | Notes |
| --- | --- | --- |
| Pinegrove Relay | 90 m | Intact. Mild weather that turns to rain after the repair. |
| Black Ridge Mast | 180 m | Went silent overnight. Cut cables, sawn rungs, live boxes, a storm on the way down, and a signal that should not exist. |

Towers are data: see `src/game/towers.ts` for the spec format (geometry, platforms, cut ranges, hazards, weather script, radio lines, collectibles).

## Development

```
npm run typecheck   # tsc --noEmit
npm run build       # icons + esbuild bundle -> dist/
npm run smoke       # headless Playwright play-through with screenshots in shots/
node scripts/smoke.mjs shots/touch touch   # same, at iPad size with touch controls
```

### Layout

```
index.html              PWA shell
public/                 manifest, service worker, generated icons
scripts/build.mjs       esbuild bundle + static copy (--serve for the dev server)
scripts/icons.mjs       pixel-art app icon -> PNG (scripts/png.mjs is a dependency-free encoder)
scripts/smoke.mjs       Playwright smoke test driven through the window.SIGNAL debug API
src/main.ts             orchestration: jobs, rewards, events, photos, frame loop, debug API
src/core/               input, WebAudio synth, save (v2, migrating), i18n (EN/ES), quality tiers, haptics, math
src/world/              sky, weather, terrain + town, tower generator, props, post-processing
src/climb/climber.ts    first-person climber: grip, lanyard, cable grab, stamina, falls, hazards, hold-to-work, rest
src/game/               towers, gear and perks, career, contracts, photo assignments, radio queue, tutorial, balance
src/ui/                 HUD, menus (van, map, loadout, career, logbook, gallery, settings, debrief), touch, styles
```

`npm run smoke` writes screenshots to `shots/`. Add `?q=low`, `?q=medium` or `?q=high` to the URL to force a graphics tier.
