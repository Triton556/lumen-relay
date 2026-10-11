// Deterministic normal-action stress test. No browser completion is inferred.
import assert from 'node:assert/strict';
import { createGame, update, interact, startDash, recall, walkable, LEVELS } from '../src/core.js';
import { packGame, restoreGame } from '../src/storage.js';
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
const seeds = [1, 19, 127, 2026, 65537, 93481, 123456789, 0xdeadbeef];
let actions = 0;
const coverage = {
  restores: 0,
  restarts: 0,
  pickups: 0,
  relays: 0,
  hazards: 0,
  dashes: 0,
  recalls: 0,
  blooms: 0,
};
function invariant(g, label) {
  const p = g.player;
  for (const [k, v] of Object.entries(p))
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `${label}: player.${k}=${v}`);
  for (const k of ['time', 'elapsed', 'falls', 'steps'])
    assert.ok(Number.isFinite(g[k]) && g[k] >= 0, `${label}: invalid ${k}`);
  assert.ok(p.cooldown >= 0 && p.cooldown <= 1.05, `${label}: cooldown`);
  assert.ok(p.dash >= 0 && p.dash <= 0.2, `${label}: dash`);
  assert.ok(p.invincible >= 0 && p.invincible <= 1.25, `${label}: invincibility`);
  for (const [dx, dy] of [
    [-0.16, -0.16],
    [0.16, -0.16],
    [-0.16, 0.16],
    [0.16, 0.16],
  ])
    assert.ok(walkable(g, p.x + dx, p.y + dy), `${label}: off-floor player footprint`);
  assert.ok(
    g.checkpoint.every(Number.isFinite) && walkable(g, ...g.checkpoint),
    `${label}: checkpoint`,
  );
  assert.ok(
    [
      g.level.spawn,
      ...g.level.sources.map((s) => [s.x, s.y]),
      ...g.level.relays.filter((r) => g.relays.has(r.id)).map((r) => [r.x, r.y]),
      ...(g.level.chimes || []).filter((c) => g.chimes.has(c.id)).map((c) => [c.x, c.y]),
    ].some((c) => c[0] === g.checkpoint[0] && c[1] === g.checkpoint[1]),
    `${label}: unknown checkpoint`,
  );
  assert.ok(
    g.relays.size <= g.level.relays.length &&
      [...g.relays].every((id) => g.level.relays.some((r) => r.id === id)),
    `${label}: relay cardinality`,
  );
  assert.ok(
    g.wisps.size <= g.level.wisps.length &&
      [...g.wisps].every((i) => Number.isInteger(i) && i >= 0 && i < g.level.wisps.length),
    `${label}: wisp cardinality`,
  );
  assert.ok(
    g.blooms.size <= g.level.buds.length &&
      [...g.blooms].every((id) => g.level.buds.some((b) => b.id === id)),
    `${label}: bloom cardinality`,
  );
  assert.ok(
    g.chimes.size <= (g.level.chimes || []).length &&
      [...g.chimes].every((id) => (g.level.chimes || []).some((c) => c.id === id)),
    `${label}: chime cardinality`,
  );
  assert.equal(
    Object.keys(g.mirrors).length,
    g.level.mirrors.length,
    `${label}: mirror state grows`,
  );
  assert.ok(
    Object.values(g.mirrors).every((d) => Number.isInteger(d) && d >= 0 && d < 4),
    `${label}: mirror orientation`,
  );
  if (g.complete)
    assert.equal(g.relays.size, g.level.relays.length, `${label}: locked exit accepted`);
  assert.ok(g.events.length <= g.level.wisps.length + 5, `${label}: unbounded per-tick events`);
  assert.ok(JSON.stringify(packGame(g)).length < 2000, `${label}: serialized state grows`);
}
for (const seed of seeds) {
  const r = rng(seed);
  let g = createGame(seed % LEVELS.length),
    direction = { x: 0, y: 0 };
  for (let step = 0; step < 6000; step++) {
    const q = r();
    if (q < 0.0015 || g.complete) {
      g = createGame(Math.floor(r() * LEVELS.length));
      coverage.restarts++;
    } else if (q < 0.012) {
      const packed = packGame(g);
      g = restoreGame(JSON.parse(JSON.stringify(packed)));
      assert.deepEqual(packGame(g), packed, `seed ${seed}, step ${step}: round-trip drift`);
      coverage.restores++;
    } else if (q < 0.045) {
      recall(g);
    } else if (q < 0.1) {
      startDash(g);
    } else if (q < 0.23) {
      interact(g);
    }
    if (r() < 0.045) {
      const a = r() * Math.PI * 2,
        m = r() < 0.1 ? 0 : 1;
      direction = { x: Math.cos(a) * m, y: Math.sin(a) * m };
    }
    update(g, [0, 0.008, 0.016, 0.025, 0.05, 0.1][Math.floor(r() * 6)], direction);
    invariant(g, `seed ${seed}, step ${step}`);
    for (const e of g.events) {
      if (e.type === 'pickup') coverage.pickups++;
      if (e.type === 'relay') coverage.relays++;
      if (e.type === 'hurt') coverage.hazards++;
      if (e.type === 'dash') coverage.dashes++;
      if (e.type === 'recall') coverage.recalls++;
      if (e.type === 'bloom') coverage.blooms++;
    }
    g.events.length = 0;
    actions++;
  }
  console.log(`PASS randomized seed ${seed}: 6000 actions`);
}
assert.ok(
  coverage.restores > 100 &&
    coverage.restarts > 10 &&
    coverage.pickups > 0 &&
    coverage.dashes > 0 &&
    coverage.recalls > 0,
  'Stress sequence did not exercise intended lifecycle actions',
);
console.log('Randomized invariant coverage', JSON.stringify({ actions, ...coverage }));
