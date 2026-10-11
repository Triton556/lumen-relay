import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const core = await import(
  'data:text/javascript;base64,' +
    Buffer.from(readFileSync(new URL('../src/core.js', import.meta.url), 'utf8')).toString('base64')
);
const {
  LEVELS,
  createGame,
  update,
  interact,
  startDash,
  recall,
  walkable,
  bridgeActive,
  snapshot,
} = core;
let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('PASS', name);
    passed++;
  } catch (e) {
    console.error('FAIL', name, e.stack);
    process.exitCode = 1;
  }
}
function tilePath(g, tx, ty) {
  const start = [Math.floor(g.player.x), Math.floor(g.player.y)],
    end = [Math.floor(tx), Math.floor(ty)];
  const q = [{ p: start, cost: 0 }],
    prev = new Map([[start.join(','), null]]),
    costs = new Map([[start.join(','), 0]]);
  while (q.length) {
    q.sort((a, b) => a.cost - b.cost);
    const { p, cost } = q.shift();
    if (cost !== costs.get(p.join(','))) continue;
    if (p[0] === end[0] && p[1] === end[1]) {
      let a = p.join(','),
        path = [];
      while (a) {
        path.push(a.split(',').map(Number));
        a = prev.get(a);
      }
      return path.reverse();
    }
    for (const d of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = [p[0] + d[0], p[1] + d[1]],
        k = n.join(','),
        hazard = g.level.hazards.some((h) => h.cells.some((c) => c[0] === n[0] && c[1] === n[1])),
        nc = cost + 1 + (hazard ? 100 : 0);
      if (nc < (costs.get(k) ?? Infinity) && walkable(g, n[0] + 0.5, n[1] + 0.5)) {
        prev.set(k, p.join(','));
        costs.set(k, nc);
        q.push({ p: n, cost: nc });
      }
    }
  }
  throw Error(`No floor route from ${start} to ${end}`);
}
// Uses only update/input and interact; no player mutation, teleport, or debug hooks.
function travel(g, x, y) {
  const before = g.elapsed;
  let tries = 0;
  while (Math.hypot(g.player.x - x, g.player.y - y) > 0.015) {
    if (g.elapsed - before > 180)
      throw Error(`Route timeout to ${x},${y}: ${JSON.stringify(snapshot(g))}`);
    let path = tilePath(g, x, y);
    const points = path.map((p) => [p[0] + 0.5, p[1] + 0.5]);
    points.push([x, y]);
    let recalled = false;
    for (const p of points) {
      let guard = 0;
      while (Math.hypot(g.player.x - p[0], g.player.y - p[1]) > 0.015) {
        if (++guard > 1200) throw Error(`Stuck moving toward ${p}`);
        const dx = p[0] - g.player.x,
          dy = p[1] - g.player.y,
          n = Math.hypot(dx, dy),
          fall = g.falls;
        const dt = Math.min(0.02, n / 2.6),
          next = [g.player.x + (dx / n) * 2.6 * dt, g.player.y + (dy / n) * 2.6 * dt];
        const entersActive = g.level.hazards.some(
          (h) =>
            core.hazardActive(g, h) &&
            h.cells.some((c) => core.key(...next) === c.join(',')) &&
            !h.cells.some((c) => core.key(g.player.x, g.player.y) === c.join(',')),
        );
        if (entersActive) update(g, 0.02);
        else update(g, dt, { x: dx / n, y: dy / n });
        g.events.length = 0;
        if (g.falls !== fall) {
          recalled = true;
          tries++;
          break;
        }
      }
      if (recalled) break;
    }
    if (tries > 120) throw Error('Repeated hazard failures');
  }
}
function use(g, type, id, count = 1) {
  const o = type === 'exit' ? g.level.exit : g.level[type].find((x) => x.id === id);
  travel(g, o.x, o.y);
  for (let i = 0; i < count; i++) interact(g);
}
const routes = [
  [
    ['sources', 's1'],
    ['relays', 'r1'],
    ['sources', 's2'],
    ['relays', 'r2'],
  ],
  [
    ['mirrors', 'm1', 2],
    ['sources', 's2'],
    ['relays', 'r1'],
    ['mirrors', 'm2', 3],
    ['sources', 's3'],
    ['relays', 'r2'],
  ],
  [
    ['sources', 's1'],
    ['relays', 'r1'],
    ['sources', 's2'],
    ['relays', 'r2'],
    ['sources', 's3'],
    ['relays', 'r3'],
  ],
  [
    ['sources', 's1'],
    ['relays', 'r1'],
    ['sources', 's2'],
    ['relays', 'r2'],
    ['mirrors', 'm1', 3],
    ['sources', 's3'],
    ['relays', 'r3'],
    ['sources', 's4'],
    ['relays', 'r4'],
  ],
  [
    ['sources', 's1'],
    ['chimes', 'c1'],
    ['relays', 'r1'],
    ['sources', 's2'],
    ['chimes', 'c2'],
    ['relays', 'r2'],
    ['sources', 's3'],
    ['relays', 'r3'],
  ],
  [
    ['sources', 's1'],
    ['chimes', 'c3'],
    ['relays', 'r1'],
    ['sources', 's2'],
    ['chimes', 'c1'],
    ['relays', 'r2'],
    ['mirrors', 'm1', 2],
    ['sources', 's3'],
    ['chimes', 'c2'],
    ['relays', 'r3'],
    ['sources', 's4'],
    ['chimes', 'c4'],
    ['relays', 'r4'],
  ],
];
for (let i = 0; i < LEVELS.length; i++)
  test(`Level ${i + 1}: full walking route, all relays, all wisps, exit`, () => {
    const g = createGame(i);
    for (const step of routes[i]) use(g, ...step);
    for (const w of g.level.wisps) travel(g, ...w);
    use(g, 'exit');
    assert.equal(g.complete, true);
    assert.equal(g.wisps.size, g.level.wisps.length);
    console.log(
      ' ROUTE',
      JSON.stringify({
        level: i + 1,
        elapsed: +g.elapsed.toFixed(2),
        hazardRecalls: g.falls,
        relays: [...g.relays],
        wisps: g.wisps.size,
      }),
    );
  });
test('Fresh games do not leak mutable progress', () => {
  const a = createGame(0),
    b = createGame(0);
  use(a, 'sources', 's1');
  use(a, 'relays', 'r1');
  assert.equal(b.relays.size, 0);
  assert.equal(b.player.carrying, false);
  assert.deepEqual(b.checkpoint, LEVELS[0].spawn);
});
test('Locked bridge blocks movement and dash', () => {
  const g = createGame(0);
  travel(g, 5.5, 6.5);
  for (let i = 0; i < 120; i++) update(g, 0.02, { x: 1, y: 0 });
  startDash(g);
  for (let i = 0; i < 20; i++) update(g, 0.02, { x: 1, y: 0 });
  assert.ok(g.player.x < 6);
  assert.equal(bridgeActive(g, g.level.bridges[0]), false);
});
test('Diagonal speed is normalized', () => {
  const a = createGame(0),
    b = createGame(0);
  update(a, 0.05, { x: 1, y: 0 });
  update(b, 0.05, { x: 1, y: 1 });
  assert.ok(
    Math.abs(
      Math.hypot(a.player.x - 2.5, a.player.y - 7.5) -
        Math.hypot(b.player.x - 2.5, b.player.y - 7.5),
    ) < 1e-8,
  );
});
test('Dash cooldown disallows repeats and recovers', () => {
  const g = createGame();
  assert.equal(startDash(g), true);
  assert.equal(startDash(g), false);
  for (let i = 0; i < 110; i++) update(g, 0.01);
  assert.equal(startDash(g), true);
});
test('Recall preserves relay and carrying progress', () => {
  const g = createGame();
  use(g, 'sources', 's1');
  use(g, 'relays', 'r1');
  use(g, 'sources', 's1');
  travel(g, 4.5, 9.5);
  recall(g);
  assert.equal(g.player.carrying, true);
  assert.ok(g.relays.has('r1'));
  assert.deepEqual([g.player.x, g.player.y], g.checkpoint);
});
test('Exit cannot complete before relays', () => {
  const g = createGame(2);
  travel(g, g.level.exit.x, g.level.exit.y);
  interact(g);
  assert.equal(g.complete, false);
});
test('Complete state is frozen', () => {
  const g = createGame();
  for (const step of routes[0]) use(g, ...step);
  use(g, 'exit');
  const before = JSON.stringify(snapshot(g));
  update(g, 0.05, { x: 1, y: 1 });
  interact(g);
  recall(g);
  assert.equal(startDash(g), false);
  assert.equal(JSON.stringify(snapshot(g)), before);
});
test('Delta clamp prevents negative and huge jumps', () => {
  const g = createGame();
  update(g, -1, { x: 1, y: 0 });
  assert.equal(g.elapsed, 0);
  update(g, 999, { x: 1, y: 0 });
  assert.equal(g.elapsed, 0.05);
  assert.ok(g.player.x <= 2.63 + 1e-8);
});
test('Interaction events retain action type rather than entity type', () => {
  const g = createGame();
  interact(g);
  assert.equal(g.events.at(-1).type, 'pickup');
  const h = createGame(1);
  travel(h, 4.5, 9.5);
  interact(h);
  assert.equal(h.events.at(-1).type, 'rotate');
  interact(h);
  assert.equal(h.events.at(-1).type, 'aligned');
  const k = createGame();
  for (const step of routes[0]) use(k, ...step);
  use(k, 'exit');
  assert.equal(k.events.at(-1).type, 'complete');
});
test('Closing bridge beneath player auto-recovers without losing energy', () => {
  const g = createGame(1);
  use(g, 'sources', 's1');
  use(g, 'mirrors', 'm1', 2);
  travel(g, 4.5, 8.5);
  travel(g, 5.2, 8.7);
  assert.equal(core.interactable(g)?.id, 'm1');
  interact(g);
  assert.equal(bridgeActive(g, g.level.bridges[0]), false);
  assert.deepEqual([g.player.x, g.player.y], g.checkpoint);
  assert.equal(g.player.carrying, true);
  assert.ok(g.events.some((e) => e.type === 'hint'));
});
for (let i = 0; i < LEVELS.length; i++)
  test(`Level ${i + 1}: all optional buds reachable through movement`, () => {
    const g = createGame(i);
    for (const step of routes[i]) use(g, ...step);
    use(g, 'sources', 's1');
    for (const bud of g.level.buds) {
      use(g, 'buds', bud.id);
      assert.ok(g.blooms.has(bud.id), `Bud ${bud.id} did not bloom`);
      assert.equal(g.player.carrying, true);
    }
    assert.equal(g.blooms.size, g.level.buds.length);
    use(g, 'exit');
    assert.equal(g.complete, true);
  });
test('Bud explains missing light, blooms once, and retains carried light', () => {
  const g = createGame();
  use(g, 'buds', 'f1');
  assert.equal(g.blooms.size, 0);
  assert.equal(g.events.at(-1).type, 'hint');
  use(g, 'sources', 's1');
  use(g, 'buds', 'f1');
  assert.equal(g.blooms.size, 1);
  assert.equal(g.player.carrying, true);
  assert.equal(g.events.at(-1).type, 'bloom');
  const count = g.events.length;
  interact(g);
  assert.equal(g.events.length, count);
  assert.equal(g.blooms.size, 1);
  assert.equal(createGame().blooms.size, 0);
});
test('Puzzle interaction has priority over a closer optional bud', () => {
  const g = createGame(1);
  travel(g, 1.35, 10.5);
  assert.ok(
    Math.hypot(g.player.x - 0.5, g.player.y - 10.5) <
      Math.hypot(g.player.x - 2.5, g.player.y - 10.5),
  );
  assert.equal(core.interactable(g).type, 'source');
  interact(g);
  assert.equal(g.player.carrying, true);
  assert.equal(g.blooms.size, 0);
});
test('Paired chimes require light, retain it, open bridge only as pair, and stay open', () => {
  const g = createGame(4);
  use(g, 'chimes', 'c1');
  assert.equal(g.chimes.size, 0);
  assert.equal(g.events.at(-1).type, 'hint');
  use(g, 'sources', 's1');
  use(g, 'chimes', 'c1');
  assert.equal(g.chimes.size, 1);
  assert.equal(g.player.carrying, true);
  assert.equal(core.pairActive(g, 'leaf'), false);
  const e = g.events.filter((e) => e.type === 'chime').length;
  interact(g);
  assert.equal(g.events.filter((e) => e.type === 'chime').length, e);
  assert.equal(g.chimes.size, 1);
  use(g, 'relays', 'r1');
  use(g, 'sources', 's2');
  use(g, 'chimes', 'c2');
  assert.equal(core.pairActive(g, 'leaf'), true);
  assert.equal(g.player.carrying, true);
  assert.equal(g.events.at(-1).type, 'duet');
  interact(g);
  assert.equal(core.pairActive(g, 'leaf'), true);
  recall(g);
  assert.deepEqual([g.player.x, g.player.y], [4.5, 3.5]);
  assert.equal(createGame(4).chimes.size, 0);
});
test('Exploration rejects unfinished and fabricated completion state', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const g = createGame(i);
    assert.equal(core.beginExploration(g), false);
    g.complete = true;
    assert.equal(core.beginExploration(g), false);
    assert.equal(g.exploring, false);
  }
});
for (let i = 0; i < LEVELS.length; i++)
  test(`Level ${i + 1}: postlude normal-input collection keeps completion and frozen score`, () => {
    const g = createGame(i);
    for (const step of routes[i]) use(g, ...step);
    use(g, 'exit');
    const elapsed = g.elapsed,
      falls = g.falls,
      mirrors = { ...g.mirrors };
    g.events.length = 0;
    assert.equal(core.beginExploration(g), true);
    assert.equal(core.beginExploration(g), true);
    for (const b of g.level.bridges) assert.equal(bridgeActive(g, b), true);
    for (const h of g.level.hazards) assert.equal(core.hazardActive(g, h), false);
    use(g, 'sources', g.level.sources[0].id);
    for (const bud of g.level.buds) use(g, 'buds', bud.id);
    for (const w of g.level.wisps) travel(g, ...w);
    for (const m of g.level.mirrors) use(g, 'mirrors', m.id);
    use(g, 'exit');
    assert.equal(g.complete, true);
    assert.equal(g.exploring, true);
    assert.equal(g.elapsed, elapsed);
    assert.equal(g.falls, falls);
    assert.deepEqual(g.mirrors, mirrors);
    assert.equal(g.blooms.size, g.level.buds.length);
    assert.equal(g.wisps.size, g.level.wisps.length);
    assert.equal(g.events.filter((e) => e.type === 'complete').length, 0);
  });
test('Interaction availability distinguishes useful action from settled status', () => {
  const g = createGame(5),
    available = core.interactionAvailable;
  const o = (type, list, id) => ({ ...g.level[list].find((v) => v.id === id), type });
  const source = o('source', 'sources', 's1'),
    relay = o('relay', 'relays', 'r1'),
    bud = o('bud', 'buds', 'f1'),
    chime = o('chime', 'chimes', 'c3'),
    mirror = o('mirror', 'mirrors', 'm1');
  assert.equal(available(g, source), true);
  for (const v of [relay, bud, chime, mirror]) assert.equal(available(g, v), false);
  g.player.carrying = true;
  assert.equal(available(g, source), false);
  for (const v of [relay, bud, chime]) assert.equal(available(g, v), true);
  g.relays.add('r1');
  g.relays.add('r2');
  g.blooms.add('f1');
  g.chimes.add('c3');
  for (const v of [relay, bud, chime]) assert.equal(available(g, v), false);
  assert.equal(available(g, mirror), true);
  g.complete = true;
  assert.equal(available(g, mirror), false);
  g.exploring = true;
  assert.equal(available(g, mirror), false);
  assert.equal(available(g, { type: 'exit' }), false);
  g.player.carrying = false;
  assert.equal(available(g, source), true);
  g.player.carrying = true;
  assert.equal(available(g, o('bud', 'buds', 'f2')), true);
});
test('Garden 6 exact c3/f1 overlap favors flower after chime, but needed chime first', () => {
  const g = createGame(5);
  Object.assign(g.player, { x: 2.5, y: 14, carrying: true });
  assert.equal(core.interactable(g).id, 'c3');
  interact(g);
  assert.equal(g.chimes.has('c3'), true);
  assert.equal(core.interactable(g).id, 'f1');
  interact(g);
  assert.equal(g.blooms.has('f1'), true);
  assert.equal(g.player.carrying, true);
});
console.log(`${passed} tests passed`);
