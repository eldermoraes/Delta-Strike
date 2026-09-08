# Version selection

> Revision 2026-09-08: the user requested a shared, polished entry page for the 2D and 3D games. Follow-up: all player-facing text must be in English.

The root URL presents two equal choices, with original gameplay imagery and explicit play links. The classic game moves to classic.html without changing its simulation, assets or controls. The 3D game moves to 3d.html within its project and production bundle. Both offer a return link to the selection page; leaving 3D saves its existing checkpoint through its normal lifecycle.

Visual direction: aviation blue (#142b3a), river teal (#67b8ae), signal orange (#f29b59), cloud white (#edf2ef), muted blue (#9eb2bd). System condensed display type and readable system body type. Two large landscape scenes on desktop, stacked on mobile. Motion only on interaction; visible keyboard focus and reduced-motion support. English selection copy, matching both games.

The 3D build produces a standalone combined site at its existing preview URL: selection, classic game, 3D game and local assets. A Vite plugin serves the same selection/classic files during development. Root static hosting also works after building 3D. Root service-worker cache is versioned and restricted to classic/selection assets, leaving 3D bundles to the network. Existing browser tests target the explicit 3D entry. Navigation tests cover both editions, back links and mobile overflow.
