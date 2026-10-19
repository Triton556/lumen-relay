# Lumen Relay

A cozy light-puzzle adventure in six overgrown floating gardens.

<!-- Gameplay hero pending: capture 10–15 seconds from the actual game in docs/media/ when a browser is available. -->

[Live demo](https://triton556.github.io/lumen-relay/)

**Stack:** JavaScript · Canvas 2D · Web Audio · HTML · CSS · Node.js development tools

**My role:** Danil Volodin — directed the AI-assisted browser-game experiment with Rumi, including playthrough and refinement.

## Develop and run

Node 20+ is needed for development commands. The game needs a modern browser with Canvas 2D and ES modules; WebGL is not required.

```sh
npm run build
npm run dev
npm test
```

- Build copies the six JavaScript modules, HTML and CSS from `src/` to `dist/`.
- Dev serves `dist/` at http://127.0.0.1:4173 and binds only the local loopback interface. In an environment where command sessions have isolated loopback networks, run the server in the browser's own supported environment.
- Tests include deterministic routes, storage/lifecycle checks, rendering geometry, audio lifecycle, timing invariants, and seeded randomized actions.
- Deploy `dist/` as a static website. No runtime package installation is needed.
- GitHub Pages deploys automatically: the workflow tests, builds and publishes `dist/` on every push to `main`.
- HTML, stylesheet and module paths are relative, so the build works under `/lumen-relay/`.

## About the game

An original, self-contained isometric browser adventure about sharing light. A small porcelain keeper restores six floating gardens: carrying sparks, aligning prisms, timing gentle pulses, awakening flowers, and joining paired wind chimes. The Russian-language UI and all art/audio are local and procedural.

No accounts, backend, analytics, third-party assets, runtime CDN requests, or personal information.

## Controls

| Action               | Keyboard / pointer                   | Touch                                        |
| -------------------- | ------------------------------------ | -------------------------------------------- |
| Move                 | WASD or arrows, in screen directions | Left virtual stick                           |
| Interact             | E or contextual action button        | Right action button                          |
| Dash                 | Space                                | Right dash button                            |
| Return to checkpoint | R or pause-menu return button        | Pause-menu return button                     |
| Pause / resume       | Escape or pause icon                 | Pause icon                                   |
| Camera               | Overview on desktop                  | Follow / “Весь сад” toggle on narrow screens |
| Diagnostics          | F3 or settings checkbox              | Settings checkbox                            |

Edges block movement instead of causing falling deaths. A pulse hazard returns the keeper to the latest source, activated relay or awakened chime. Carried light, collectibles, flowers and puzzle progress are retained. Rotating a prism that removes the floor under the player safely recalls them too.

## Six gardens

1. **Пробуждение** — luminous lily garden; learn sparks, relays and light bridges.
2. **Преломление** — flowering mirror orchard; direct beams with rotating prisms.
3. **Сердцебиение** — amber canopy and bell flowers; wait for pulse gaps or dash through them.
4. **Созвездие** — moss-covered moon observatory; combine the original mechanics.
5. **Тихий вокзал** — reclaimed station courtyards, clock and arches; introduce paired wind chimes.
6. **Песня истока** — woodland lagoon and living central tree; combine two distinct chime pairs with familiar prism/pulse ideas for the final restoration.

Optional violet memory wisps and dormant flowers reward exploration. Neither gates completion. Sources replenish indefinitely.

### Flower restoration

While carrying a spark, approach a dormant flower and interact to share its warmth. The spark is not consumed. The flower becomes a luminous patch with a chime. Useful source, relay, prism, chime and beacon actions have priority over flowers. A flower ready to bloom takes priority over an already-completed informational target. The pause guide explains the mechanic and shows counts; completion summarizes flowers separately and invites a frozen-time stroll for remaining finds. The garden selector shows best flower and wisp counts, offers Continue for the current run, and explicitly labels fresh selection as a replay.

### Paired chimes

Each pair is identified by a **shape, a Russian name, and a color**: leaf, sun or moon. Carry light to awaken each half; the spark is retained. One half shows a waiting state. Both halves grow a permanent root/lily bridge. There is no timer and no way to switch the bridge off. Awakened chimes also become safe checkpoints.

### Stay in the restored garden

Choose **Остаться в саду** after completion to stroll through the restored scene. The explicit `complete=true, exploring=true` state keeps the completion timer frozen, quiets hazards and leaves every restored bridge open. Movement, dash, recall, sources, flowers and memory wisps remain available. Prisms and other completed puzzle controls cannot undo restoration. The beacon does not complete twice. **Итоги сада** in pause reopens the result card and the next-garden action.

The current stroll survives reload at its last safe checkpoint. Completion/exploration flags are accepted only alongside all required relay and chime IDs. Optional collections immediately update best records; the result card shows this run, while the selector labels combined records as best. Selecting a garden or restarting deliberately starts a fresh run.

### Local garden photos

From pause, choose **Снимок сада**. The current view stays still: gameplay, decorative animation, particles and time are frozen, sound remains paused, and gameplay overlays disappear. **Сохранить PNG** explicitly asks the browser to download only the Canvas scene at its current backing resolution. Controls and text are not included; no image is uploaded. The browser controls the download destination and may prompt or restrict downloads. Export errors remain visible and retryable.

**К паузе** or Escape returns to pause without resuming movement. Photo mode is transient and adds no save fields: reloading offers the ordinary saved run at its safe checkpoint. Framing stays in the existing overview/follow view; there is no free camera.

## Architecture

- `src/core.js`: authored level data, deterministic movement/collision, puzzle state and events; no DOM.
- `src/render.js`: procedural Canvas 2D art, local lighting, foliage, scene landmarks, camera and particle effects.
- `src/audio.js`: gesture-activated Web Audio harmonies and chimes; different palettes per biome, mute support, stopped voice cleanup.
- `src/storage.js`: versioned validation, safe reads/writes, migration and checkpoint restoration.
- `src/game.js`: keyboard/pointer input, UI, pause/focus handling, progress, sound and simulation timing.
- `src/icons.js`: inline SVG icons, independent of installed fonts.
- `test/`: implementation-owned unit and geometry checks.
- `qa/`: deterministic route, stress, lifecycle, persistence and rendering tests.

The renderer caches the static sky, world-space terrain, reusable neon primitives, and fixed flower/crown details. Neon/detail sprites share an LRU budget of 256 entries and 8 million stored pixels (approximately 32 MB of RGBA pixel data). Shape keys exclude world translation; scale, device pixel ratio and quality changes invalidate the cache. Animated keepers, source sparks, fireflies and particles remain live. Dynamic lights, actors and effects remain live. World-space caching allows mobile camera movement without repainting terrain each frame. Desktop keeps the overview; narrow screens use restrained follow with an explicit overview toggle. Returning to focus or recalling to a checkpoint recenters safely. Reduced motion avoids camera easing and decorative movement.

## Quality and timing

- **Полное свечение:** layered bloom-style shadows, maximum device pixel ratio 2.
- **Лёгкое свечение:** less expensive glows and maximum pixel ratio 1.25, available as a fallback for weaker devices.
- **Меньше движения:** removes decorative time variation, camera easing, shake and activation bounce, and reduces particle bursts.
- **Звук:** can be muted; no audio context is constructed before a user-gesture unlock.
- **Диагностика:** default off; displays measured FPS, synchronous JS/HUD/canvas-submission time and bounded cache counters, with no gameplay mutation. Submission time does not measure deferred painting/compositing.

The frame loop subdivides ordinary slow frames into simulation steps no larger than 25 ms. A single frame gap is capped at 150 ms; hiding or leaving the page pauses the game and clears inputs. This keeps movement consistent at ordinary low FPS without a large jump after returning from the background.

## Save version and migration

Browser-local key: `lumen-relay-v1`, schema version **1**, with additive optional fields. Saves contain unlocked gardens, best completed time/collectible/flower counts, settings, and in-progress puzzle state at a legitimate checkpoint.

- Save after important interactions, every six active seconds, on pause, and on page hide.
- Resume at the last source, activated relay or awakened chime, rather than an arbitrary foot position.
- Corrupt/unavailable storage falls back safely. Blocked saving produces persistent inline notices in the title, settings, pause and completion screens; a later successful write clears them.
- Valid IDs and collection bounds are checked; invalid checkpoints are rejected.
- Older saves without flower/chime fields remain compatible.
- A completed old four-garden save unlocks garden 5, **not garden 6**. An unfinished old garden remains unfinished.
- Restart/replay resets the current run, including flowers/chimes; best completed records remain.
- Progress belongs to this browser and website origin. Local previews and the hosted site do not share it; there is no cloud sync.

## Verification and limits

All six mandatory routes and all optional flower routes have deterministic tests using normal movement and interaction APIs, not teleport/success cheats. Six gardens have also been completed through the actual browser keyboard UI. Actual browser checks have verified flower activation/retained light, paired bridges, reload migration, post-completion strolling and collection after reload, settings and pointer controls on a narrowed desktop viewport. Amber and wellspring canopy placements were retested at the affected source/relay/exit positions in wide and narrow views. Seeded stress tests cover 48,000 normal actions and hundreds of restore/restart cycles.

Performance was compared on the same fully restored garden 6 in the cloud browser at 1189×762 with effective pixel ratio 1. Before neon caching, full glow sustained roughly 8–14 FPS; primitive and composed flower/crown caching improved it into the 30s (about 37–38 FPS in the matched comparison). Light glow reached 60 FPS in that environment. Full glow remains the default for its brighter appearance; light glow is the explicit smoother fallback. A further bridge/constellation cache experiment showed no clear additional gain and was removed to keep the renderer simpler. These are environment-specific observations, not device-wide performance guarantees.

All six gardens and optional collections, responsive follow/overview camera, the amber-dawn palette, and restoration strolling were checked in the cloud browser. A one-hour full-glow session before optimization completed without crashes or state loss, while revealing the performance issue above. Physical phone multitouch and subjective audio quality have not been verified on real hardware. Canvas gameplay is visual; the UI has keyboard access, focus states and text feedback, but the game is not a fully nonvisual experience.

`window.render_game_to_text()` is a read-only observation snapshot of the simulation/UI. It has no teleport, unlock or success mutation. Diagnostics are also read-only.

## Interaction and collision model

The keeper is constrained by island edges and inactive bridges. Relays, sources, prisms and decorative objects currently do not have solid-body collision. Walking through these props is a known limitation of this demonstration, not a claim of full scene physics.

## Development

Created as an AI-assisted browser-game experiment with Rumi under Danil Volodin’s direction. The initial build was developed, played through and refined during an eight-hour session. Runtime assets are generated locally in code. The interface is currently in Russian; this documentation is in English.


## License

[MIT](LICENSE) © 2026 Danil Volodin.
