# Delta Strike 3D — approved design

Rebuild the original as a third-person browser arcade flight game. All reference code stays within the parent Delta-Strike directory; all new files stay within Delta-Strike-3d.

## Play

Three connected river-canyon sectors. Bank to turn, pitch to climb or dive, adjust throttle, boost, fire cannons and launch limited homing missiles. Low passes through marked fuel zones replenish fuel. Destroy each sector's bridge control target to unlock the next checkpoint. Three aircraft, score and a final mission results screen. Keyboard, controller and touch input. An assisted flight envelope keeps beginners moving downriver, but aircraft position and aiming use all three dimensions.

## Presentation

Sunlit sandstone, turquoise river, muted vegetation, a silver delta fighter with orange markings. Original Blender models saved with a repeatable export script. Behind-above chase camera, readable aiming reticle and flight instruments. Title screen uses a live cinematic flyover. Reduced camera motion and quality settings.

## Architecture and reliability

TypeScript simulation without rendering or browser dependencies. 60 Hz bounded fixed-step accumulator. Stable entity IDs, seeded world generation, swept 3D collision, explicit title/playing/paused/crashed/won/lost states. Checkpoint restarts reset transient entities. Renderer consumes simulation state, bounds visible world sections, reuses geometry and materials, and disposes resources. Input clears on focus loss; browser blur pauses. Storage and audio failures degrade safely.

## Validation

Unit tests for collision tunneling, deterministic generation, altitude/throttle limits, fuel, checkpoint recovery and frame-rate independence. Browser checks for load, launch, controls, pause/resume, restart, mobile layout and browser errors. Production build plus screenshot inspection. No deployment requested.
