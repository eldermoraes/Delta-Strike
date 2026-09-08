# Delta Strike 3D v1.1 — long river expedition

Requested after the first playable version: substantially longer play with a distant end, real river forks, fast aircraft crossing transversely, original gameplay details, and inverted vertical arrow controls.

## Implemented direction

- Replace the three-sector win condition with a score maximum of 1,000,000 and the classic six exclamation marks. Sector numbers continue; regions cycle and difficulty approaches a bounded maximum.
- Keep 2,400 m between bridges. Generate only the active encounter list and 13 terrain chunks, regardless of journey length.
- Introduce long tapered islands and two navigable branches, with occasional double-island sections and narrowed reaches. Rendering, ground collision and safe spawn placement share the same island function.
- Crossing fighters activate ahead of the player, travel at 140–205 m/s transversely and retire beyond the river. Hide pending aircraft and warn about approach direction. Relative swept collisions account for both objects moving.
- Boats patrol their channel, helicopters hover/patrol, and fuel is placed on usable branches. Fuel and damage persist through bridge transitions; each bridge supplies two missiles. A replacement aircraft gets a fresh tank and hull.
- Award one aircraft per 10,000 points, cap nine, and keep awarded thresholds monotonic through failed attempts to prevent farming.
- Save checkpoint resources, seed, score, kills, lives and life-award threshold locally. Validate saves before restore. Refreshing resumes from the saved bridge through an explicit Continue button; starting a new run replaces it.
- Up arrow dives; down arrow climbs. WASD, touch and controller retain their existing mappings.

## Verification

Tests cover fork geometry and seams, spawn clearance, capped late difficulty, continued progression after bridge three, million-point finish, extra-life farming, crossing-jet speed, checkpoint round trips and corruption, persistent fuel, and ordinary-control navigation through the first three forks/bridges. Browser tests cover inverted arrows, reload/continue, and bounded rendering hundreds of bridges upstream.

The previous design.md records the initial version. This document supersedes its three-sector mission length and full resupply at every checkpoint.

## Audio revision — 2026-09-08

Desktop and smartphone playtesting found audio too quiet. Increase master gain from 0.22 to 1 (+13 dB before compression), retain mute behavior, and use gentle peak compression for overlapping effects. Increase engine low-pass cutoff to 500 Hz, cannon pitch to 320–90 Hz, and explosion cutoff to 1500 Hz for audibility on smaller speakers. Validate rendered audio levels and simultaneous effects; physical-device loudness still needs user playtesting.

## Combat and touch revision — 2026-09-08

Enemy shots predict the interception point from current aircraft velocity and then travel straight, allowing evasive maneuvers. Collision sweeps use relative aircraft/projectile motion. Touch stick forward means dive, backward means climb. Briefing uses coarse-pointer detection to show touch instructions; desktop retains keyboard controls.

## Touch hold revision — 2026-09-08

Disable text selection and iOS touch callouts on buttons and the flight HUD. Cancel context-menu and selection-start events on joystick and action controls; retain pointer capture, release/cancellation behavior, multitouch and scrollable instructions.
