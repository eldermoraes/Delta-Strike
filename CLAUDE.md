# CLAUDE.md — Delta Strike

Atari 2600-style browser game (vertical-scrolling river shooter, an original
tribute to the classic 1982 genre), in vanilla JS + Canvas 2D, a 100% offline
PWA. No build, no dependencies, no frameworks. Live at
https://eldermoraes.github.io/Delta-Strike/ (GitHub Pages; the repo may stay
private — Pro account).

## This project's process (Elder's request — always keep)

- **Fable plans and monitors; Opus implements.** Every design or value change
  goes through the specs in `docs/plan/` first (the docs are LAW), then an Opus
  agent transcribes/implements, and the result is validated in the browser
  before the commit.
- `docs/plan/interfaces.md` is the final contract — it wins over any other doc.
  `js/constants.js` is a VERBATIM transcription of that doc's §2 block: edit the
  doc first, never the file directly.
- Source specs: `game-design.md`, `visual-spec.md`, `audio-spec.md`,
  `architecture.md`. Record revisions in the docs with a dated note (the pattern
  already in use: "> Revision YYYY-MM-DD: ...").

## Code rules

- Classic scripts in an IIFE with `'use strict'`; single namespace `window.DS`.
- Load order: `constants → sprites → audio → river → entities → game`.
- Forbidden: `Math.random()` (use `DS.U.mulberry32`), `console.log`,
  `setTimeout`/`setInterval` for game logic, fetch/CDN/network, ES modules.
- Deterministic river: fixed seed `DS.C.DEFAULT_SEED`; `?seed=N` is debug only.
- Sprites: pixel-maps follow `visual-spec.md` §7 verbatim; colors only via
  `DS.C.PALETTE`; the dimensions in the `interfaces.md` §4.2 table are a contract
  (hitboxes depend on them).
- 100% original assets — never extract anything from ROMs or use the 1982 game's
  trademark; the product name is DELTA STRIKE.

## Release (IMPORTANT — easy to forget)

1. **Bump the cache** in `sw.js` (`delta-strike-vN` → `vN+1`) on every release
   that changes a cached file. The precache uses `cache: 'reload'` (immune to the
   Pages `max-age=600`).
2. Commit + push to `main` → Pages builds on its own (~30 s).
3. Verify in production by the SERVED CONTENT (`curl` the changed file) — the
   builds API status may answer for the previous build.
4. The player gets the update on the 2nd reload (cache-first + skipWaiting); on
   the installed PWA: close and reopen the app twice.

## Run and test

- Local: `python3 -m http.server 8321` at the root (the SW requires
  localhost/https).
- Syntax: `node --check js/*.js`. Test harnesses live OUTSIDE the repo.
- QA in Chrome on this machine: with the screen locked, rAF freezes and timers
  are throttled — the tricks that work (pump via AudioContext, synthetic events,
  audio measurement with OfflineAudioContext) are in Claude's persistent memory
  (`delta-strike-browser-qa-tricks`).

## Calibrations validated with Elder (do not regress without a request)

- **Touch** (playtest 2026-07-10, approved): `TOUCH_DEADZONE_X 28`,
  `TOUCH_STEER_RELEASE_X 14` (hysteresis), `TOUCH_THROTTLE_DY 36`.
- **Explosions** (2026-07-11, calibrated by measurement): small with a lowpass
  4500→400 Hz and peak 0.62; big with noise 2400→200 Hz and peak 0.65 (the 60 Hz
  body layer intact). Acceptance criterion in `audio-spec.md` §6/§7: RMS of the
  120 ms window, after a double 700 Hz highpass (a phone-speaker proxy), ≥ 1.0×
  (small) / 1.2× (big) the shot's RMS.
