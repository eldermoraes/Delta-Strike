# DELTA STRIKE

A vertical-scrolling river shooter in the Atari 2600 style — playable in the
browser and on your phone, 100% offline. An original tribute to the classic
1982 *river shooter* genre: every bit of the art, sound and code in this project
was built from scratch — no assets were extracted from ROMs or third parties.

![Icon](icons/icon-192.png)

## ▶ Play online

**https://eldermoraes.github.io/Delta-Strike/** — nothing to install, nothing to
download. (This is also the link in the repository's **About** section.)

After the first load the game runs completely offline and can be installed as a
PWA (portrait, full screen) via your browser's *Install* / *Add to Home Screen*.

## Controls

### Keyboard

| Key | Action |
|---|---|
| ← → | steer |
| ↑ ↓ | speed up / brake |
| Space | fire (hold for autofire) |
| Enter | start |
| P | pause |
| M | mute |

### Touch (phone)

- **Left zone (60%)**: drag to steer; drag up/down to speed up/brake.
- **Right zone (40%)**: tap to fire.
- **Top corners** (during play): left = mute, right = pause.
- Tap anywhere to start.

## Rules

- Destroy ships (30), helicopters (60), fuel depots (80), jets (100) and
  bridges (500 — checkpoint).
- Refuel by flying over the `FUEL` depots (destroying one scores points, but
  removes the fuel...). Empty tank = you go down.
- Colliding with a bank, island, enemy or bridge costs you 1 plane. You start
  with 3 in reserve and earn 1 every 10,000 points (max 9).
- The river is the same in every game (fixed seed, like the classic) and gets
  narrower and more crowded with each section.
- They say that at 1,000,000 points the scoreboard... changes. `!!!!!!`

## Run locally

Serve the folder over HTTP (any static server) and open it in a browser:

```bash
python3 -m http.server 8321
# http://localhost:8321
```

> The service worker requires a secure context (`localhost` or HTTPS). No build
> step, no dependencies, no frameworks — it's just plain files.

## Project structure

```
index.html            page + module load order
style.css             centering, letterbox, pixel-perfect
manifest.webmanifest  PWA
sw.js                 cache-first offline (delta-strike-vN)
js/constants.js       DS.C — every constant + palette (source of truth)
js/sprites.js         DS.Sprites — pixel-maps and fonts, pre-render + flip
js/audio.js           DS.Audio — 100% synthesized SFX (Web Audio, TIA-style)
js/river.js           DS.River — deterministic per-section river generation
js/entities.js        DS.Entities — player, enemies, missiles, collisions
js/game.js            DS.Game — 60 Hz loop, states, HUD, input, scaling
tools/make_icons.py   PNG icon generator (stdlib only)
docs/plan/            full specs (design, visual, audio, architecture,
                      interface contracts)
```

`?seed=N` in the URL generates an alternative river (debug only).

## Original assets

All of the art, sound and code are 100% original. Nothing was extracted from
ROMs, and the 1982 game's trademark is not used — the product name is
DELTA STRIKE.

## License

Apache 2.0 — see [LICENSE](LICENSE).

## Shared 2D / 3D entrance

The local root page now offers a choice of editions. The original game is at `classic.html`; its gameplay code is unchanged. Build the 3D edition before using the shared entrance:

```sh
cd Delta-Strike-3d
npm install
npm run build
npm run preview -- --port 4173
```

Open `http://127.0.0.1:4173/` to choose either game. The complete deployable site is in `Delta-Strike-3d/dist/`. Publishing this new entrance requires deploying that complete build; local changes do not update the live site automatically.
