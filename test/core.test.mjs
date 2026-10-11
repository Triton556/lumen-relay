import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS,
  createGame,
  update,
  interact,
  startDash,
  walkable,
  bridgeActive,
  interactionText,
  objective,
} from '../src/core.js';
test('all authored structures occupy walkable floor', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const g = createGame(i);
    for (const o of [...g.level.sources, ...g.level.relays, ...g.level.mirrors, g.level.exit])
      assert.ok(walkable(g, o.x, o.y), `${i}: ${o.id}`);
    assert.ok(walkable(g, ...g.level.spawn));
  }
});
test('pickup is an explicit action with a meaningful prompt and event', () => {
  const g = createGame(0);
  assert.equal(g.player.carrying, false);
  assert.equal(interactionText(g), 'Взять искру');
  interact(g);
  assert.equal(g.player.carrying, true);
  assert.equal(g.events.at(-1).type, 'pickup');
});
test('movement is bounded by edges instead of lethal falls', () => {
  const g = createGame(0);
  for (let i = 0; i < 600; i++) update(g, 1 / 60, { x: -1, y: 0 });
  assert.ok(walkable(g, g.player.x - 0.16, g.player.y - 0.16));
  assert.ok(walkable(g, g.player.x + 0.16, g.player.y + 0.16));
  assert.equal(g.falls, 0);
});
test('dash cannot open an unpowered bridge', () => {
  const g = createGame(0);
  assert.equal(bridgeActive(g, g.level.bridges[0]), false);
  startDash(g);
  for (let i = 0; i < 100; i++) update(g, 1 / 60, { x: 1, y: 0 });
  assert.equal(bridgeActive(g, g.level.bridges[0]), false);
});

test('authored guidance names blocking prisms and chime pairs without changing puzzle state', () => {
  const g = createGame(1);
  assert.match(objective(g), /призму/);
  g.mirrors.m1 = 0;
  assert.match(objective(g), /реле/);
  g.relays.add('r1');
  assert.match(objective(g), /призму/);
  g.mirrors.m2 = 0;
  assert.match(objective(g), /реле/);
  const station = createGame(4);
  station.relays.add('r1');
  station.relays.add('r2');
  assert.match(objective(station), /Лист.*0 \/ 2/);
  station.chimes.add('c1');
  assert.match(objective(station), /Лист.*1 \/ 2/);
  station.chimes.add('c2');
  assert.match(objective(station), /реле/);
  const forest = createGame(5);
  ['r1', 'r2', 'r3'].forEach((id) => forest.relays.add(id));
  assert.match(objective(forest), /Солнце/);
  ['c1', 'c2'].forEach((id) => forest.chimes.add(id));
  assert.match(objective(forest), /реле/);
  forest.relays.add('r4');
  assert.match(objective(forest), /Луна/);
  ['c3', 'c4'].forEach((id) => forest.chimes.add(id));
  assert.match(objective(forest), /маяк/);
});
