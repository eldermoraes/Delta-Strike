# Delta Strike 3D Implementation Plan

**Goal:** Deliver a playable, polished three-sector arcade flight game in the requested subfolder.

**Architecture:** Independent deterministic simulation and Three.js renderer, with browser input, sound and UI adapters. Blender-generated GLBs provide original assets.

**Tech Stack:** TypeScript, Three.js, Vite, Vitest, Playwright, Blender.

**Spec:** [design.md](design.md), approved in conversation.

## Global constraints

- Only inspect game reference code in the parent project.
- All new files remain in Delta-Strike-3d, retaining the original game.
- Local playable deliverable; no remote publishing or git integration.

## Task 1 — Simulation

- [x] Write tests in tests/core.test.ts for swept segment collision, seeded world, flight bounds, checkpoints, fuel and fixed-step time.
- [x] Run `npm test`, observe missing implementation failures.
- [x] Implement src/core/math.ts, world.ts, simulation.ts, clock.ts. Simulation exposes start(), step(dt,input), pause(), resume(), retry() and typed player/entities/events state; rendering never owns gameplay.
- [x] Run unit tests and resolve failures.

## Task 2 — Original models

- [x] Create tools/build_assets.py, art/delta-strike.blend and public/models/*.glb using Blender.
- [x] Inspect model dimensions and verify exported models load. Aircraft forward is -Z, up +Y.

## Task 3 — Playable presentation

- [x] Build src/render/scene.ts and terrain.ts with bounded section streaming, chase camera, visual effects and model loading.
- [x] Build src/platform/input.ts and audio.ts with keyboard, touch, controller and safe lifecycle handling.
- [x] Build index.html, src/main.ts, src/style.css with launch, briefing, flight HUD, settings, pause and results.
- [x] Run `npm run build`; resolve type and integration errors.

## Task 4 — Verify and deliver

- [x] Add and run browser tests against local Vite server; inspect screenshots at desktop and mobile sizes.
- [x] Review simulation and integration for gameplay-breaking defects and fix with regression tests.
- [x] Write README with controls, setup, architecture and verified limitations.
- [x] Leave local server running and open the playable game for the user.

## Delivery record

Initial playable build completed and browser-verified. The user then approved the first version and requested a longer River Raid-inspired expedition. See expedition-design.md for the implemented v1.1 scope, which replaces the initial three-sector ending.
